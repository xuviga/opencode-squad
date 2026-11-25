# Roadmap

The roadmap is short because the project is one plugin with a fixed shape: a
state machine, a store, and a set of tools that may not outrun it. Anything
that cannot be expressed as a guarded transition does not go in.

## Shipped

- **0.10.0** — write locks in in-place missions, `.squad/config.json`,
  scheduled janitor, budget/metrics in the TUI panel, `squad_image`
  `engine:"auto"`.
- **0.9.7** — the report moves the task: `blocked` becomes a task state
  without spending rework, `failed` fails the task, `done` submits it.
- **0.9.6** — in-place attribution: a folder-wide diff is attributed using
  every concurrent task's allowlist; unclaimed files fail the task, and the
  guarantee is downgraded to advisory (with an event) when a concurrent writer
  declared no paths.
- **0.9.5** — scope enforcement in worktree missions: `squad_wait` fails a task
  whose diff touches a file outside `paths`.
- **0.9.4** — shared SQLite handle that survives plugin reloads, worktree
  capability probe, per-task `paths` with a scoped diff, delivery metrics.

## Now (0.10.x)

- Keep the reviewer contract honest: a pass must name the checks its class
  requires, and a fail must clear the severity floor.
- Keep `README.md`, `docs/PLAN.md` and the real tool surface in sync. Every
  release ships with a checked `bun run verify` line and the test count.

## Next (0.11)

- **Hot config reload.** `.squad/config.json` is read at plugin start; changing
  a limit currently needs `opencode service restart`.
- **Secret filtering and prompt-injection wrapping** for worker briefs.
  Permissions are the boundary today; a prompt is not one.
- **Scheduled process audit.** `squad_audit action=process` exists but nobody
  schedules it; the janitor could request one when a mission ends with
  suspicious review rounds.
- **TUI actions.** The panel approves and rejects a plan; it cannot assign,
  review or cancel.

## Later

- **A real image model.** `engine:"auto"` works everywhere by falling back to
  SVG, but a provider with an image model produces better bitmap art.
- **A second isolation mode**: copy-on-write workspace instead of git worktree,
  for repositories too large to check out twice.
- **Glob-aware locks.** Overlap uses literal prefixes, so `src/**` and
  `docs/**` are disjoint but `src/**` and `src/a/*.ts` are conservatively
  treated as overlapping.

## Not planned

- Replacing human responsibility. SQUAD proves a process, not correctness.
- A hard guarantee that a worker did not leak a file it was allowed to read.
- Rewriting history so a failed integration looks clean. A rolled-back batch
  leaves a trace, and that is the point.
