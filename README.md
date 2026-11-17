# SQUAD

Мульти-агентный оркестратор для **OpenCode 2.3.0**: босс планирует миссию, нанимает сотрудников в дочерние сессии, проводит слепую ревизию, разрешает споры через арбитра и сливает работу в `main` через изолированные worktree. Организация — машина состояний в SQLite; переходы валидирует плагин, а не модель.

**0.9.2** · 29 инструментов · 98 тестов в 22 файлах · `bun run verify` зелёный (17.11.2026).

## Требования

- OpenCode `2.3.0`;
- Bun;
- `@opencode/plugin` `2.3.0` (exact pin; legacy `@opencode-ai/plugin@1.x` не поддерживается);
- для TUI-панели — `@opentui/core`, `@opentui/solid`, `solid-js`, `@opencode/theme`;
- для миссий `isolation:"worktree"` — git-репозиторий.

## Установка

Сборка не нужна: OpenCode загружает TypeScript-исходники. Достаточно `bun install` в каталоге плагина.

Server-часть — в глобальный `~/.config/opencode/opencode.json`:

```jsonc
{ "plugins": ["D:/path/to/opencode-squad"] }
```

TUI-часть — в `~/.config/opencode/cli.json`:

```jsonc
{ "plugins": ["D:/path/to/opencode-squad"] }
```

Не добавляйте тот же путь в проектный `opencode.jsonc`, если он уже есть глобально: плагин загрузится дважды.

## Быстрый старт

```text
squad_mission { action: "create", title: "Fix pagination", goal: "..." }   # draft
squad_template { action: "build", class: "code", goal: "..." }             # опционально: черновик плана
squad_plan { action: "submit", mission_id, plan }                          # валидация + tasks
squad_plan { action: "approve", mission_id }                               # plan_gate -> staffing
squad_hire { mission_id, persona: "implementer", grade: "G2" }             # сессия + worktree
squad_assign { mission_id, task_id, staff_id, context: [...] }             # brief -> running
squad_wait { mission_id, task_id, timeout_ms: 300000 }                     # report + ledger -> submitted
squad_check { mission_id, task_id }                                        # валидация отчёта + diff
squad_review { mission_id, task_id }                                       # слепой ревизор на грейд выше
squad_verdict { mission_id, task_id }                                      # pass -> integrated, fail -> returned
squad_integrate { mission_id }                                             # cherry-pick, worktree удаляется
squad_audit { action: "sample", mission_id }                               # вторая ревизия (квота finalize)
squad_finalize { mission_id }                                              # ancestry + audit quota -> done
```

Аварийные операции: `squad_cancel { mission_id, reason }` и `squad_gc { action: "scan" | "apply" }`.

TUI: `/squad` открывает панель; `a` — approve, `r` — reject, `escape` — close.

## Режимы изоляции

| Режим | Когда | Механика | Ограничения |
|---|---|---|---|
| `worktree` (по умолчанию) | git-репозиторий | сотрудник в отдельном worktree; сессия принудительно перемещается туда (`session.move`) с проверкой каталога; результат заходит в `main` через cherry-pick; ревизор видит git-diff | main должен быть чистым; конфликт решается `abort` или `theirs` |
| `none` | папка без git | сотрудники работают прямо в проекте; перед задачей снимается снапшот (sha256 + копии текстовых файлов), ревизор получает added/modified/deleted | нет коммита и истории; параллельные писатели не изолированы; файлы >2 МБ и бинарники только помечаются; на папку действует один lock |

Создание worktree-миссии в не-git папке падает с инструкцией; `squad_status` отдаёт `isolation.worktreeAvailable`.

## Инструменты

**Миссия и планирование**

| Инструмент | Что делает |
|---|---|
| `squad_status` | версия, RPC, режим изоляции, счётчики реестра OpenCode (models/agents/tools/skills/plugins), stale-миссии |
| `squad_probe` | capability probe: дочерняя сессия, prompt, wait, context/diff, interrupt |
| `squad_mission` | create/list/get; `isolation: worktree \| none` |
| `squad_plan` | submit (валидация + материализация tasks) / get / approve / reject |
| `squad_template` | list/build черновика плана для 10 классов задач |
| `squad_capabilities` | резолв `skill:`, `mcp:`, `tool:` до планирования |
| `squad_budget` | expected vs actual по ledger; предупреждения 70/90 %, аномалия >3× |
| `squad_report` | отчёт миссии: план, задачи, отчёты, вердикты, штат, бюджет, события |

**Штат**

| Инструмент | Что делает |
|---|---|
| `squad_hire` | дочерняя сессия с агентом персоны, моделью грейда и permissions; worktree для не-read-only |
| `squad_staff` | список/карточка сотрудника |
| `squad_appraise` | score ±, запись appraisal и заметки |
| `squad_fire` | увольнение: обязательны reason и evidence_ref; blacklist persona+grade на 30 дней |
| `squad_scorecard` | pass@1, rework, timeout, cost efficiency, score, рекомендация |
| `squad_career` | evaluate / promote / demote / force grade |

**Исполнение**

| Инструмент | Что делает |
|---|---|
| `squad_assign` | Task Brief, prompt, `running`; в in-place снимает снапшот |
| `squad_wait` | ждёт idle, сохраняет отчёт, пишет per-session cost/tokens, авто-коммитит грязный worktree |
| `squad_check` | валидирует Report, прикрепляет к задаче, возвращает рабочий diff |
| `squad_tasks` | список задач, DAG-зависимости и readiness |
| `squad_cancel` | abort миссии: отменяет неинтегрированные задачи, сохраняет merged, удаляет worktree |
| `squad_gc` | scan/apply залипших миссий и осиротевших worktree; порог `stale_minutes` (120) |

**Ревизия и интеграция**

| Инструмент | Что делает |
|---|---|
| `squad_review` | слепой ревизор на грейд выше; видит только brief, report, diff и вложения-картинки |
| `squad_verdict` | ждёт ревизора, валидирует verdict, пишет ledger; pass → `integrated`, fail → `returned` (rework ≤ 2) |
| `squad_dispute` | open / reply / rule / list; арбитр G4 читает claim, сообщения, brief, report, verdict, diff |
| `squad_audit` | task / sample / process; детерминированная проверка integration-коммита + вторая ревизия |
| `squad_integrate` | cherry-pick интегрированных worktree-коммитов; `strategy: abort \| theirs`; удаляет worktree |
| `squad_finalize` | гейт: все задачи integrated, для worktree коммиты — предки `main`, квота вторых ревизий; → `done` |

**Медиа**

| Инструмент | Что делает |
|---|---|
| `squad_image` | `engine:"api"` — `experimental.generate.image`; `engine:"vector"` — SVG от текстовой модели → PNG через resvg |
| `squad_preview` | локальный SVG → PNG (resvg), без image-модели |
| `squad_look` | отправляет изображение vision-модели и возвращает ответ + cost |

## Состояния

Миссия: `draft → plan_gate → staffing → executing → reviewing → integrating → done`, терминальные — `done | failed | aborted`. `planning` объявлен в модели, но код в него не переводит. `failed` ставится поздним false-pass аудитом, `aborted` — `squad_cancel`.

Задача: `pending → ready → running → submitted → in_review → returned → integrated`, плюс `failed` (timeout/crash/prompt failure) и `cancelled` (abort миссии). `report.status: blocked | failed` валидируется и сохраняется, но статус задачи по нему не меняется — задачу закрывает вердикт ревизора.

## Что реально проверяется

- **Plan gate**: `squad_hire` работает только в `staffing/executing/reviewing`; до approve нанять нельзя. План валидируется: непустые tasks, уникальные id, известный класс/грейд, непустые acceptance, существующие зависимости.
- **Слепая ревизия**: ревизор — отдельный агент без инструментов (`permissions: * deny`, `steps: 2`), грейд на один выше; при G4 берётся `critic` того же грейда. Промпт не содержит рассуждений исполнителя.
- **Класс-зависимые проверки**: `code/data/ops` требуют `checked: diff+tests` (в in-place — `diff+acceptance`); остальные классы — `acceptance+evidence`.
- **Вердикт**: `fail` только при severity `high`/`critical` и хотя бы одном finding с evidence; `pass` обязан перечислить требуемые проверки. Мелкие замечания → `pass` с findings.
- **Rework**: лимит 2 зашит в store (`attempts > 2`); вердикт `fail` возвращает задачу в `returned`.
- **Свежесть отчёта**: review/check отклоняют отчёт, снятый до `assigned_at`; после rework нужен новый `squad_wait`.
- **Интеграция**: `squad_integrate` отказывается работать на грязном `main`; при конфликте `abort` оставляет main чистым, `theirs` разрешает конфликт в пользу воркера. После cherry-pick worktree удаляется, diff читается из integration-коммита.
- **Evidence-гейт аудита**: worktree-задача, integrated без `merged_at`/integration-коммита в `main`, падает детерминированно, без трат на модель; in-place задачи ancestry не проверяют по design. Процессный аудит получает `process_checks` от git и обязан валить миссию при `ok:false`.
- **Поздний false-pass**: если зависимые задачи уже integrated, задача остаётся integrated, миссия → `failed`, событие `audit.late_false_pass`, ревизору −0.3.
- **Finalize**: все задачи integrated; для worktree каждый `integration_commit` — предок `HEAD` main (in-place ancestry не проверяет); минимум `max(1, ceil(10% задач))` вторых ревизий; worktree-задачи merged. Только после этого `done` и удаление worktree.
- **In-place lock**: `.squad/locks/inplace.json`; acquire на approve, release на finalize/cancel, эвикция через 2 часа или терминального holder'а.
- **Бюджет воркера**: research — 10 tool-calls, остальные — 20; при исчерпании — `report.status=blocked` с частичными evidence. Бюджет прописан в brief и промпте.
- **Авто-коммит**: `squad_wait` коммитит грязный worktree после отчёта, поэтому writer/designer без shell всё равно интегрируются; ошибка коммита валит задачу.

## Данные на диске

```text
.squad/squad.db                      SQLite: миссии, задачи, штат, ledger, споры, аудиты, события, уроки
.squad/artifacts/                    изображения и PNG-превью
.squad/snapshots/<mission>/<task>/   снапшоты in-place задач
.squad/locks/inplace.json            эксклюзивный лок папки для in-place миссии
```

Каталог `.squad/` в `.gitignore`. База — проектная: у каждого проекта своя.

## Проверка

```bash
bun run typecheck
bun run lint
bun test
bun run verify        # typecheck + biome + tests
bun run tui:live      # реальный PTY: /squad, reject -> resubmit -> approve
bun run vision:probe  # DeepSeek читает PNG
```

CI (`.github/workflows/ci.yml`) на push в `master` и PR: `bun install --frozen-lockfile` → typecheck → lint → test.

## Ограничения

- `session.wait` ждёт model work, но не `session.shell`; timeout-ветка покрыта fake-session тестом.
- In-place: нет истории и отката, параллельные писатели конфликтуют, снапшот не хранит файлы >2 МБ и бинарники.
- `report.status` не управляет статусом задачи (см. «Состояния»).
- `maxRework`, `softWarnPct`, `hardLimitUsd` в `src/config.ts` объявлены, но код их не читает: лимит rework зашит, пороги бюджета зашиты, hard limit не реализован.
- `squad_gc` не запускается сам — только явный `scan`/`apply`.
- У DeepSeek нет image-модели; `engine:"api"` требует внешнюю image-модель, `engine:"vector"` работает без неё. DeepSeek Flash принимает PNG как вложение.
- После интеграции source-коммит worktree остаётся detached; в `main` попадает cherry-pick commit.
- `finalize` требует вторую ревизию даже для миссии из одной задачи (`max(1, ceil(10%))`).

## Документы

- `docs/PLAN.md` — архитектура, контракты, состояние, что не реализовано.
- `docs/DEVLOG.md` — журнал разработки и живые прогоны.
- `CHANGELOG.md` — история версий.
