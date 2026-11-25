import type { Plugin } from "@opencode/plugin";
import type { SquadStore } from "../db/store";
import { nextGrade } from "../personas";
import { parseProcessAuditText } from "../process-audit";
import { taskDiff } from "../runtime/diff";
import { missionEvidence, taskEvidence } from "../runtime/evidence";
import { hireEmployee } from "../runtime/hire";
import { taskImages } from "../runtime/images";
import { extractLastAssistantText } from "../runtime/messages";
import { formatDiffForPrompt } from "../runtime/snapshot";
import { allowlistFromBrief, partitionDiff } from "../runtime/scope";
import { releaseSession } from "../runtime/sessions";
import { parseVerdictText, requiredChecks } from "../verdict";
import { fail, ok } from "./result";

type AuditInput = {
  action?: "task" | "sample" | "process";
  mission_id?: string;
  task_id?: string;
  timeout_ms?: number;
};

const VERDICT_SCHEMA = {
  verdict: "pass | fail",
  severity: "low | medium | high | critical",
  findings: [
    { id: "F1", claim: "what is wrong", evidence: "path:line", required_fix: "what must change" },
  ],
  checked: ["diff", "tests", "acceptance"],
};

async function runTaskAudit(
  ctx: Plugin.Context,
  store: SquadStore,
  missionID: string,
  taskID: string,
  parentSessionID: string,
  timeoutMs: number,
) {
  const task = store.requireTask(missionID, taskID);
  if (task.status !== "integrated") {
    throw new Error(`cannot audit task in status ${task.status}`);
  }
  if (store.hasAudit(missionID, taskID)) {
    throw new Error(`task already audited: ${taskID}`);
  }
  if (!task.reviewerStaffID) {
    throw new Error(`task has no first reviewer: ${taskID}`);
  }

  // Deterministic gate: an "integrated" task whose commit never reached main is
  // a false pass, regardless of what any model says. In-place missions have no
  // commit by design, so the gate only checks worktree missions.
  const mission = store.requireMission(missionID);
  const checks = requiredChecks(task.class, { isolation: mission.isolation });
  const evidence = taskEvidence(ctx.location.directory, task, {
    isolation: mission.isolation,
  });
  if (evidence.problems.length > 0) {
    const findings = evidence.problems.map((claim, index) => ({
      id: `E${index + 1}`,
      claim,
      evidence: `task ${taskID}: merged_at=${task.mergedAt ?? "null"}, integration_commit=${task.integrationCommit ?? "null"}`,
      required_fix: "integrate the task commit into main and re-run the second review",
    }));
    const verdict = {
      verdict: "fail" as const,
      severity: "critical" as const,
      findings,
      checked: ["diff"],
    };
    const audit = store.recordAudit({
      missionID,
      taskID,
      kind: "second_review",
      status: "fail",
      verdict,
      notes: `deterministic integration evidence failed: ${evidence.problems.join("; ")}`,
    });
    return {
      audit,
      verdict,
      task: store.requireTask(missionID, taskID),
      reviewer: null,
      reviewer_session_id: null,
      deterministic: true,
      evidence,
      cost: 0,
      tokens: { input: 0, output: 0 },
      raw_verdict: "(deterministic check)",
    };
  }

  const reviewerGrade = nextGrade(task.grade);
  const reviewer = await hireEmployee(ctx, store, {
    missionID,
    persona: "reviewer",
    grade: reviewerGrade,
    parentSessionID,
    title: `SQUAD second reviewer for ${taskID} (${reviewerGrade})`,
  });

  let diff: unknown;
  try {
    diff = await taskDiff(ctx, store, task);
  } catch (error) {
    diff = { error: error instanceof Error ? error.message : String(error) };
  }

  const images = taskImages(ctx, store, task, diff);
  const scoped = partitionDiff(diff, allowlistFromBrief(task.brief));

  const prompt = [
    `You are SQUAD second reviewer at grade ${reviewerGrade}.`,
    "The first reviewer passed this task. Verify it independently and adversarially.",
    "You see only the Task Brief, Worker Report, and diff. You do not see the first reviewer's reasoning.",
    "Do not trust the report: verify the acceptance criteria against the evidence and diff.",
    "Fail ONLY when an acceptance criterion is unmet, the deliverable is missing/faked, or a correctness, security or data-loss defect has severity high or critical.",
    "Style, naming, formatting, documentation polish and optional improvements are a PASS with findings, not a fail. A fail with low or medium severity is invalid.",
    "If the diff reports partial patches or trimmed files, do not assume those files are unchanged; treat them as unverified and name them in the verdict.",
    `Integration evidence: ${JSON.stringify(evidence)}.`,
    ...(evidence.reviewRoundsWithoutRework > 0
      ? [
          `This task went through ${evidence.reviewRound} review rounds with only ${evidence.attempts} rework attempts. Check that the reviewed report is current and not a stale capture.`,
        ]
      : []),
    `This task is class "${task.class}". Required checks for a pass: ${checks.join(", ")}.`,
    ...(scoped.allowlist.length > 0
      ? [
          `Allowed paths for this task: ${scoped.allowlist.join(", ")}.`,
          ...(scoped.outOfScope.length > 0
            ? [
                `Changed but out of scope (sibling work, not this worker's deliverable): ${scoped.outOfScope.join(", ")}.`,
              ]
            : []),
        ]
      : []),
    ...(mission.isolation === "none"
      ? [
          "This mission runs in-place: there is no git commit. The diff is a filesystem snapshot comparison; judge it as the change set.",
        ]
      : []),
    "If the class is not code-like there may be no diff; judge the worker report evidence against the acceptance criteria instead.",
    "External assets means remote URLs, @font-face rules, <image>, data: URIs or embedded binaries; font-family names for locally installed fonts are allowed.",
    ...(images.length > 0
      ? [
          `Attached images: ${images.map((image) => image.name).join(", ")}. You can see them: judge visual quality, legibility and whether the artwork matches the brief.`,
        ]
      : []),
    ...(diff &&
    typeof diff === "object" &&
    (diff as { worktree?: { head?: string } }).worktree?.head
      ? [
          `Worktree commit: ${(diff as { worktree: { head: string; subject?: string; dirty?: boolean } }).worktree.head} (${(diff as { worktree: { subject?: string } }).worktree.subject ?? "no subject"}); working tree: ${(diff as { worktree: { dirty?: boolean } }).worktree.dirty ? "dirty" : "clean"}. The orchestrator auto-commits the worktree after the worker report, so the report may predate this commit.`,
        ]
      : []),
    "Return ONLY one JSON object, without markdown fences, matching this schema:",
    JSON.stringify(VERDICT_SCHEMA, null, 2),
    `Rules: a pass must have checked containing ${checks.join(", ")}; a fail needs at least one finding with concrete evidence.`,
    "Task Brief:",
    JSON.stringify(task.brief ?? {}, null, 2),
    "Worker Report:",
    task.rawReport ?? "(none)",
    "Diff:",
    formatDiffForPrompt(scoped.diff),
  ].join("\n\n");

  await ctx.session.prompt({
    sessionID: reviewer.sessionID,
    text: prompt,
    delivery: "queue",
    ...(images.length > 0
      ? { files: images.map(({ uri, name }) => ({ uri, name })) }
      : {}),
  });
  await ctx.session.wait(
    { sessionID: reviewer.sessionID },
    { signal: AbortSignal.timeout(Math.max(5_000, Math.min(timeoutMs, 600_000))) },
  );

  const info = await ctx.session.get({ sessionID: reviewer.sessionID });
  if (!store.hasLedgerEntry(missionID, taskID, reviewer.sessionID)) {
    store.recordLedger({
      missionID,
      taskID,
      staffID: reviewer.staff.id,
      sessionID: reviewer.sessionID,
      provider: reviewer.staff.provider,
      model: reviewer.staff.model,
      variant: reviewer.staff.variant,
      inputTokens: info.tokens.input,
      outputTokens: info.tokens.output,
      cost: info.cost,
    });
  }

  const messages = await ctx.session.context({ sessionID: reviewer.sessionID });
  const rawVerdict = extractLastAssistantText(messages);
  const verdict = parseVerdictText(rawVerdict, task.class, {
    isolation: mission.isolation,
  });
  const audit = store.recordAudit({
    missionID,
    taskID,
    kind: "second_review",
    status: verdict.verdict === "pass" ? "pass" : "fail",
    reviewerStaffID: reviewer.staff.id,
    reviewerSessionID: reviewer.sessionID,
    verdict,
    notes:
      verdict.verdict === "fail"
        ? verdict.findings.map((finding) => `${finding.id}: ${finding.claim}`).join("; ")
        : "second review passed",
  });
  const reviewerReleased = await releaseSession(ctx, reviewer.sessionID);
  store.addEvent(missionID, taskID, "session.released", {
    sessionID: reviewer.sessionID,
    role: "second_reviewer",
    released: reviewerReleased,
  });

  return {
    audit,
    verdict,
    task: store.requireTask(missionID, taskID),
    reviewer: reviewer.staff,
    reviewer_session_id: reviewer.sessionID,
    reviewer_released: reviewerReleased,
    cost: info.cost,
    tokens: info.tokens,
    raw_verdict: rawVerdict,
  };
}

async function runProcessAudit(
  ctx: Plugin.Context,
  store: SquadStore,
  missionID: string,
  parentSessionID: string,
  timeoutMs: number,
) {
  const mission = store.requireMission(missionID);
  const tasks = store.listTasks(missionID);
  const processChecks = missionEvidence(ctx.location.directory, tasks, {
    isolation: mission.isolation,
  });
  const payload = {
    mission,
    plan: store.getPlan(missionID),
    tasks: tasks.map(({ brief, rawReport, ...task }) => task),
    staff: store.listStaff(100),
    budget: store.budgetSummary(missionID),
    events: store.listEvents(missionID, 100),
    disputes: store.listDisputes(missionID),
    audits: store.listAudits(missionID),
    lessons: store.listLessons(missionID),
    process_checks: processChecks,
  };

  const auditor = await hireEmployee(ctx, store, {
    missionID,
    persona: "auditor",
    grade: "G2",
    parentSessionID,
    title: `SQUAD process auditor for ${missionID}`,
  });

  const prompt = [
    "You are SQUAD process auditor. Review only the process in the mission report JSON.",
    "Return ONLY one JSON object, without markdown fences:",
    '{"status":"pass | fail","summary":"short verdict","findings":[{"id":"P1","claim":"...","evidence":"...","required_fix":"..."}]}',
    "A fail must contain at least one finding with evidence.",
    "process_checks is computed by git, not by a model. If process_checks.ok is false, status MUST be fail and each entry of process_checks.problems MUST appear as a finding.",
    `Mission isolation: ${mission.isolation}. In "none" mode there is no git commit and no integration ancestry check; integrated tasks are judged by their reports and filesystem snapshot diffs.`,
    ...(mission.isolation === "none"
      ? ["Do not fail a task merely for a missing integration commit in in-place mode."]
      : []),
    "If a task appears in process_checks.suspiciousReviewRounds, verify from events/disputes whether a dispute or reviewer reset explains the extra rounds; if not, fail.",
    "A second review that ran after the mission was marked done, or an integrated task whose commit is not in main, is a process failure.",
    "Mission report JSON:",
    JSON.stringify(payload, null, 2).slice(0, 32_000),
  ].join("\n\n");

  await ctx.session.prompt({
    sessionID: auditor.sessionID,
    text: prompt,
    delivery: "queue",
  });
  await ctx.session.wait(
    { sessionID: auditor.sessionID },
    { signal: AbortSignal.timeout(Math.max(5_000, Math.min(timeoutMs, 600_000))) },
  );

  const info = await ctx.session.get({ sessionID: auditor.sessionID });
  if (!store.hasLedgerEntry(missionID, "mission", auditor.sessionID)) {
    store.recordLedger({
      missionID,
      taskID: "mission",
      staffID: auditor.staff.id,
      sessionID: auditor.sessionID,
      provider: auditor.staff.provider,
      model: auditor.staff.model,
      variant: auditor.staff.variant,
      inputTokens: info.tokens.input,
      outputTokens: info.tokens.output,
      cost: info.cost,
    });
  }

  const messages = await ctx.session.context({ sessionID: auditor.sessionID });
  const rawAudit = extractLastAssistantText(messages);
  const processAudit = parseProcessAuditText(rawAudit);
  const audit = store.recordAudit({
    missionID,
    taskID: "mission",
    kind: "process",
    status: processAudit.status,
    reviewerStaffID: auditor.staff.id,
    reviewerSessionID: auditor.sessionID,
    verdict: processAudit,
    notes: processAudit.summary,
  });
  const auditorReleased = await releaseSession(ctx, auditor.sessionID);
  store.addEvent(missionID, null, "session.released", {
    sessionID: auditor.sessionID,
    role: "process_auditor",
    released: auditorReleased,
  });

  return {
    audit,
    process_audit: processAudit,
    auditor: auditor.staff,
    auditor_session_id: auditor.sessionID,
    auditor_released: auditorReleased,
    cost: info.cost,
    tokens: info.tokens,
    raw_audit: rawAudit,
  };
}

export async function registerAuditTool(ctx: Plugin.Context, store: SquadStore) {
  return ctx.tool.transform((editor) => {
    editor.add({
      name: "audit",
      description:
        "Run a selective second review (or sample one integrated task) to detect a false pass. A failed audit returns the task and penalizes the first reviewer.",
      input: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["task", "sample", "process"] },
          mission_id: { type: "string" },
          task_id: { type: "string" },
          timeout_ms: { type: "number" },
        },
        required: ["action", "mission_id"],
        additionalProperties: false,
      },
      options: { namespace: "squad", codemode: true },
      execute: async (input, context) => {
        const args = (input ?? {}) as AuditInput;
        try {
          if (!args.mission_id) throw new Error("mission_id is required");
          const missionID = args.mission_id;
          await ctx.permission.assert({
            sessionID: context.sessionID,
            agent: context.agent,
            source: { type: "tool", messageID: context.messageID, id: context.id },
            action: "squad_audit",
            resources: [args.task_id ?? args.mission_id],
          });

          if (args.action === "process") {
            const result = await runProcessAudit(
              ctx,
              store,
              missionID,
              context.sessionID,
              args.timeout_ms ?? 300_000,
            );
            return ok(result);
          }

          if (args.action === "task") {
            if (!args.task_id) throw new Error("task_id is required");
            const result = await runTaskAudit(
              ctx,
              store,
              missionID,
              args.task_id,
              context.sessionID,
              args.timeout_ms ?? 300_000,
            );
            return ok(result);
          }

          const candidates = store
            .listTasks(missionID)
            .filter((task) => task.status === "integrated" && !store.hasAudit(missionID, task.id));
          if (candidates.length === 0) {
            return ok({ sampled: 0, message: "no unaudited integrated tasks" });
          }
          const target = candidates[Math.floor(Math.random() * candidates.length)]!;
          const result = await runTaskAudit(
            ctx,
            store,
            missionID,
            target.id,
            context.sessionID,
            args.timeout_ms ?? 300_000,
          );
          return ok({ sampled: 1, ...result });
        } catch (error) {
          return fail(error);
        }
      },
    });
  });
}
