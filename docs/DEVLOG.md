# SQUAD — журнал разработки

> Старт: 14.11.2026
> Платформа: **OpenCode 2.3.0**
> API: `@opencode/plugin@2.3.0` · `@opencode/client@2.3.0`
> Текущая стадия: **M0.0 ✅ · M0 server-side ✅ · M1 happy path ✅**; TUI и M2 впереди

## Как ведётся журнал

- Каждая сессия разработки добавляет запись с датой и номером.
- Фиксируются: что сделано, какие команды запускались, что получено, что сломано и что дальше.
- Факты без проверки помечаются как «гипотеза»; проверенные — как «подтверждено».
- Ссылки на файлы и разделы `docs/PLAN.md` обязательны.

## Статус этапов

| Этап | Статус | Примечание |
|---|---|---|
| M0.0 Capability probe | ✅ завершён | probe-плагин и standalone probe работают |
| M0 Каркас + TUI + план-гейт | 🟡 server-side готов | SQLite, mission/plan/budget, план-гейт; TUI нет |
| M1 Найм и работа | 🟡 happy path готов | hire/assign/wait/check; timeout live test и замена — частично |
| M2 Ревизия и возврат | ⚪ не начат | следующий приоритет |
| M3 HR и карьера | ⚪ не начат | — |
| M4 Параллель и изоляция | ⚪ не начат | — |
| M5 Споры, арбитр, аудитор | ⚪ не начат | — |
| M6 Универсальные классы | ⚪ не начат | — |
| M7 Закалка | ⚪ не начат | — |

## Журнал

### 2026-11-14 · Сессия 1 — старт, M0.0, M0 server-side

**Сделано**

- [x] Изучен `docs/PLAN.md` (v0.3), цель: мультиагентный плагин под OpenCode 2.3.0.
- [x] Проверен фундамент API: `@opencode/plugin@2.3.0`, `@opencode/client@2.3.0`, хост `opencode v2.3.0`.
- [x] Создан журнал разработки.
- [x] Каркас: `package.json`, `tsconfig.json`, `.gitignore`, `dev/opencode.jsonc`.
- [x] Плагин `src/index.ts` с `Plugin.define` и id `squad`.
- [x] `squad_status` — снимок Capability Registry.
- [x] `squad_probe` — create child → prompt → wait → context/diff → interrupt → cleanup.
- [x] `scripts/probe-client.ts`, `scripts/probe-interrupt.ts`.
- [x] SQLite: migration 001, `openSquadDb`, `SquadStore`.
- [x] `squad_mission`, `squad_plan`, `squad_budget`; валидация плана.
- [x] Typecheck, live probe, interrupt probe, SQLite smoke.

### 2026-11-14 · Сессия 2 — M1: hire / assign / wait / check

**Сделано**

- [x] Migration 002: assignment-колонки в `tasks`, model-колонки в `staff`.
- [x] `src/personas.ts`: 13 персон, default-грейды, agent mapping, access-политика.
- [x] `src/report.ts`: валидация Report и извлечение JSON из markdown-обёртки.
- [x] `squad_hire` — child-сессия + staff-запись; grade → model/variant; permissions по access.
- [x] `squad_staff` — list/get.
- [x] `squad_assign` — Task Brief, prompt сотруднику, task `assigned → running`.
- [x] `squad_wait` — wait, raw report, ledger из per-session cost/tokens, task `submitted`.
- [x] `squad_check` — валидация Report, задача `submitted`, diff.
- [x] `maybeAdvanceMission`: все задачи submitted → mission `reviewing`.
- [x] 15 unit-тестов: `validatePlan`, `validateReport`, `SquadStore`.
- [x] Версия плагина `0.2.0`.

**Структура**

```text
src/
  index.ts              Plugin.define + регистрация tools
  version.ts            версия 0.2.0
  config.ts             грейды G0–G4, бюджет, пути
  plan.ts               MissionPlan + валидация
  report.ts             TaskReport + парсер
  personas.ts           персоны, грейды, agent mapping, permissions
  runtime/probe.ts      M0.0 probe
  runtime/messages.ts   извлечение assistant text
  db/schema.ts          migrations 001 + 002
  db/index.ts           openSquadDb + WAL + миграции
  db/store.ts           missions/tasks/staff/events/ledger
  tools/status.ts       squad_status
  tools/probe.ts        squad_probe
  tools/mission.ts      squad_mission
  tools/plan.ts         squad_plan
  tools/budget.ts       squad_budget
  tools/hire.ts         squad_hire
  tools/staff.ts        squad_staff
  tools/assign.ts       squad_assign
  tools/wait.ts         squad_wait
  tools/check.ts        squad_check
scripts/
  probe-client.ts       standalone API probe
  probe-interrupt.ts    interrupt работающей сессии
  smoke-store.ts        SQLite smoke + ledger
  inspect.ts            inspect mission/tasks/staff/budget
dev/
  opencode.jsonc        локальная загрузка плагина
  M1_PROMPT.md          воспроизводимый M1 smoke
tests/
  plan.test.ts
  report.test.ts
  store.test.ts
```

**Проверки**

| Команда | Результат |
|---|---|
| `bun run typecheck` | ✅ без ошибок |
| `bun test` | ✅ 15 pass, 0 fail, 36 expect |
| `bun run probe` | ✅ `SQUAD_PROBE_OK`, child session, cost `$0.000251` |
| `bun run probe:interrupt` | ✅ `interrupted:true`, outcome `interrupted` |
| `bun run smoke:store` | ✅ mission → plan_gate → staffing, ledger 1 entry, actual `$0.00025` |
| M1 live: mission/plan/approve/hire/assign/wait/check | ✅ полный цикл, report `done`, ledger `$0.0023631` |

**M1 live result**

- Mission `m_002859ec`: `draft → plan_gate → staffing → executing → reviewing`.
- Staff `s_c375538b`: persona `writer`, grade `G2`, agent `build`, model `deepseek-flash#high`, session `ses_e2698773cffedh70LPQPCcco3A`.
- Worker report: `status:"done"`, summary про доказательство иррациональности √2.
- Usage: cost `$0.0023631`, tokens input 14466 / output 124 / reasoning 198.
- `squad_check`: report валиден, diff получен, task `submitted`.
- `maybeAdvanceMission` перевёл миссию в `reviewing` после единственной submitted-задачи.

**Найдено и исправлено**

1. `ctx.model.list()` / `ctx.agent.list()` / `ctx.skill.list()` / `ctx.plugin.list()` возвращают `{ data }`, а не массив. `squad_status` исправлен.
2. `squad_status` печатал все 96 builtin-плагинов; теперь только counts + внешние.
3. `squad_mission` не возвращал `mission_id` верхним уровнем; добавлен для цепочек.
4. `ctx.session.diff` отсутствует в `SessionDomain`; probe/check используют `ctx.vcs.diff`, PLAN §3/§3.1 исправлены.
5. `squad_wait` после idle записывает ledger ровно один раз (`hasLedgerEntry`).
6. `squad_assign` при ошибке prompt помечает task `failed`, чтобы можно было переназначить.
7. `saveRawReport` теперь переводит task в `submitted` и вызывает `maybeAdvanceMission`.

**Открытые вопросы**

- TUI-панель M0 ещё не начата.
- Timeout-путь `squad_wait` реализован, но live-тест с зависшим сотрудником ещё не сделан; замена проверена unit-тестом store.
- `ctx.vcs.diff` даёт diff всего проекта, не per-task; для изоляции нужен worktree (M4).
- `squad_status` в Code Mode возвращает JSON-строку; для цепочек удобнее `output`.
- `.squad/squad.db` project-local; для глобального штата между проектами нужен отдельный data-dir.
- Git: initial commit `5cec9b7`; коммиты M1 — после стабилизации.

**Дальше**

1. **M2** — `squad_review`, `squad_verdict`, rework ≤2, blind-ревизор, `squad_report`.
2. **TUI-панель M0** — план, штат, расход, approve/edit/reject.
3. Live-тест timeout + замена зависшего сотрудника.
4. Worktree-изоляция для писателей (M4) и per-task diff.
5. Коммит M1 и обновление PLAN §15 (фактические статусы).
