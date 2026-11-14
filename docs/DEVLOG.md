# SQUAD — журнал разработки

> Старт: 14.11.2026
> Платформа: **OpenCode 2.3.0**
> API: `@opencode/plugin@2.3.0` · `@opencode/client@2.3.0`
> Текущая стадия: **M0.0 ✅ · M0 server-side ✅ · M0 TUI code ✅ · M1–M4 ✅ · M5 core ✅ · integration gate ✅**; TUI live check, M6 universal впереди

## Как ведётся журнал

- Каждая сессия разработки добавляет запись с датой и номером.
- Фиксируются: что сделано, какие команды запускались, что получено, что сломано и что дальше.
- Факты без проверки помечаются как «гипотеза»; проверенные — как «подтверждено».
- Ссылки на файлы и разделы `docs/PLAN.md` обязательны.

## Статус этапов

| Этап | Статус | Примечание |
|---|---|---|
| M0.0 Capability probe | ✅ завершён | probe-плагин и standalone probe работают |
| M0 Каркас + TUI + план-гейт | 🟡 TUI code ready | SQLite, mission/plan/budget, plan gate, TUI panel + `/squad` + RPC; live visual check не проведён |
| M1 Найм и работа | ✅ happy path | hire/assign/wait/check + ledger |
| M2 Ревизия и возврат | ✅ happy path | blind reviewer, verdict, rework, report |
| M3 HR и карьера | ✅ happy path | scorecard, appraise, fire+blacklist, career |
| M4 Параллель и изоляция | ✅ | worktree/DAG/finalize/radar/merge работают |
| M5 Споры, арбитр, аудитор | ✅ | disputes/arbiter/lessons, second-review + process auditor; audit gate enforced |
| M6 Универсальные классы | ⚪ не начат | — |
| M7 Закалка | ⚪ не начат | — |

## Журнал

### 2026-11-14 · Сессия 1 — старт, M0.0, M0 server-side

- [x] Изучен `docs/PLAN.md` (v0.3), цель: мультиагентный плагин под OpenCode 2.3.0.
- [x] Проверен фундамент API: `@opencode/plugin@2.3.0`, `@opencode/client@2.3.0`, хост `opencode v2.3.0`.
- [x] Каркас: `package.json`, `tsconfig.json`, `.gitignore`, `dev/opencode.jsonc`.
- [x] `src/index.ts` с `Plugin.define` и id `squad`.
- [x] `squad_status`, `squad_probe`, standalone probe, interrupt probe.
- [x] SQLite: migration 001, `openSquadDb`, `SquadStore`.
- [x] `squad_mission`, `squad_plan`, `squad_budget`; валидация плана.
- [x] Typecheck, live probe, interrupt probe, SQLite smoke.

### 2026-11-14 · Сессия 2 — M1: hire / assign / wait / check

- [x] Migration 002: assignment-колонки в `tasks`, model-колонки в `staff`.
- [x] `src/personas.ts`: 13 персон, default-грейды, agent mapping, access-политика.
- [x] `src/report.ts`: валидация Report.
- [x] `squad_hire`, `squad_staff`, `squad_assign`, `squad_wait`, `squad_check`.
- [x] Ledger из per-session cost/tokens; `maybeAdvanceMission`.
- [x] 15 unit-тестов.
- [x] Live M1: writer `s_c375538b` → отчёт `done`, ledger `$0.0023631`.

### 2026-11-14 · Сессия 3 — M2: blind review / verdict / rework / report

**Сделано**

- [x] Migration 003: reviewer-колонки в `tasks`.
- [x] `src/verdict.ts`: схема Verdict и правила pass/fail.
- [x] `src/json.ts`: устойчивый парсер последнего JSON-объекта.
- [x] `extractLastAssistantText`: только последний assistant-ответ (rework-сессии).
- [x] `squad_review`: авто-найм ревизора на грейд выше, blind prompt.
- [x] `squad_verdict`: wait, парсинг, ledger ревизора, pass/fail, rework limit.
- [x] `squad_report`: mission report + markdown.
- [x] `.opencode/agents/squad-reviewer.md`: blind-ревизор без инструментов, `steps: 2`.
- [x] 26 unit-тестов.

**Инцидент и исправление**

- Первый ревизор (persona `reviewer`, agent `explore`, G3 pro high) ушёл в цикл чтения/grep и не выдал JSON за ~8 минут; стоимость `$0.046034692`.
- Причина: ревизору были доступны инструменты и не было лимита шагов.
- Исправление: выделенный агент `squad-reviewer` с `permissions: * deny`, `steps: 2`, system prompt «no tools, JSON only». Повторный ревизор выдал verdict за ~2 секунды, стоимость `$0.00352968`.
- Зависшая сессия остановлена, стоимость записана в ledger через `scripts/recover-review.ts`.

**M2 live result**

- Mission `m_002859ec`: fail/high с 2 findings → task `returned` → rework (attempt 1, findings переданы) → фактический proof + artifact `dev/one-line-proof.txt` → pass/low → task `integrated` → mission `done`.
- Бюджет миссии: `$0.054835432` при ожидаемых `$0.01` (включая сбойный ревизор `$0.046`).

**Найденный баг**

- `extractAssistantText` склеивал отчёты двух заходов, `squad_check` не мог разобрать два JSON-объекта.
- Исправлено: `extractLastAssistantText` + `parseLastJsonObject` с выбором последнего валидного объекта. Покрыто тестами `messages` и `report`.

### 2026-11-14 · Сессия 4 — M3: HR / career

**Сделано**

- [x] Migration 004: `appraisals`, `blacklist`, `staff.fired_at/evidence_ref`.
- [x] `src/tools/appraise.ts`: score delta, clamp `[0,1]`, note.
- [x] `src/tools/fire.ts`: reason + evidence_ref обязательны, blacklist persona+grade на 30 дней, удаление сессии.
- [x] `src/tools/scorecard.ts`: pass@1, rework, timeout, cost efficiency, weighted score, recommendation.
- [x] `src/tools/career.ts`: evaluate/promote/demote.
- [x] `squad_hire` проверяет blacklist.
- [x] 26 unit-тестов (HR-кейс добавлен).

**M3 live result**

- Mission `m_8db5a38f`, scribe `s_4708e1b7` (G1):
  - appraise `+0.2` → score `0.2`;
  - scorecard: 0 tasks → `score 0.5`, `recommendation: insufficient_data`;
  - career evaluate → `applied: none`;
  - fire с `evidence_ref: dev/M3_PROMPT.md` → status `fired`, `blacklisted: true`;
  - повторный hire scribe/G1 → `Error: persona/grade is blacklisted: scribe/G1`.

### 2026-11-14 · Сессия 5 — M4: worktree, DAG, finalize gate, budget radar

**Сделано**

- [x] Migration 005: `staff.worktree_directory`.
- [x] `hireEmployee` создаёт worktree для write/shell-персон; reviewer остаётся в main.
- [x] `hire` возвращает `worktree_directory`; `fire` удаляет worktree.
- [x] `src/runtime/diff.ts`: per-task diff из worktree.
- [x] DAG: план с зависимостями создаёт `ready`/`pending`; `assignTask` проверяет зависимости; `advanceDependents` открывает следующие задачи.
- [x] `squad_tasks` — список задач и готовности.
- [x] `mission.integrating` + `squad_finalize` — глобальный гейт перед `done`.
- [x] `budgetSummary`: ratio, warnings 70/90 %, anomaly > 3×.
- [x] 28 unit-тестов (DAG + radar добавлены).

**M4 live result**

- Mission `m_e872b7f0`, implementer `s_d56ce7b4` (G2), worktree `C:\Users\XuViGaN\.local\share\opencode\worktree\5cec9b\squad-implementer-145026`.
- Worker создал и закоммитил `dev/m4-proof.txt` с `M4_OK`.
- `squad_check` вернул `source: git-worktree`, файл `dev/m4-proof.txt`, patch `+M4_OK`.
- Reviewer pass/low; task `integrated`; mission `integrating`; `squad_finalize` → `done`.
- Budget: `$0.010374` vs `$0.010000` expected; ratio 1.037; warnings 70/90; anomaly false.

**Ключевая находка**

- `ctx.vcs.diff({ location })` **игнорирует** location в plugin context (в client API — уважает).
- `ctx.session.diff` в runtime plugin context недоступен.
- `session.location` может показывать project root, а не worktree.
- Решение: для worktree читать `git diff HEAD^`/`git diff`/`git status` через `child_process`; для main — `ctx.vcs.diff`. Reviewer видит committed changes, а не пустой working tree.

### 2026-11-14 · Сессия 6 — M5: disputes, arbiter, audits, false-pass

**Сделано**

- [x] Migration 006: `disputes`, `dispute_messages`, `audits`, `lessons`.
- [x] `src/ruling.ts`: Ruling winner/reasoning/actions + parser.
- [x] `.opencode/agents/squad-arbiter.md`: arbiter без инструментов, steps 2, pro·max.
- [x] `squad_dispute`: open/reply/rule/list; до 2 раундов; арбитр читает claim, messages, brief, report, verdict, diff.
- [x] `squad_audit`: selective second review; задача должна быть integrated; false pass → task returned, reviewer −0.3, lesson.
- [x] `squad_report`: disputes, audits, lessons.
- [x] 34 unit-теста (ruling, dispute round limit, false pass).

**M5 live result**

- `squad_audit` task на `m_e872b7f0/t_001`: второй ревьюер `s_18904c07` (G3) получил worktree-diff, вернул `pass/low`; audit `a_ae53e211`; cost `$0.00154968`; mission осталась `done`.
- `squad_audit` process на `m_e872b7f0`: auditor `s_7f26bc62` (G2, no tools) вернул **fail** с 3 findings; audit `a_ca658396`; cost `$0.0042789`.
  - P1: second-review audit выполнен после `mission.done`.
  - P2: нет события merge/cherry-pick из detached-HEAD worktree в main.
  - P3: три раунда review использовали один `report.captured`, `attempts=0`.
- Disputes live не запускались (unit: open → 2 replies → round limit → ruling worker → task submitted, reviewer −0.2, lesson).

### 2026-11-14 · Сессия 7 — P1–P3 fixes + integration smoke

**Сделано**

- [x] Migration 007: `report_captured_at`, `merged_at`, `integration_commit`.
- [x] `squad_wait` фиксирует `report_captured_at`; `squad_review`/`squad_check` отклоняют stale report после rework.
- [x] `squad_finalize` требует:
  - все tasks integrated;
  - минимум `max(1, ceil(10% tasks))` second-review audit;
  - `merged_at` для каждого task с worktree.
- [x] `squad_integrate`: cherry-pick worktree HEAD в main, проверка чистоты main, abort при конфликте, запись `integration.merged`.
- [x] `markMerged` хранит **main cherry-pick commit** и source worktree commit.
- [x] 39 unit-тестов.

**M6 integration smoke**

- Mission `m_838c8066`, implementer `s_203ac0d8`, worktree `squad-implementer-a1eb2f`.
- Worker commit `40d5f8f4b03fa69f716b3095880fb1af4d6168d9`; main cherry-pick `77847d366e9b6bcc9cbcc381b0ced4fc8f231481`; `dev/m6-proof.txt` = `M6_OK`.
- Audit `a_ab232ed4`: second review pass/low.
- Finalize: mission `done`; budget `$0.006279988` vs `$0.020000` expected; ratio 0.314; no warnings.
- Events: `integration.merged` → `audit.passed` → `mission.done`.

**P1–P3 status**

- P1 (audit after done): fixed — finalize needs a second-review audit.
- P2 (no merge evidence): fixed — `squad_integrate` cherry-pick + `integration.merged` + `merged_at`.
- P3 (reused report capture): fixed — review/check reject a report captured before `assignedAt`; `squad_wait` records a fresh capture.

### 2026-11-14 · Сессия 8 — TUI panel + RPC

**Сделано**

- [x] `src/rpc.ts`: `SquadRpc` (`state`, `plan`), portable JSON Schema.
- [x] Server `ctx.rpc.register`; `rpcState` в `squad_status`.
- [x] `src/tui.tsx`: TUI plugin `squad.tui`, команда `/squad`, `session.panel` slot.
- [x] Панель: mission, status, plan v, cost, tasks, staff, audits, budget anomaly; polling 1.5s.
- [x] `a` approve · `r` reject · `escape` close; approve/reject через RPC.
- [x] `package.json` exports `./tui` и `./rpc`; peers `@opentui/core`, `@opentui/solid`, `solid-js`, `@opencode/theme`.
- [x] Установлены `@opentui/core@0.8.4`, `@opentui/solid@0.8.4`, `solid-js@1.9.19`, `@opencode/theme@2.3.0`.
- [x] 39 тестов, typecheck.

**Проверки**

- `squad_status` в standalone: `rpc.registered = true`.
- RPC `state` в shared service: `RPC is unavailable: squad`, пока plugin location не прогрет; TUI подключается к тому же серверу, где plugin загружен.
- Живой визуальный TUI-прогон (`/squad` → panel → approve) ещё не выполнен.

**Структура**

```text
src/
  index.ts              Plugin.define + 16 tools
  version.ts            0.2.0
  config.ts             грейды G0–G4, бюджет, пути
  plan.ts               MissionPlan + валидация
  report.ts             TaskReport + парсер
  verdict.ts            Verdict + pass/fail правила
  ruling.ts             Ruling арбитра + parser
  process-audit.ts      process audit schema/parser
  rpc.ts                SquadRpc state/plan contract
  tui.tsx               TUI plugin: /squad panel, approve/reject
  json.ts               последний JSON-объект
  personas.ts           персоны, грейды, agent mapping, permissions
  runtime/probe.ts      M0.0 probe
  runtime/hire.ts       общий hire helper + worktree
  runtime/messages.ts   assistant text + last assistant
  runtime/diff.ts       per-task diff: git-worktree / vcs
  runtime/integrate.ts  cherry-pick worktree → main
  db/schema.ts          migrations 001–007
  db/index.ts           openSquadDb + WAL + миграции
  db/store.ts           missions/tasks/staff/events/ledger/appraisals/blacklist/disputes/audits/lessons
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
  tools/review.ts       squad_review
  tools/verdict.ts      squad_verdict
  tools/report.ts       squad_report
  tools/appraise.ts     squad_appraise
  tools/fire.ts         squad_fire
  tools/scorecard.ts    squad_scorecard
  tools/career.ts       squad_career
  tools/tasks.ts        squad_tasks
  tools/finalize.ts     squad_finalize
  tools/dispute.ts      squad_dispute
  tools/audit.ts        squad_audit
  tools/integrate.ts    squad_integrate
.opencode/agents/
  squad-reviewer.md     blind reviewer, no tools, steps 2
  squad-arbiter.md      arbiter, no tools, steps 2
  squad-auditor.md      process auditor, no tools, steps 2
dev/
  opencode.jsonc        локальная загрузка плагина
  M1_PROMPT.md          M1 smoke
  M2_PROMPT.md          M2 smoke
  M2_REWORK.md          M2 rework smoke
  M3_PROMPT.md          M3 smoke
  M4_PROMPT.md          M4 smoke
  M4_CONTINUE.md        M4 diff continuation
  M4_DIAG.md            M4 diff diagnostic
  M4_FINAL.md           M4 final gate
  M5_PROMPT.md          M5 audit smoke
  M5_PROCESS.md         M5 process audit smoke
  M6_PROMPT.md          M6 integration smoke
  one-line-proof.txt    artifact M2
  m6-proof.txt          artifact M6 (merged to main)
scripts/
  probe-client.ts
  probe-interrupt.ts
  smoke-store.ts
  inspect.ts
  session-inspect.ts
  session-dump.ts
  recover-review.ts
  rpc-state.ts
tests/
  plan.test.ts
  report.test.ts
  verdict.test.ts
  ruling.test.ts
  process-audit.test.ts
  messages.test.ts
  store.test.ts
```

**Проверки**

| Команда/сценарий | Результат |
|---|---|
| `bun run typecheck` | ✅ без ошибок |
| `bun test` | ✅ 39 pass, 0 fail, 99 expect |
| `bun run probe` | ✅ `SQUAD_PROBE_OK`, cost `$0.000251` |
| `bun run probe:interrupt` | ✅ `interrupted:true` |
| M1 live | ✅ writer report `done`, ledger `$0.0023631` |
| M2 live | ✅ fail → rework → pass → integrated → mission `done` |
| M3 live | ✅ appraise/fire/blacklist; повторный hire отклонён |
| M4 live | ✅ worktree `squad-implementer-145026`, git-diff `dev/m4-proof.txt`, pass, mission `done`, budget `$0.010374` |
| M5 audit live | ✅ second review `pass/low`, audit `a_ae53e211`, cost `$0.00154968` |
| M5 process audit live | ❌ fail с 3 findings: audit after done, no merge event, one report capture across 3 rounds; cost `$0.0042789` |
| M6 integration smoke | ✅ worker `40d5f8f` → main `77847d3`, audit pass, mission `done`, budget `$0.00628` |
| RPC registration | ✅ `squad_status.rpc.registered = true` в standalone |
| TUI live panel | ⚪ не проведён: `/squad`, approve/reject, visual |

**Найдено и исправлено**

1. `ctx.model.list()` и родственные возвращают `{ data }`, не массив.
2. `ctx.session.diff` отсутствует в plugin context; используется `ctx.vcs.diff`.
3. Ревизор с инструментами уходил в цикл; заменён на no-tools `squad-reviewer`.
4. Rework-сессия склеивала два отчёта; исправлено last-assistant + robust JSON.
5. `squad_check` при ошибке парсинга не останавливает workflow — smoke продолжился; в реальном боссе это должен быть жёсткий стоп.
6. `squad_status` слишком многословен; оставлены counts + внешние плагины.
7. `interrupt` после idle — no-op; отдельный running-interrupt probe проходит.
8. `ctx.vcs.diff({ location })` игнорирует location, `ctx.session.diff` недоступен; worktree-diff читается через git (`HEAD^` + working), reviewer видит committed changes.
9. Second review использует того же no-tools reviewer и worktree-diff; false pass возвращает task и штрафует первого ревизора.
10. Dispute round limit 2 enforced; arbiter получает только claim/messages/brief/report/verdict/diff.
11. Process auditor без инструментов нашёл реальные дефекты: audit после `done`, отсутствие merge-события, повторный review одного capture.

**Открытые вопросы**

- TUI panel code готов, но живой визуальный прогон `/squad` → approve/reject ещё не выполнен.
- RPC `state` в shared service был недоступен, пока plugin location не прогрет; TUI использует тот же сервер, где plugin загружен.
- Dispute `rule` live-тест не проведён (unit-тест покрывает).
- 10% sampling реализован как случайный выбор одной unaudited integrated task.
- Нет live-теста timeout-пути `squad_wait` с зависшим сотрудником.
- Параллельный найм технически возможен, но stress-тест 3+ задач не проводился.
- Worktree source commit остаётся detached; main получает cherry-pick commit.
- `.squad/squad.db` project-local.
- Git: `a077ca5` (docs P1–P3); TUI — следующий коммит.

**Дальше**

1. **Live TUI check** — `/squad`, panel render, approve/reject, reload.
2. **M6 universal classes** — research/writing/design/data/ops/creative + скиллы/MCP.
3. Live dispute rule + stress-тест 3 параллельных задач.
4. Live-тест timeout + замена зависшего сотрудника.
5. Budget/TUI-интеграция и аудит процесса по расписанию.
