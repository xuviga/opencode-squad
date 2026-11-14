# Changelog

## 0.9.2 — 2026-11-14

- **Reviewer contract tightened**: a `fail` requires severity `high` or `critical` and an unmet acceptance criterion, missing/faked deliverable, or a correctness/security/data-loss defect. Style, naming, formatting and documentation polish are `pass` with findings. Validation rejects low/medium fails.
- **Late false-pass guard**: if a second-review audit fails a task whose dependents are already integrated, the task stays integrated and the mission becomes `failed` (event `audit.late_false_pass`) instead of corrupting a shipped chain.
- **In-place folder lock**: `.squad/locks/inplace.json` gives one in-place mission exclusive ownership of a directory; approve acquires, finalize/cancel release, terminal or 2h-stale holders are evicted.
- **Worker budget**: briefs carry `tool_call_budget` (research 10, others 20), a stop policy and a research batching rule; the prompt states the hard budget.
- **Mission command**: `/mission` now plans minimal dependency edges (independent tasks run in parallel), prefers G1 for collection, starts all ready tasks per wave with parallel `squad_wait`, and reports progress per wave.
- 98 tests.

## 0.9.1 — 2026-11-14

- **Fixed silent file loss in snapshot diffs**: `snapshotDiff` used to drop every changed file once the total patch budget was exhausted, so late-alphabet paths (`scripts/*`) never reached the reviewer. Every changed file is now listed; the patch budget is shared, exhausted files keep a header with `patch: ""` and appear in `trimmedFiles`.
- **Fixed prompt slicing**: `review`, `audit` and `dispute` cut the diff JSON at 24 000 chars. Replaced with `formatDiffForPrompt` (120 000-char budget) which keeps every file header and marks partial patches.
- **Reviewer rule**: partial/trimmed files are unverified, not unchanged; the verdict must name them.
- Tests: 88.

## 0.9.0 — 2026-11-14

- **In-place isolation**: `squad_mission { isolation: "none" }` runs employees directly in the project folder, no git required. Migration 009 adds `missions.isolation` and `tasks.snapshot_directory`.
- **Snapshot review**: before a task starts, `squad_assign` captures a text-file snapshot (sha256 manifest + copies, skips `node_modules/.git/dist/...`); `taskDiff` returns a per-file added/modified/deleted diff with line patches. Binary and large files are flagged, not inlined.
- **Class-aware checks**: in-place code tasks pass with `diff + acceptance` instead of `diff + tests`; worktree missions unchanged.
- **Integration/finalize/audit**: `squad_integrate` marks tasks merged in place; `squad_finalize` and `squad_audit` skip commit-ancestry checks for in-place missions and keep them for worktree missions.
- **Preflight**: `squad_mission create` with `worktree` in a non-git folder fails with an actionable message; `squad_status` exposes `isolation.worktreeAvailable`.
- 29 tools, 86 tests.

## 0.8.0 — 2026-11-14

- **P1 worktree lifecycle**: `squad_integrate` removes the worktree after a successful cherry-pick and clears `staff.worktree_directory`; `squad_cancel` force-removes aborted worktrees; `squad_finalize` sweeps the mission worktrees. Diffs for post-integration review are reconstructed from the integration commit.
- **P2 janitor**: new `squad_gc` (`scan`/`apply`) reports and closes stale non-terminal missions and orphaned worktrees; `squad_status` exposes `staleMissions` + `staleAfterMinutes` (default 120).
- **P3 store split**: `store.ts` is now a ~300-line facade; mission/task/staff/ledger/dispute/audit/event logic lives in `src/db/repositories/*`. Public API unchanged.
- **P4 CI + lint**: Biome 2.6 (`bun run lint`) and GitHub Actions (`typecheck` → `lint` → `test`); `bun run verify`.
- **P5 integration evidence**: `squad_audit` fails deterministically when an integrated task has no commit or its commit is not an ancestor of main; `squad_finalize` applies the same gate; process audit receives `process_checks` and flags review rounds without rework.
- 29 tools, 77 tests. Cleanup executed on this repo: 17 stale worktrees removed (11 unmerged commits preserved as `refs/squad-archive/*`), 7 zombie missions aborted in `dev/.squad`.

## 0.7.0 — 2026-11-14

- TUI live automation on real PTY: `/squad`, panel render, reject → resubmit → approve, SQLite status checks.
- TUI part loading documented: global `cli.json` for the TUI, project `opencode.jsonc` for the server.
- RPC `state` JSON sanitization; TUI unwraps `{data}` responses.
- `squad_image` `engine:"vector"`: DeepSeek generates SVG, resvg rasterizes to PNG without an image model.
- Chaos: crashed worker → task failed (not timeout), ledger + interrupt; duplicate review/verdict rejected.
- 62 tests, 28 tools.

## 0.6.0 — 2026-11-14

- `squad_preview`: локальный SVG → PNG через `@resvg/resvg-js`, без image-модели.
- `squad_look`: DeepSeek получает изображение вложением и отвечает по нему; cost пишется в ledger.
- `squad_review` / `squad_audit` автоматически прикрепляют PNG из отчёта или рендерят preview SVG для design-задач.
- Подтверждено: `deepseek-flash` видит PNG и читает текст, палитру и структуру.
- 59 тестов, 28 инструментов.

## 0.5.1 — 2026-11-14

- `squad_wait` автоматически коммитит грязный worktree после отчёта (writer/designer без shell).
- `taskDiff` отдаёт `worktree.head/subject/dirty`; review/audit не верят устаревшему worker report.
- Design class live на official DeepSeek: `m_2e72a622`, editable SVG 1200×1600, review + audit pass.
- Dispute `d_c9b37768`: arbiter отменил ложный fail (worker), повторная ревизия pass.
- 57 тестов.

## 0.5.0 — 2026-11-14

- M6: 10 шаблонов классов, `squad_template`, capabilities `skill:`/`mcp:`/`tool:`, `squad_capabilities`.
- Class-aware verdict: `code/data/ops` → `diff+tests`; остальные → `acceptance+evidence`.
- `squad_image` через `experimental.generate.image`.
- `squad_cancel`, API drift contract, TUI wiring test, README.
- 3-параллельный stress `m_a5669cde`; cherry-pick conflict `abort|theirs` `m_ad1af5b1`.
- 26 инструментов.

## 0.4.0 — 2026-11-14

- TUI panel `/squad`, RPC `state`/`plan`.
- Worktree isolation fix: `session.move` + bounded polling.
- `squad_integrate` strategy `abort|theirs`; blind review commit metadata.
- M4 worktree/DAG/finalize/budget radar.
