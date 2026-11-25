# Roadmap

The roadmap is short because the project is one plugin with a fixed shape: a
state machine, a store, and a set of tools that may not outrun it. Anything
that cannot be expressed as a guarded transition does not go in.

## Shipped

- **0.9.7** — the report moves the task: `blocked` becomes a task state
  without spending rework, `failed` fails the task, `done` submits it (issue
  [#2](https://github.com/xuviga/opencode-squad/issues/2)).
- **0.9.6** — in-place attribution: a folder-wide diff is attributed using
  every concurrent task's allowlist; unclaimed files fail the task, and the
  guarantee is downgraded to advisory (with an event) when a concurrent writer
  declared no paths (issue
  [#5](https://github.com/xuviga/opencode-squad/issues/5)).
- **0.9.5** — scope enforcement in worktree missions: `squad_wait` fails a task
  whose diff touches a file outside `paths` (`task.scope_violation`), before a
  reviewer is hired (issue [#3](https://github.com/xuviga/opencode-squad/issues/3)).
- **0.9.4** — scoped review: a task can declare `paths`, and the diff is split
  into files it owns and files changed by sibling work, so an in-place folder
  diff no longer produces false scope failures.
- **0.9.4** — delivery metrics: pass@1, rework rate, failures, disputes and
  cost per integrated task computed from task rows and the ledger and printed
  by `squad_report` (issue
  [#4](https://github.com/xuviga/opencode-squad/issues/4)).
- **0.9.4** — reliability: one shared SQLite handle per project survives plugin
  reloads, and `squad_mission create` probes the worktree capability before a
  mission exists.

## Now (0.9.x)

- Keep the reviewer contract honest: a pass must name the checks its class
  requires, and a fail must clear the severity floor.
- Keep `README.md`, `docs/PLAN.md` and the real tool surface in sync. Every
  release ships with a checked `bun run verify` line and the test count.

## Next (0.10)

- **Per-task write locks.** Attribution (0.9.6) tells the truth after the
  fact; locks would refuse the conflict at assign time. Useful when two tasks
  legitimately need the same directory.
- **Configuration file.** `SquadConfig` is live but lives in code. A
  `.squad/config.json` (grades, budgets, rework limit, stale window) with
  validation and a documented precedence order.
- **Scheduled janitor.** `squad_gc` exists but only runs by hand. A host-level
  interval that scans and reports stale missions.
- **Spend guardrails in the TUI.** The ledger has the numbers; the panel does
  not show them.

## Later

- **Secret filtering and prompt-injection wrapping** for worker briefs. Prompts
  are not a boundary; this needs a real one.
- **Per-task image generation** on a provider that actually has an image model.
  Today `engine:"vector"` is the only path that works without one.
- **A second isolation mode**: copy-on-write workspace instead of git worktree,
  for repositories too large to check out twice.

## Not planned

- Replacing human responsibility. SQUAD proves a process, not correctness.
- A hard guarantee that a worker did not leak a file it was allowed to read.
- Rewriting history so a failed integration looks clean. A rolled-back batch
  leaves a trace, and that is the point.
