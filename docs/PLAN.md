# SQUAD — архитектура и состояние

> Документ: **1.3** · 25.11.2026
> Код: **0.9.5** (`master`)
> Платформа: **OpenCode 2.4.1** · `@opencode/plugin@2.4.1` · `@opencode/client@2.4.1`
> Проверка: `bun run verify` — typecheck, biome, **117 тестов в 24 файлах**, 0 fail.

---

## 0. Статус

| Этап | Статус | Что в коде |
|---|---|---|
| M0.0 capability probe | ✅ | `squad_probe`, standalone probe, interrupt probe |
| M0 каркас, БД, plan gate | ✅ | `src/index.ts`, SQLite 001, `squad_mission/plan/budget`, RPC |
| M1 найм и работа | ✅ | `squad_hire/assign/wait/check`, ledger, personas |
| M2 слепая ревизия | ✅ | `squad_review/verdict`, rework, `squad_report` |
| M3 HR | ✅ | `squad_appraise/fire/scorecard/career`, blacklist |
| M4 worktree, DAG, интеграция | ✅ | worktree, зависимости, `squad_integrate/finalize` |
| M5 споры и аудит | ✅ | `squad_dispute/audit`, арбитр, process auditor |
| M6 классы и медиа | ✅ | 10 шаблонов, capabilities, `squad_image/preview/look` |
| M7 закалка | ✅ 0.8–0.9.4 | gc, split store, CI, in-place, snapshot-diff, late false-pass, lock, batch rollback, live config, scope-контроль, метрики |
| Release tag | ❌ | тега и release notes нет |

29 инструментов. Тесты: 23 файла, 107 кейсов. CI: `.github/workflows/ci.yml`.

---

## 1. Границы

**Делает.** Любую задачу, которую можно описать как «вход → работа → артефакт → приёмка»: код, исследование, текст, дизайн, данные, ops, ревизия, планирование, creative, mixed. Планирует, нанимает, изолирует, проверяет, сливает, считает расход и хранит историю.

**Не делает.**

- не гарантирует корректность работы — гарантирует процесс, evidence и независимую проверку;
- не заменяет ответственность человека (юридическую, медицинскую, финансовую);
- не имеет жёсткого лимита бюджета;
- не создаёт image-модель и не обходит права хоста.

---

## 2. Платформа и API

- Promise-API `@opencode/plugin@2.3.0` (`Plugin.define`, `setup(context)`), не Effect.
- Версии exact: `@opencode/plugin`, `@opencode/client`, `@opencode/schema` — `2.3.0`.
- `effect` — peerDependency `^4.0.0`, не бандлится.
- Legacy `@opencode-ai/plugin@1.x` не используется.

Используемые домены:

| Нужно | API |
|---|---|
| Создать сессию сотрудника | `session.create({ parentID, title, agent, model, permissions })` |
| Переместить сессию в worktree | `session.move` + проверка `session.get().location` |
| Поставить задачу | `session.prompt({ sessionID, text, delivery, skills })` |
| Дождаться / прервать | `session.wait`, `session.interrupt` |
| Прочитать результат | `session.context`, `session.get` (cost/tokens), `vcs.diff` |
| Worktree | `worktree.create/remove` |
| Свои инструменты | `tool.transform(editor => editor.add(...))` |
| Права | `permission.assert` в мутирующих инструментах |
| TUI/RPC | `ctx.rpc.register`, `session.panel`, slash-команда `/squad` |
| Реестр | `model.list`, `agent.list`, `tool.list`, `skill.list`, `mcp.list`, `plugin.list` |
| Картинки | `experimental.generate.image` (`engine:"api"`), resvg (`engine:"vector"`) |

`ctx.vcs.diff({ location })` игнорирует location в plugin context; worktree-diff читается через git (`HEAD^`, working tree, status). `session.wait` не ждёт `session.shell`.

---

## 3. Слои

```text
src/index.ts              Plugin.define: 29 регистраций, RPC, in-place lock
src/tools/*               29 инструментов (namespace squad)
src/db/schema.ts          миграции 001–009
src/db/model.ts           типы, статусы, row->model
src/db/store.ts           фасад SquadStore + repositories/*
src/db/repositories/      missions, tasks, staff, ledger, disputes, audits, events
src/runtime/              hire, assign-policy, snapshot, diff, integrate, commit,
                          evidence, gc, worktree, git, probe, messages, images,
                          preview, paths, inplace-lock
src/plan.ts               MissionPlan + валидация
src/classes.ts            10 шаблонов классов
src/personas.ts           14 персон, грейды, permissions
src/capabilities.ts       skill:/mcp:/tool: резолв
src/report.ts             Report + парсер
src/verdict.ts            Verdict + правила pass/fail
src/ruling.ts             Ruling арбитра + парсер
src/process-audit.ts      process audit + парсер
src/rpc.ts                SquadRpc state/plan
src/tui.tsx               /squad, панель, approve/reject
.opencode/agents/         squad-reviewer, squad-arbiter, squad-auditor (no tools)
tests/                    22 файла, 98 тестов
```

### Таблицы SQLite

`missions`, `tasks`, `staff`, `events`, `ledger`, `appraisals`, `blacklist`, `disputes`, `dispute_messages`, `audits`, `lessons`.

Миграции:

| # | Что добавляет |
|---|---|
| 001 | missions, tasks, staff, events, ledger |
| 002 | assignment и model-колонки |
| 003 | reviewer-колонки, review_round |
| 004 | appraisals, blacklist, fired_at/evidence_ref |
| 005 | staff.worktree_directory |
| 006 | disputes, dispute_messages, audits, lessons |
| 007 | report_captured_at, merged_at, integration_commit |
| 008 | tasks.capabilities_json |
| 009 | missions.isolation, tasks.snapshot_directory |
| 010 | staff.worktree_base (базовый коммит для diff) |
| 011 | tasks.paths_json (allowlist файлов задачи) |

---

## 4. Состояния

### Миссия

```text
draft → plan_gate → staffing → executing → reviewing → integrating → done
                                   ↑            │
                                   └─ fail ─────┘
любой нетерминальный → aborted (squad_cancel)
нетерминальный → failed (поздний false-pass аудит)
```

`planning` объявлен в `MISSION_STATUSES`, но код в него не переводит. `plan submit` работает из `draft/planning/plan_gate`; `approve` — только из `plan_gate`.

### Задача

```text
pending → ready → running → submitted → in_review → integrated
                     │          ↑           │
                     │          └─ returned ┘ (rework ≤ maxRework, default 2)
                     ├→ failed (timeout/crash/prompt failure)
                     ├→ escalated (rework limit exceeded)
                     └→ cancelled (abort миссии)
```

`report.status: done | blocked | failed` валидируется и сохраняется в `report_json`, но **не** меняет статус задачи. Задачу закрывает только вердикт: `pass → integrated`, `fail → returned`. `failed` ставит `wait` при timeout/crash или `assign` при ошибке prompt. `squad_tasks` показывает `needs_attention` со списком failed/escalated/cancelled задач, чтобы миссия не «висела» молча.

---

## 5. Контракты

### Plan

```json
{
  "goal": "…",
  "tasks": [{
    "id": "t1", "title": "…", "class": "code", "role": "implementer",
    "grade": "G2", "acceptance": ["…"], "dependsOn": [], "capabilities": []
  }],
  "expectedCostUsd": 0.05,
  "notes": "…"
}
```

Валидация: непустые tasks; уникальные id; `class` из 10 известных; `grade` G0–G4; непустые acceptance; `dependsOn` ссылается только на существующие id; `expectedCostUsd ≥ 0`.

### Task Brief

```json
{
  "task_id": "t1", "mission_id": "m1", "goal": "…", "class": "code",
  "role": "implementer", "grade": "G2", "context": ["path", "ADR"],
  "acceptance": ["…"],
  "constraints": { "tool_call_budget": 20, "budget_policy": "…" },
  "capabilities": ["skill:coreldraw"],
  "capability_resolution": [],
  "output_schema": "report_v1",
  "rework": true, "attempt": 1, "previous_verdict": {}
}
```

`rework/attempt/previous_verdict` появляются только при повторной выдаче.

### Report

```json
{
  "status": "done | blocked | failed",
  "summary": "…",
  "artifacts": { "files": [], "commit": "…", "images": [] },
  "evidence": [{ "command": "bun test", "exit": 0, "tail": "…" }],
  "risks": [],
  "open_questions": []
}
```

Валидируются `status`, непустой `summary`, типы `artifacts/evidence/risks/open_questions`. Парсер берёт последний JSON-объект из последнего assistant-сообщения.

### Verdict

```json
{
  "verdict": "pass | fail",
  "severity": "low | medium | high | critical",
  "findings": [{ "id": "F1", "claim": "…", "evidence": "path:line", "required_fix": "…" }],
  "checked": ["diff", "tests", "acceptance"]
}
```

Правила:

- `fail` требует severity `high` или `critical` и хотя бы один finding с evidence;
- `pass` требует класс-зависимый набор `checked`:
  - worktree: `code/data/ops` → `diff+tests`, остальные → `acceptance+evidence`;
  - in-place: `code/data/ops` → `diff+acceptance`, остальные → `acceptance+evidence`.
- Стиль, нейминг, форматирование — `pass` с findings, не `fail`.

### Ruling

```json
{ "winner": "worker | reviewer | split", "reasoning": "…", "actions": ["…"] }
```

---

## 6. Персоны и грейды

| Персона | Агент | Доступ | Грейд по умолчанию |
|---|---|---|---|
| `architect` | `plan` | read-only | G3 |
| `implementer` | `build` | shell | G2 |
| `test-smith` | `build` | shell | G2 |
| `researcher` | `explore` | read-only | G1 |
| `designer` | `build` | write | G3 |
| `writer` | `build` | write | G2 |
| `data-analyst` | `build` | shell | G3 |
| `ops-runner` | `build` | shell | G2 |
| `reviewer` | `squad-reviewer` | read-only | G4 |
| `critic` | `squad-reviewer` | read-only | G4 |
| `integrator` | `build` | shell | G4 |
| `auditor` | `squad-auditor` | read-only | G2 |
| `arbiter` | `squad-arbiter` | read-only | G4 |
| `scribe` | `build` | write | G1 |

Permissions: read-only — deny `edit`, `shell`, `subagent`; write — allow `edit`, deny `shell`, `subagent`; shell — allow `edit`, `shell`, deny `subagent`.

| Грейд | Модель · variant |
|---|---|
| G0 | `deepseek-flash` · none |
| G1 | `deepseek-flash` · low |
| G2 | `deepseek-flash` · high |
| G3 | `deepseek-v4-pro` · high |
| G4 | `deepseek-v4-pro` · max |

Ревизор берётся на грейд выше; при G4 — персона `critic` того же грейда. Повышение/понижение — `squad_career` по score.

---

## 7. Изоляция

### worktree

- Требует git-репозиторий; проверка в `squad_mission create` и `hireEmployee`.
- Hire создаёт worktree для всех, кроме read-only.
- `session.create` не гарантирует каталог: сессия принудительно перемещается через `session.move`, затем bounded polling `session.get`; несовпадение каталога — fail-closed.
- `squad_integrate` делает cherry-pick в `main`, пишет `integration.merged`, удаляет worktree.
- Diff для поздней ревизии читается из integration-коммита.

### none (in-place)

- Сотрудники работают в каталоге проекта; worktree не создаётся.
- `squad_assign` снимает снапшот перед стартом: `.squad/snapshots/<mission>/<task>/` (manifest sha256 + копии файлов).
- Снапшот: skip `.git/.squad/node_modules/dist/build/.next/coverage/target/venv/__pycache__` и др.; файлы >2 МБ и бинарники только помечаются; лимит 5 000 файлов.
- Diff — added/modified/deleted с построчным patch; бюджет 120 000 символов, заголовки файлов сохраняются всегда, усечённые помечаются.
- `integrate` помечает задачу merged in place; `finalize`/`audit` не проверяют ancestry.
- Lock `.squad/locks/inplace.json`: acquire на approve, release на finalize/cancel, эвикция terminal/2h.
- Параллельные писатели не изолированы.

---

## 8. Гейты и гарантии

| Гейт | Реализация |
|---|---|
| Plan gate | hire только в `staffing/executing/reviewing`; до approve нанять нельзя; `plan`/`mission` идут через `permission.assert` |
| Атомарный assign | условный `UPDATE ... WHERE status IN ('ready','failed','returned')` + проверка `changes` |
| Слепая ревизия | отдельный no-tools агент, грейд +1, только brief/report/diff/images |
| Класс-зависимые проверки | `requiredChecks` в `src/verdict.ts`; промпт агента `squad-reviewer` следует тому же списку |
| Severity floor | fail только high/critical + finding |
| Rework | `attempts > config.maxRework` → `escalated` |
| Свежесть отчёта | `report_captured_at >= assigned_at`, иначе review/check отказывают |
| Чистый main | `integrate` отказывается при грязном working tree |
| Конфликт | `abort` — main чистый; `theirs` — сторона воркера, strategy в результате |
| Батч-интеграция | all-or-nothing: при падении N-го cherry-pick main ресетится к HEAD батча, задачи вызова размечиваются (`integration.rollback`), worktree сохраняются |
| Diff worktree | `git diff <staff.worktree_base>` — все коммиты воркера; legacy fallback `HEAD^` |
| Удаление worktree | после успешного батча, cancel, finalize |
| Освобождение сессий | reviewer/second reviewer/auditor/arbiter: interrupt + remove после вердикта; ledger сохраняет cost |
| Evidence-гейт | `taskEvidence`: для worktree проверяет `merged_at` и ancestry, in-place пропускает; до вызова модели |
| Audit quota | finalize: `max(1, ceil(10% tasks))` вторых ревизий; `hasAudit` считает только `second_review` |
| Поздний false-pass | задача остаётся integrated, миссия `failed`, событие `audit.late_false_pass` |
| Авто-коммит | `squad_wait` коммитит грязный worktree; ошибка → task `failed` |
| Бюджет воркера | research 10 tool-calls, остальные 20; stop-policy в brief и промпте |
| Жёсткий лимит бюджета | `config.hardLimitUsd` блокирует новый assign при перерасходе (`budget.hard_limit`) |
| Scope задачи | `tasks.paths_json` + `runtime/scope.ts`: diff делится на свои/чужие файлы, ревизор видит allowlist |
| Проверка worktree | `probeWorktree` на `mission create`; `squad_status` отдаёт `worktreeUsable` |
| Живучесть БД | общая ручка на проект (`acquireSquadDb`), dispose её не закрывает |
| Метрики | `metrics()`: pass@1, rework rate, failures, cost per integrated task |
| In-place lock | один владелец папки; 2h/terminal эвикция |

---

## 9. Бюджет и ledger

- Ledger пишет per-session `cost`, `tokens.input`, `tokens.output`, staff, provider/model/variant.
- Источник — `session.get` (`SessionInfo.cost/tokens`), не проектный `session.stats`.
- `squad_budget`: expected из плана, actual из ledger; `ratio = actual/expected`.
- Предупреждения: `store.config.softWarnPct` (по умолчанию 70/90 %), аномалия >3×.
- `hardLimitUsd` (по умолчанию `null`) блокирует новые назначения, когда миссия уже израсходовала лимит.
- `maxRework` управляет эскалацией, `staleAfterMinutes` — порогом gc.
- Конфиг передаётся в `new SquadStore(db, config)`; значения по умолчанию — `DEFAULT_CONFIG` в `src/config.ts`.

---

## 10. TUI и RPC

- Slash-команда `/squad`, слот `session.panel`, панель `squad.panel`.
- Панель: миссия/статус, plan version, cost, tasks (до 8), staff, audits, budget anomaly.
- Клавиши: `a` approve, `r` reject, `escape` close.
- Polling `state` каждые 1.5 с.
- RPC `squad.state` / `squad.plan`; JSON санитизируется roundtrip, чтобы не падать на `undefined`.
- TUI-часть грузится из `cli.json`, server-часть — из `opencode.json`.

---

## 11. Классы, capabilities, медиа

10 классов: `code`, `research`, `writing`, `design`, `data`, `ops`, `review`, `planning`, `creative`, `mixed`.

Шаблоны (по 2 шага, кроме mixed — 1):

| Класс | Шаги |
|---|---|
| code | impl → verify |
| research | collect → synthesize |
| writing | outline → draft |
| design | concept → produce |
| data | extract → analyze |
| ops | prepare → execute |
| review | inspect → report |
| planning | map → schedule |
| creative | explore → select |
| mixed | deliver |

Capabilities: `skill:<id>`, `mcp:<server>`, `tool:<name>` и bare-имена; `squad_capabilities` резолвит доступность; `squad_assign` добавляет guidance в brief и прикрепляет доступные skills к `session.prompt`.

Медиа:

- `squad_image engine:"api"` — `experimental.generate.image`, нужна image-модель;
- `squad_image engine:"vector"` — текстовая модель генерирует self-contained SVG, resvg делает PNG;
- `squad_preview` — SVG → PNG локально;
- `squad_look` — image attachment в дочернюю сессию DeepSeek;
- `squad_review`/`squad_audit` прикрепляют PNG из отчёта или рендерят preview SVG.

---

## 12. Тесты

24 файла, 117 тестов:

| Группа | Файлы |
|---|---|
| Планирование | `plan`, `classes`, `assign-policy` |
| Хранилище | `store`, `store-lifecycle` |
| Исполнение | `wait`, `commit`, `diff`, `snapshot`, `messages`, `report` |
| Ревизия | `verdict`, `ruling`, `process-audit` |
| Интеграция | `integrate`, `evidence`, `gc`, `inplace-lock` |
| Поведение | `chaos` |
| Гейты | `gates` (config, audit scoping, worktree base, batch rollback, permission) |
| Надёжность 0.9.4 | `reliability` (shared handle, probe, scope-партиционирование, метрики, paths) |
| Контракты | `api-drift`, `tui`, `preview` |

`bun run verify`: typecheck → biome → test. CI повторяет это на Ubuntu с `--frozen-lockfile`.

---

## 13. Не реализовано

Честный список того, что старый план обещал, а код не содержит:

1. **`/mission`** — команды в репозитории нет; заявление в CHANGELOG 0.9.2 удалено. Планирование идёт через `squad_mission/plan` (решения принимает модель).
2. **Детерминированный роутер и `generate.decisions`** — не используются; декомпозиция полностью на боссе.
3. **`steer`** — `delivery:"steer"` не применяется, только `"queue"`.
4. **Атрибуция записи в in-place** — в worktree allowlist жёсткий: `squad_wait` валит задачу за файл вне `paths`. В `isolation:"none"` папочный diff не позволяет установить авторство, поэтому allowlist там совещательный.
5. **Фильтрация секретов и prompt injection** — фильтрации нет; blind-ревизия ограничена промптом и отсутствием инструментов.
6. **Автоматический janitor** — только явный `squad_gc`.
7. **`report.status` → статус задачи** — не маппится.
8. **Image API** — зависит от внешней image-модели; у DeepSeek её нет.
9. **Release tag/release notes** — тег ставится, release workflow есть; первый релиз по нему ещё не прогонялся.
10. **Расписание process audit и бюджет в TUI** — не реализованы.
11. **Файл конфигурации** — `SquadConfig` живёт в коде/конструкторе, YAML/JSON-настроек нет.

---

## 14. Ближайшие шаги

1. Решить судьбу `report.status`: либо маппить `blocked/failed` в статус задачи, либо убрать из схемы.
2. Поставить тег `v0.9.3` и release notes.
3. Опционально: image API при валидной image-модели; расписание process audit.
4. Держать `README`/`PLAN`/`DEVLOG` в синхроне с `bun run verify` и фактическим набором инструментов.

---

## 15. Документы

| Файл | Роль |
|---|---|
| `README.md` | установка, быстрый старт, инструменты, гарантии, ограничения |
| `docs/PLAN.md` | этот документ: архитектура, контракты, состояние, пробелы |
| `docs/ROADMAP.md` | now / next / later / not planned |
| `docs/releases/` | тексты релизов для GitHub |
| `docs/DEVLOG.md` | хронология разработки и живые прогоны |
| `CHANGELOG.md` | версии |
