# SQUAD

[![CI](https://github.com/xuviga/opencode-squad/actions/workflows/ci.yml/badge.svg)](https://github.com/xuviga/opencode-squad/actions/workflows/ci.yml)
[![version](https://img.shields.io/badge/version-0.10.0-blue.svg)](CHANGELOG.md)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![OpenCode](https://img.shields.io/badge/OpenCode-2.4.1-000000.svg)](https://opencode.ai)

Мульти-агентный оркестратор для **OpenCode 2.4.1**: босс планирует миссию, нанимает сотрудников в дочерние сессии, проводит слепую ревизию, разрешает споры через арбитра и сливает работу в `main` через изолированные worktree. Организация — машина состояний в SQLite; переходы валидирует плагин, а не модель.

**0.10.0** · 29 инструментов · 127 тестов в 24 файлах · `bun run verify` зелёный (25.11.2026).

## Why SQUAD

Три боли, из-за которых появился оркестратор, и три механизма, которые их закрывают.

**1. Ревизия, которая ставит галочки.** Ревьюер, который видит рассуждения исполнителя и обязан «одобрить», подтверждает намерение, а не результат; это обсуждают не первый раз: [HN, 48949465](https://news.ycombinator.com/item?id=48949465) и [HN, 44153082](https://news.ycombinator.com/item?id=44153082). → **Слепая ревизия.** `squad_review` поднимает отдельного ревизора на грейд выше и отдаёт ему только Task Brief, отчёт воркера и diff; `src/verdict.ts` не принимает `fail` без severity `high`/`critical` и хотя бы одного finding с evidence, а `pass` обязан перечислить проверки по классу задачи. Файлы: `src/tools/review.ts`, `src/verdict.ts`.

**2. Агенты, которые плодят агентов.** Дочерние сессии уходят в рекурсию и жгут бюджет без счёта: [opencode#18100](https://github.com/anomalyco/opencode/issues/18100) и [HN, 45236830](https://news.ycombinator.com/item?id=45236830). → **Запрет субагентов и бюджет в brief.** `personaPermissions` в `src/personas.ts` выдаёт `subagent: * deny` каждой персоне, независимо от доступа; `src/tools/assign.ts` кладёт в промпт жёсткий лимит tool-calls и требует при исчерпании вернуть `status=blocked` с частичными evidence вместо продолжения. Файлы: `src/personas.ts`, `src/tools/assign.ts`.

**3. «Worktree» путают с песочницей.** Изоляцию каталогов принимают за изоляцию прав: [HN, 49235472](https://news.ycombinator.com/item?id=49235472) и [stop-using-opencode](https://wren.wtf/shower-thoughts/stop-using-opencode/). → **Доказательство родства коммитов и общий откат.** `src/runtime/evidence.ts` проверяет `git merge-base --is-ancestor` для каждого integration-коммита и валит задачу детерминированно, без трат на модель; `src/runtime/integrate.ts` коммитит в `main` только через cherry-pick на чистом дереве, а `src/tools/integrate.ts` при падении любого cherry-pick откатывает весь батч к HEAD до вызова и снимает отметки о слиянии, оставляя worktree для повтора (событие `integration.rollback` пишет `src/db/repositories/tasks.ts`). Файлы: `src/runtime/evidence.ts`, `src/runtime/integrate.ts`, `src/tools/integrate.ts`.

Почему это не гигиена, а необходимость: сбои верификации в мульти-агентных системах разобраны отдельно — [arXiv:2503.13657](https://arxiv.org/abs/2503.13657).

**Чего мы не делаем.** Мы не называем worktree песочницей. Worktree изолирует каталог и коммиты, поэтому параллельные писатели не затирают друг друга и ревизор видит честный diff, — но права процесса он не меняет: воркер по-прежнему читает `~/.aws` и ходит в сеть. Границу безопасности задают permissions персоны и окружение, а не git. Настоящая песочница — это контейнер или виртуалка, и SQUAD их не поднимает; если задача требует изоляции прав, её нужно решать снаружи.

## Требования

- OpenCode `2.4.1`;
- Bun;
- `@opencode/plugin` `2.4.1` (exact pin; legacy `@opencode-ai/plugin@1.x` не поддерживается);
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
| `squad_assign` | Task Brief, prompt, `running`; в in-place снимает снапшот; `paths` задаёт allowlist файлов задачи |
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
| `squad_image` | `engine:"auto"` (по умолчанию) — image-модель, если она настроена, иначе SVG→PNG через текстовую модель; `"api"` требует image-модель; `"vector"` — всегда SVG + resvg |
| `squad_preview` | локальный SVG → PNG (resvg), без image-модели |
| `squad_look` | отправляет изображение vision-модели и возвращает ответ + cost |

## Состояния

Миссия: `draft → plan_gate → staffing → executing → reviewing → integrating → done`, терминальные — `done | failed | aborted`. `planning` объявлен в модели, но код в него не переводит. `failed` ставится поздним false-pass аудитом, `aborted` — `squad_cancel`.

Задача: `pending → ready → running → submitted → in_review → returned → integrated`, плюс `failed` (timeout/crash/prompt failure), `blocked` (воркер сообщил `report.status: blocked`) и `cancelled` (abort миссии). `report.status` теперь двигает задачу: `blocked → blocked` без траты rework, `failed → failed`, `done → submitted`. Блокированную задачу босс переиздаёт через `squad_assign` с новым контекстом.

## Что реально проверяется

- **Plan gate**: `squad_hire` работает только в `staffing/executing/reviewing`; до approve нанять нельзя. `squad_plan` и `squad_mission` вызывают `permission.assert`, поэтому отклонённое право оставляет миссию в `plan_gate`. План валидируется: непустые tasks, уникальные id, известный класс/грейд, непустые acceptance, существующие зависимости.
- **Слепая ревизия**: ревизор — отдельный агент без инструментов (`permissions: * deny`, `steps: 2`), грейд на один выше; при G4 берётся `critic` того же грейда. Промпт не содержит рассуждений исполнителя.
- **Класс-зависимые проверки**: `code/data/ops` требуют `checked: diff+tests` (в in-place — `diff+acceptance`); остальные классы — `acceptance+evidence`.
- **Вердикт**: `fail` только при severity `high`/`critical` и хотя бы одном finding с evidence; `pass` обязан перечислить требуемые проверки. Мелкие замечания → `pass` с findings.
- **Rework**: `attempts > config.maxRework` → `escalated`; вердикт `fail` возвращает задачу в `returned`.
- **Свежесть отчёта**: review/check отклоняют отчёт, снятый до `assigned_at`; после rework нужен новый `squad_wait`.
- **Интеграция**: `squad_integrate` отказывается работать на грязном `main`; при конфликте `abort` оставляет main чистым, `theirs` разрешает конфликт в пользу воркера. Батч all-or-nothing: если второй cherry-pick упал, main откатывается к HEAD до батча, задачи этого вызова размечаются как неслитые (`integration.rollback`), worktree остаются для повтора. Worktree удаляются только после успеха всего батча.
- **Базовый коммит воркера**: `staff.worktree_base` (миграция 010) фиксирует коммит, от которого создан worktree; ревизор и аудит видят `git diff <base>`, то есть **все** коммиты воркера, а не только последний.
- **Живой конфиг**: `SquadStore` принимает `SquadConfig`; `maxRework` управляет эскалацией, `hardLimitUsd` блокирует новые назначения при перерасходе (`budget.hard_limit`), `softWarnPct` задаёт пороги бюджетного радара.
- **Освобождение сессий**: ревизор, второй ревизор, процессный аудитор и арбитр гасятся (`interrupt` + `remove`) после вердикта/рулинга; cost и tokens остаются в ledger.
- **Evidence-гейт аудита**: worktree-задача, integrated без `merged_at`/integration-коммита в `main`, падает детерминированно, без трат на модель; in-place задачи ancestry не проверяют по design. Процессный аудит получает `process_checks` от git и обязан валить миссию при `ok:false`.
- **Поздний false-pass**: если зависимые задачи уже integrated, задача остаётся integrated, миссия → `failed`, событие `audit.late_false_pass`, ревизору −0.3.
- **Finalize**: все задачи integrated; для worktree каждый `integration_commit` — предок `HEAD` main (in-place ancestry не проверяет); минимум `max(1, ceil(10% задач))` вторых ревизий; worktree-задачи merged. Только после этого `done` и удаление worktree.
- **In-place lock**: `.squad/locks/inplace.json`; acquire на approve, release на finalize/cancel, эвикция через 2 часа или терминального holder'а.
- **Бюджет воркера**: research — 10 tool-calls, остальные — 20; при исчерпании — `report.status=blocked` с частичными evidence. Бюджет прописан в brief и промпте.
- **Авто-коммит**: `squad_wait` коммитит грязный worktree после отчёта, поэтому writer/designer без shell всё равно интегрируются; ошибка коммита валит задачу.
- **Scope задачи**: `paths` в плане или в `squad_assign` (точный файл, `docs/`, `src/**/*.ts`) делит diff на «свои» и «чужие» файлы; ревизор и аудитор видят allowlist и не валят задачу за изменения соседей в той же папке.
- **Отчёт двигает задачу**: `squad_check` применяет `report.status`: `blocked` → задача `blocked` (rework не тратится, ревью не начинается), `failed` → `failed`, `done` → `submitted`.
- **Scope-энфорсмент**: `squad_wait` валит задачу за файл вне allowlist. В worktree — по своему diff; в in-place — по атрибуции: файл «свой», «соседский» (если его заявляет параллельная задача) или «ничей» (нарушение). Если параллельный писатель не объявил `paths`, атрибуция честно помечается `task.scope_unverifiable` и остаётся совещательной.
- **Проверка worktree**: `squad_mission create` с `isolation:"worktree"` сначала создаёт и удаляет пробный worktree; если хост не умеет — миссия не создаётся, а `squad_status` отдаёт `isolation.worktreeUsable`.
- **Метрики**: `store.metrics()` и `squad_report` считают pass@1, rework rate, долю падений, споры, аудиты и стоимость на интегрированную задачу — всё выводимо из задач и ledger.
- **Живучесть БД**: одна SQLite-ручка на проект, не закрывается при dispose, поэтому reload плагина не рвёт вызовы в полёте.
- **Lock записи**: в in-place миссии `squad_assign` отказывает, если `paths` новой задачи пересекаются с `paths` задачи в `assigned/running`; `squad_tasks` показывает активные lock'и.
- **Конфиг из файла**: `.squad/config.json` (maxRework, softWarnPct, hardLimitUsd, staleAfterMinutes, gcIntervalMinutes, gcAutoAbort, grades) мержится с дефолтами; битый файл — громкая ошибка, а не тихий откат.
- **Планировщик gc**: каждые `gcIntervalMinutes` сканирует зависшие миссии и пишет события `gc.stale`; авто-аборт только при `gcAutoAbort: true`.
- **TUI**: панель показывает pass@1, rework и стоимость на интегрированную задачу из `tuiState.metrics`.

## Конфигурация

`<проект>/.squad/config.json` — опциональный, мержится с дефолтами:

```jsonc
{
  "maxRework": 2,              // сколько раз задачу можно вернуть
  "softWarnPct": [70, 90],     // пороги бюджетного радара
  "hardLimitUsd": null,        // жёсткий лимит: блокирует новый assign
  "staleAfterMinutes": 120,    // порог зависшей миссии
  "gcIntervalMinutes": 60,     // 0 отключает планировщик
  "gcAutoAbort": false,        // true — планировщик сам абортит зависшие
  "grades": {                  // частичное переопределение моделей по грейдам
    "G2": { "providerID": "deepseek", "modelID": "deepseek-flash", "variant": "high" }
  }
}
```

Ошибка в файле останавливает загрузку плагина с указанием поля — тихо работать
на дефолтах после опечатки хуже, чем не загрузиться.

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
- `maxRework`, `softWarnPct`, `hardLimitUsd` читаются из `SquadConfig`; конфиг задаётся в коде (`src/config.ts`), файла настроек пока нет.
- `squad_gc` не запускается сам — только явный `scan`/`apply`.
- У DeepSeek нет image-модели; `engine:"api"` требует внешнюю image-модель, `engine:"vector"` работает без неё. DeepSeek Flash принимает PNG как вложение.
- После интеграции source-коммит worktree остаётся detached; в `main` попадает cherry-pick commit.
- `finalize` требует вторую ревизию даже для миссии из одной задачи (`max(1, ceil(10%))`).

## Документы

- `docs/PLAN.md` — архитектура, контракты, состояние, что не реализовано.
- `docs/ROADMAP.md` — что делается сейчас, что дальше и что не планируется.
- `docs/DEVLOG.md` — журнал разработки и живые прогоны.
- `docs/releases/` — тексты релизов, которые уходят на GitHub.
- `CHANGELOG.md` — история версий.

## Участие, безопасность, лицензия

- Как собрать, проверить и прислать изменение: [CONTRIBUTING.md](CONTRIBUTING.md).
- Правила общения: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- Уязвимости — приватно на `xuvigan@users.noreply.github.com`, модель доверия
  и известные ограничения описаны в [SECURITY.md](SECURITY.md).
- Лицензия — [MIT](LICENSE).

Проект ведёт один человек; ответ на issue или pull request обычно занимает
несколько дней. Проверенный прогон `bun run verify` в описании изменения
сокращает это время вдвое.
