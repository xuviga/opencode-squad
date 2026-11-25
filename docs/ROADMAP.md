# Roadmap

The roadmap is short because the project is one plugin with a fixed shape: a
state machine, a store, and a set of tools that may not outrun it. Anything
that cannot be expressed as a guarded transition does not go in.

## Now (0.9.x)

- Keep the reviewer contract honest: a pass must name the checks its class
  requires, and a fail must clear the severity floor.
- Close the remaining holes in the report flow: `report.status` is validated
  and stored, but it still does not move a task. Either map `blocked`/`failed`
  to a task state or drop the field.
- Keep `README.md`, `docs/PLAN.md` and the real tool surface in sync. Every
  release ships with a checked `bun run verify` line and the test count.

## Next (0.10)

- **Configuration file.** `SquadConfig` is live but lives in code. A
  `.squad/config.json` (grades, budgets, rework limit, stale window) with
  validation and a documented precedence order.
- **Scheduled janitor.** `squad_gc` exists but only runs by hand. A host-level
  interval that scans and reports stale missions.
- **Spend guardrails in the TUI.** The ledger has the numbers; the panel does
  not show them.
- **Release discipline.** Tags for every changelog entry, release notes from
  `docs/releases/`, and a `verify` run recorded in each release.

## Later

- **Path allowlists and secret filtering** for worker briefs. Prompts are not a
  boundary; this needs a real one.
- **Per-task image generation** on a provider that actually has an image model.
  Today `engine:"vector"` is the only path that works without one.
- **Metrics that mean something**: pass@1, rework rate, disputes per mission,
  cost per delivered task — collected automatically, not by hand.
- **A second isolation mode**: copy-on-write workspace instead of git worktree,
  for repositories too large to check out twice.

## Not planned

- Replacing human responsibility. SQUAD proves a process, not correctness.
- A hard guarantee that a worker did not leak a file it was allowed to read.
- Rewriting history so a failed integration looks clean. A rolled-back batch
  leaves a trace, and that is the point.
