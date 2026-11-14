# Changelog

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
