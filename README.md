# SQUAD

Мульти-агентный оркестратор для **OpenCode 2.3.0**: босс планирует миссию, нанимает сотрудников, проводит слепую ревизию, разрешает споры и сливает работу в main через изолированные worktree.

Текущая версия: **0.5.1** · 26 инструментов · 57 тестов.

## Что внутри

- **Планирование**: `squad_mission` → `squad_plan` (план-гейт approve/reject) → `squad_budget`.
- **Найм и работа**: `squad_hire`, `squad_staff`, `squad_assign`, `squad_wait`, `squad_check`.
- **Слепая ревизия**: `squad_review` нанимает ревизора на грейд выше, `squad_verdict` применяет pass/fail; rework ≤ 2.
- **HR**: `squad_appraise`, `squad_fire` (только с evidence + 30-дневный blacklist), `squad_scorecard`, `squad_career`.
- **Параллель и изоляция**: worktree на писателя, DAG задач, `squad_integrate` (cherry-pick, `strategy: abort|theirs`), `squad_finalize`.
- **Споры и аудит**: `squad_dispute` (open/reply/rule, арбитр pro·max), `squad_audit` (вторая ревизия + process auditor), `squad_cancel`.
- **TUI**: команда `/squad` и панель `session.panel` с approve/reject, статусом миссии, штатом и расходом.
- **Универсальные классы**: `code`, `research`, `writing`, `design`, `data`, `ops`, `review`, `planning`, `creative`, `mixed` через `squad_template`.
- **Capabilities**: `skill:<id>`, `mcp:<server>`, `tool:<name>`; `squad_capabilities` проверяет доступность, `squad_assign` прикрепляет скиллы и передаёт guidance.
- **Картинки**: `squad_image` через `experimental.generate.image`, файлы в `.squad/artifacts`, cost в ledger.

## Установка

Плагин подключается как локальный пакет:

```jsonc
// opencode.jsonc
{
  "plugins": ["D:/path/to/opencode-squad"]
}
```

Требования:

- OpenCode `2.3.0`;
- Bun;
- `@opencode/plugin` `2.3.0` (exact pin);
- для TUI-панели — `@opentui/core`, `@opentui/solid`, `solid-js`, `@opencode/theme`.

## Быстрый старт

```text
squad_mission { action: "create", title: "Fix pagination", goal: "..." }
squad_template { action: "build", class: "code", goal: "..." }
squad_plan { action: "submit", mission_id, plan }
squad_plan { action: "approve", mission_id }
squad_hire { mission_id, persona: "implementer", grade: "G2" }
squad_assign { mission_id, task_id, staff_id, context: [...] }
squad_wait { mission_id, task_id, timeout_ms: 300000 }
squad_review { mission_id, task_id }
squad_verdict { mission_id, task_id }
squad_integrate { mission_id }
squad_audit { action: "sample", mission_id }
squad_finalize { mission_id }
```

Для TUI: откройте сессию и введите `/squad`. Панель: `a` — approve, `r` — reject, `escape` — close.

## Гарантии

- Писатель работает в отдельном worktree; сессия принудительно перемещается туда (`session.move`) с проверкой фактического каталога. При несовпадении hire падает fail-closed.
- Публикация `pass` возможна только от слепого ревизора без инструментов.
- `squad_finalize` требует: все задачи `integrated`, ≥ `max(1, ceil(10% задач))` вторых ревизий, все worktree-задачи слиты.
- `squad_wait` автоматически коммитит грязный worktree после отчёта воркера, поэтому writer/designer без shell всё равно интегрируются; при ошибке коммита задача падает fail-closed.
- `squad_integrate` отказывается работать на грязном main; при конфликте `abort` оставляет main чистым, `theirs` разрешает конфликт в пользу воркера и фиксирует strategy.
- Ревизор для code-like классов обязан проверить `diff+tests`; для research/writing/design — `acceptance+evidence`.
- Увольнение и понижение требуют записанного основания.

## Структура

```text
src/
  index.ts          Plugin.define + 26 tools + RPC
  plan.ts           MissionPlan + валидация
  classes.ts        шаблоны классов
  capabilities.ts   резолв skill/mcp/tool
  rpc.ts            SquadRpc state/plan
  tui.tsx           TUI plugin /squad
  db/               SQLite, migrations 001–008, store
  runtime/          hire, diff, integrate, probe, messages
  tools/            26 инструментов
.opencode/agents/   squad-reviewer, squad-arbiter, squad-auditor (no tools)
tests/              unit/integration/contract
docs/PLAN.md        архитектура и этапы
docs/DEVLOG.md      журнал разработки и живые прогоны
```

## Проверка

```bash
bun run typecheck
bun test
```

Живые прогоны и известные ограничения — в `docs/DEVLOG.md`.

## Ограничения

- `squad_image` требует валидный ключ провайдера image-модели; авто-выбор image-модели зависит от `ctx.model.list()`. Official DeepSeek image-моделей не предоставляет, поэтому design-класс проверен на editable SVG (без raster API).
- Живой визуальный TUI-прогон под TTY не автоматизирован; wiring покрыт unit-тестом.
- `session.wait` ждёт model work, но не `session.shell`; timeout-ветка покрыта unit-тестом с fake session.
- `.squad/squad.db` хранится в проекте; для нескольких проектов — своя БД на проект.
