# SQUAD — журнал разработки

> Старт: 14.11.2026
> Платформа: **OpenCode 2.3.0**
> API: `@opencode/plugin@2.3.0` · `@opencode/client@2.3.0`
> Текущая стадия: **M0.0 завершён · M0 server-side каркас в работе**

## Как ведётся журнал

- Каждая сессия разработки добавляет запись с датой и номером.
- Фиксируются: что сделано, какие команды запускались, что получено, что сломано и что дальше.
- Факты без проверки помечаются как «гипотеза»; проверенные — как «подтверждено».
- Ссылки на файлы и разделы `docs/PLAN.md` обязательны.

## Статус этапов

| Этап | Статус | Примечание |
|---|---|---|
| M0.0 Capability probe | ✅ завершён | probe-плагин и standalone probe работают |
| M0 Каркас + TUI + план-гейт | 🟡 в работе | server-side: SQLite, mission/plan/budget; TUI ещё нет |
| M1 Найм и работа | ⚪ не начат | — |
| M2 Ревизия и возврат | ⚪ не начат | — |
| M3 HR и карьера | ⚪ не начат | — |
| M4 Параллель и изоляция | ⚪ не начат | — |
| M5 Споры, арбитр, аудитор | ⚪ не начат | — |
| M6 Универсальные классы | ⚪ не начат | — |
| M7 Закалка | ⚪ не начат | — |

## Журнал

### 2026-11-14 · Сессия 1 — старт, M0.0 probe, M0 server-side

**Сделано**

- [x] Изучен `docs/PLAN.md` (v0.3), цель зафиксирована: мультиагентный плагин под OpenCode 2.3.0.
- [x] Проверен фундамент API: `@opencode/plugin@2.3.0`, `@opencode/client@2.3.0`, хост `opencode v2.3.0`.
- [x] Создан журнал разработки.
- [x] Каркас: `package.json`, `tsconfig.json`, `.gitignore`, `dev/opencode.jsonc`.
- [x] Плагин `src/index.ts` с `Plugin.define` и id `squad`.
- [x] `src/tools/status.ts` — `squad_status`, снимок Capability Registry.
- [x] `src/runtime/probe.ts` + `src/tools/probe.ts` — `squad_probe`: create child → prompt → wait → context/diff → interrupt → cleanup.
- [x] `scripts/probe-client.ts` — standalone probe через `@opencode/client` + `Service.ensure()`.
- [x] `scripts/smoke-store.ts` — проверка SQLite-потока mission → plan → approve → budget.
- [x] SQLite: `src/db/schema.ts` (migration 001), `src/db/index.ts`, `src/db/store.ts`.
- [x] M0 server-side tools: `squad_mission`, `squad_plan`, `squad_budget`.
- [x] Валидация плана: `src/plan.ts` (классы задач, грейды, acceptance, зависимости).
- [x] Typecheck проходит.

**Структура**

```text
src/
  index.ts              Plugin.define + регистрация tools
  version.ts            версия плагина
  config.ts             дефолтные грейды G0–G4, бюджет, пути
  plan.ts               типы и валидация MissionPlan
  runtime/probe.ts      M0.0 probe через Plugin.Context
  db/schema.ts          migration 001
  db/index.ts           openSquadDb + PRAGMA + миграции
  db/store.ts           SquadStore: missions/tasks/events/ledger
  tools/status.ts       squad_status
  tools/probe.ts        squad_probe
  tools/mission.ts      squad_mission
  tools/plan.ts         squad_plan
  tools/budget.ts       squad_budget
scripts/
  probe-client.ts       standalone API probe
  smoke-store.ts        SQLite smoke
dev/
  opencode.jsonc        локальная загрузка плагина из ..
```

**Команды и результаты**

| Команда | Результат |
|---|---|
| `bun install` | 267 packages installed, 15.77s |
| `bun run typecheck` | ✅ без ошибок |
| `bun run probe` | ✅ `ok:true`, child session создан, ответ `SQUAD_PROBE_OK`, cost `$0.000251`, tokens 1647/7, diff `[]` |
| `opencode run --standalone ... "Use squad_status"` | ✅ плагин `squad` active, tools `squad_status`/`squad_probe` зарегистрированы; registry: 163 models, 8 agents, 111 tools, 9 skills |
| `opencode run ... "Use squad_probe"` | ✅ `ok:true`, child `SES...`, ответ `SQUAD_PROBE_OK`, child удалён |
| `bun run scripts/smoke-store.ts` | ✅ mission `m_f73dc4d7`: draft → plan_gate → staffing, plan v1, budget expected `$0.01` |
| `opencode run ... mission/plan/budget` | ✅ mission `m_dcf6814e`: create → plan_gate → staffing; budget scope mission |

**Подтверждено**

- `session.create({ parentID, agent, model: { id, providerID, variant }, permissions })` работает в plugin context.
- `model.variant: "low"` реально выбирает DeepSeek Flash low; ответ пришёл за ~1.8 с, cost `$0.000251`.
- `ctx.session.wait({ sessionID })` корректно ждёт idle.
- `ctx.session.context` отдаёт assistant content; `SQUAD_PROBE_OK` извлечён.
- `ctx.session.get` отдаёт per-session `cost`/`tokens`.
- `ctx.vcs.diff({ mode: "working" })` работает; `ctx.session.diff` в plugin context отсутствует (client-only).
- `ctx.session.remove` удаляет child-сессию.
- SQLite `bun:sqlite` + WAL + миграция 001 работают в плагине.

**Найдено и исправлено**

1. `ctx.model.list()` / `ctx.agent.list()` / `ctx.skill.list()` / `ctx.plugin.list()` возвращают `{ data }`, а не массив. `squad_status` исправлен.
2. `squad_status` сначала печатал все 96 builtin-плагинов; теперь печатает только внешние + counts.
3. `squad_mission` не возвращал `mission_id` верхним уровнем; добавлен, чтобы модель могла цепочкой вызвать `squad_plan`.
4. `ctx.session.diff` отсутствует в `SessionDomain`; probe использует `ctx.vcs.diff`, PLAN §3/§3.1 исправлены.
5. `interrupt` после idle возвращает `{ interrupted: false }` — это ожидаемо; отдельный тест прерывания **работающей** сессии ещё нужен.

**Открытые вопросы**

- Нужен тест `interrupt` на реально работающей дочерней сессии (не после wait).
- TUI-панель M0 ещё не начата.
- `squad_status` в Code Mode возвращает JSON-строку; для цепочек удобнее `output`, но текущий контракт рабочий.
- Нужно решить, где хранить `.squad/squad.db`: project-local сейчас; для глобального штата между проектами — отдельный data-dir.

**Дальше**

1. Добавить тест прерывания работающей сессии.
2. Реализовать TUI-панель M0 (план, штат, расход).
3. Добавить `squad_hire` / `squad_assign` (M1) и ledger-запись из per-session cost/tokens.
4. Добавить unit-тесты для `validatePlan` и `SquadStore`.
5. `git init` и первый коммит после стабилизации каркаса.
