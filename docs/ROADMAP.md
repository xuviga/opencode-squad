# Roadmap

The roadmap is short because the project is one plugin with a fixed shape: a
state machine, a store, and a set of tools that may not outrun it. Anything
that cannot be expressed as a guarded transition does not go in.

## Shipped

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
- Close the remaining holes in the report flow: `report.status` is validated
  and stored, but it still does not move a task. Either map `blocked`/`failed`
  to a task state or drop the field — tracked in
  [#2](https://github.com/xuviga/opencode-squad/issues/2).
- Keep `README.md`, `docs/PLAN.md` and the real tool surface in sync. Every
  release ships with a checked `bun run verify` line and the test count.

## Next (0.10)

- **Attribute in-place writes.** The allowlist is enforced in worktree
  missions; in `isolation:"none"` a folder-wide snapshot diff cannot say who
  wrote a file. Per-task file locks or a pre-report ownership check would make
  the same guarantee hold without git.
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
