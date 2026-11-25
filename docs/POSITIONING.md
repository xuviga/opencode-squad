# SQUAD — позиционирование

> Версия кода: **0.9.3** (`README.md`, бейдж версии).
> Проверено: 25.11.2026. Все внешние утверждения — по публичным страницам, ссылки в тексте.

SQUAD — плагин для OpenCode 2.4.1, который превращает одну сессию в организацию:
босс планирует миссию, нанимает сотрудников в дочерние сессии, проводит слепую
ревизию, разрешает споры арбитром и сливает работу в `main` через worktree
(`README.md`, первый абзац). Организация — машина состояний в SQLite, переходы
валидирует плагин, а не модель (`README.md`; `docs/PLAN.md`, §4).

---

## Кому

**1. Тем, кто уже работает в OpenCode и хочет не «чат с агентом», а процесс.**
SQUAD ставит гейты: до approve плана нанять нельзя, ревизор — отдельный агент
без инструментов на грейд выше, `fail` требует severity `high`/`critical` и
finding с evidence, интеграция отказывается работать на грязном `main`
(`README.md`, «Что реально проверяется»; `docs/PLAN.md`, §8).

**2. Тем, кому нужен аудируемый след, а не пересказ модели.**
Per-session `cost`/`tokens` пишутся в ledger из `session.get`, а не из
проектного `session.stats` (`docs/PLAN.md`, §9). Отчёт задачи обязан содержать
`evidence` с командой, кодом возврата и хвостом вывода (`docs/PLAN.md`, §5).
Evidence-гейт аудита валит worktree-задачу без коммита-предка `main`
детерминированно, до вызова модели (`README.md`; `SECURITY.md`, «Deterministic
evidence»).

**3. Тем, кто делает не только код.**
10 классов задач: `code`, `research`, `writing`, `design`, `data`, `ops`,
`review`, `planning`, `creative`, `mixed`, у каждого свой шаблон шагов и
класс-зависимый набор проверок (`docs/PLAN.md`, §11 и §5). Для классов без
shell авто-коммит делает `squad_wait`, поэтому writer/designer тоже
интегрируются (`README.md`, «Что реально проверяется»).

**4. Тем, кто ценит изоляцию через git, а не через контейнер.**
Worktree-режим по умолчанию: отдельный worktree, принудительный `session.move`
с проверкой каталога, cherry-pick в `main`, diff от `staff.worktree_base`
(`README.md`, «Режимы изоляции»; `docs/PLAN.md`, §7). Для папок без git есть
`isolation: "none"` со снапшотом и одним локом на папку — честно слабее
(`SECURITY.md`, «Known limitations»).

**5. Одиночкам и небольшим командам, которые готовы читать исходники.**
Проект ведёт один человек, ответ на issue обычно занимает несколько дней
(`README.md`, последний абзац). Сборка не нужна: OpenCode грузит TypeScript
напрямую (`README.md`, «Установка»).

## Кому не надо

**1. Тем, кто хочет готовый SaaS-ревьюер на pull request.**
SQUAD не подключается к GitHub/GitLab и не комментирует PR: он работает внутри
миссии OpenCode, а ревизор видит brief, report, diff и картинки
(`README.md`, «Инструменты»; `docs/PLAN.md`, §7). Если нужен именно PR-бот —
это CodeRabbit, а не SQUAD (см. ниже).

**2. Тем, кому нужен GUI-кокпит для десятков параллельных агентов.**
У SQUAD есть TUI-панель `/squad` с approve/reject и RPC `squad.state/plan`
(`docs/PLAN.md`, §10), но нет веб-дашборда, мобильного доступа и управления
сотнями сессий. Это территория Superset/Paradev и agent-of-empires.

**3. Тем, кому нужен контейнерный песочный запуск.**
Ни Docker, ни Podman, ни какого-либо sandbox в коде нет: поиск по `*.ts` по
`docker|container|sandbox` не даёт совпадений. Граница — права персоны и
worktree, а не контейнер (`SECURITY.md`, «What the plugin does with trust»).

**4. Тем, кто ждёт allowlist путей и фильтрацию секретов.**
Этого нет; в `docs/PLAN.md` §13.4 прямо сказано: «Секреты, allowlist путей,
обёртка prompt injection — фильтрации нет». В `docs/ROADMAP.md` это раздел
«Later», то есть не сейчас.

**5. Тем, кому нужны автоматические бенчмарки и pass@1 как метрика качества.**
`docs/PLAN.md` §13.9: метрики успеха не собираются автоматически;
`squad_scorecard` считает pass@1 только по своим задачам и ledger
(`README.md`, «Инструменты»). Публичных замеров в репозитории нет —
`docs/PLAN.md` §13.9 перечисляет их как несделанные.

**6. Тем, кто хочет steer — вмешаться в уже идущую дочернюю сессию.**
`delivery:"steer"` не применяется, только `"queue"` (`docs/PLAN.md` §13.3;
`README.md`, «Ограничения» — `session.wait` не ждёт `session.shell`).

**7. Тем, кто работает не на OpenCode.**
Требования жёсткие: OpenCode `2.4.1`, Bun, `@opencode/plugin` `2.4.1` exact
pin, legacy `@opencode-ai/plugin@1.x` не поддерживается (`README.md`,
«Требования»). Claude Code, Codex CLI и Gemini CLI SQUAD не оркестрирует.

**8. Тем, кто ищет гарантию корректности или юридическую ответственность.**
`docs/PLAN.md` §1: плагин «не гарантирует корректность работы — гарантирует
процесс, evidence и независимую проверку» и «не заменяет ответственность
человека». `docs/ROADMAP.md`, «Not planned»: заменять ответственность человека
не планируется.

## Чем отличаемся

Ниже — честное сравнение по публичным описаниям на 25.11.2026. Это разные
категории продуктов, поэтому «лучше/хуже» здесь нет: есть разные задачи.

| | SQUAD 0.9.3 | CodeRabbit | Superset (ныне Paradev) | agent-of-empires (AoE) |
|---|---|---|---|---|
| Категория | оркестратор миссий внутри OpenCode (`README.md`) | SaaS-ревью PR и агент для кода ([coderabbit.ai/pricing](https://www.coderabbit.ai/pricing)) | открытая IDE для эры агентов, запуск сотен агентов параллельно ([YC](https://www.ycombinator.com/companies/superset)) | менеджер сессий агентов: TUI, web, CLI, HTTP API ([GitHub](https://github.com/agent-of-empires/agent-of-empires)) |
| Где живёт | плагин OpenCode, состояние в `.squad/squad.db` (`README.md`) | облако вендора, интеграция с Git-провайдером (`pricing`) | десктоп/терминальная IDE, свой workspace ([YC](https://www.ycombinator.com/companies/superset)) | локально: tmux + опционально Docker/Podman ([GitHub](https://github.com/agent-of-empires/agent-of-empires)) |
| Единица работы | миссия → задачи → вердикт → интеграция (`docs/PLAN.md` §4) | pull request / изменение ([pricing](https://www.coderabbit.ai/pricing)) | параллельная сессия агента ([YC](https://www.ycombinator.com/companies/superset)) | сессия агента в tmux ([GitHub](https://github.com/agent-of-empires/agent-of-empires)) |
| Кто принимает решение | ревизор-агент на грейд выше + арбитр, правила в `src/verdict.ts` (`docs/PLAN.md` §5–6) | модель вендора, человек применяет фиксы (`pricing`) | человек за IDE, агенты исполняют ([YC](https://www.ycombinator.com/companies/superset)) | человек за TUI/вебом, агенты исполняют ([GitHub](https://github.com/agent-of-empires/agent-of-empires)) |
| Изоляция | git worktree или in-place + снапшот (`README.md`) | не применимо: работает с готовым PR ([pricing](https://www.coderabbit.ai/pricing)) | удалённые workspace'ы ([YC](https://www.ycombinator.com/companies/superset)) | worktree и Docker/Podman/Apple Containers ([GitHub](https://github.com/agent-of-empires/agent-of-empires)) |
| Платформы | локально там, где работает OpenCode; CI — Ubuntu (`README.md`, «Проверка») | SaaS + CLI/IDE ([pricing](https://www.coderabbit.ai/pricing)) | десктоп-приложение ([YC](https://www.ycombinator.com/companies/superset)) | Linux/macOS, Windows только через WSL2 ([GitHub](https://github.com/agent-of-empires/agent-of-empires)) |
| Модель | фиксированные грейды и модели в `src/config.ts` (`docs/PLAN.md` §6) | не раскрывается в прайсе | сессии Claude Code, Codex и др. ([YC, launch post](https://www.ycombinator.com/companies/superset)) | любые поддерживаемые CLI-агенты ([GitHub](https://github.com/agent-of-empires/agent-of-empires)) |
| Цена | MIT (`LICENSE`); расход сессий считается в ledger (`docs/PLAN.md` §9) | от $24 до $72 за пользователя/мес при годовой оплате ([pricing](https://www.coderabbit.ai/pricing)) | не указана на странице YC | MIT ([GitHub](https://github.com/agent-of-empires/agent-of-empires)) |

### CodeRabbit

CodeRabbit продаёт ревью как сервис: «agentic code reviews in PR, CLI, IDE, and
in agent loops», обучение на ваших комментариях, one-click fixes, pre-merge
checks, slop detection; тарифы Essentials/Team/Advanced — $24/$48/$72 за
пользователя в месяц при годовой оплате ([coderabbit.ai/pricing](https://www.coderabbit.ai/pricing)).

Отличие SQUAD: ревью — не продукт, а шаг процесса. Ревизор — отдельный агент
с `permissions: * deny` и двумя шагами, он не имеет инструментов и не может
ничего починить; его `pass` обязан перечислить проверки, которых требует класс
задачи, а `fail` не проходит ниже severity `high` (`README.md`, «Что реально
проверяется»; `SECURITY.md`, «Blind review»). SQUAD не комментирует PR, не
учится на истории комментариев и не умеет one-click fixes: в списке 29
инструментов нет ни одного, который обращается к GitHub или GitLab
(`README.md`, «Инструменты») — зато он доводит задачу до cherry-pick в `main`
и знает, от какого коммита считался diff (`docs/PLAN.md` §8, «Diff worktree»).

Что SQUAD не заменяет у CodeRabbit: статический анализ, сканирование секретов
и зависимостей, security-ревью, приоритизацию очереди PR
([pricing](https://www.coderabbit.ai/pricing)). У SQUAD ничего этого нет —
`SECURITY.md` прямо говорит: «There is no secret scanning».

### Superset (Paradev)

Superset — YC Spring 2026, теперь Paradev: «open-source IDE that helps engineers
run 100s of coding agents in parallel», десктоп-приложение, удалённые
workspace'ы, запуск был под лозунгом «the open source IDE for the AI Agents
era» ([YC](https://www.ycombinator.com/companies/superset)).

Отличие SQUAD: по описанию запуска у Superset интерфейс — центр продукта, у
SQUAD центра нет: планирование, найм, ревизия и интеграция вызываются
инструментами, а TUI — только панель состояния с approve/reject
(`docs/PLAN.md` §10). SQUAD не претендует на роль ежедневной IDE и не управляет
сотнями сессий: один босс на миссию (`README.md`, первый абзац), штат на
миссию, лимит rework 2 и квота вторых ревизий `max(1, ceil(10% задач))`
(`docs/PLAN.md` §8).

Что SQUAD делает такого, чего нет в описании Superset: машина состояний,
которая запрещает нанять сотрудника до approve плана, и слепая ревизия как
обязательный шаг с правилами pass/fail в коде (`docs/PLAN.md` §5, §8). Это не
конкурентное преимущество «вообще», а разная задача: Superset — где работать,
SQUAD — как принять работу.

### agent-of-empires (AoE)

AoE — «a session manager for AI coding agents on Linux and macOS»: TUI, web,
CLI и HTTP API, статусы и уведомления, tmux-сессии, git worktree, Docker/Podman
и Apple Containers, diff review ([GitHub](https://github.com/agent-of-empires/agent-of-empires)).
Он поддерживает OpenCode в списке агентов — то есть это соседний слой, а не
конкурент ([GitHub, About](https://github.com/agent-of-empires/agent-of-empires)).

Отличие SQUAD: AoE управляет сессиями, SQUAD — миссией. AoE даёт песочницу
(контейнеры) и сохранение сессии при обрыве SSH; SQUAD даёт контейнера нет,
зато есть вердикт с evidence, арбитраж спора и all-or-nothing cherry-pick с
откатом батча (`README.md`, «Что реально проверяется»; `docs/PLAN.md` §8).
В README AoE «diff review» — это просмотр изменений; правил pass/fail и
обязательной второй ревизии в описании нет ([GitHub](https://github.com/agent-of-empires/agent-of-empires)).
SQUAD проверяет до человека и валит задачу при `fail`.

Практический вывод: AoE и SQUAD можно ставить рядом — AoE держит сессии и
веб-доступ, SQUAD задаёт процесс внутри OpenCode. Обратное неверно: SQUAD не
умеет то, что умеет AoE (контейнеры, мобильный веб, Windows-нативно — AoE
только через WSL2, [GitHub](https://github.com/agent-of-empires/agent-of-empires)).

## Чего не делаем

Это список ограничений, а не обещаний на будущее. Источники — файлы репозитория.

1. **Нет контейнерной песочницы.** Изоляция — git worktree или снапшот
   in-place; Docker/Podman в коде отсутствуют (поиск по `*.ts`:
   `docker|container|sandbox` — 0 совпадений). См. `SECURITY.md`,
   «What the plugin does with trust».
2. **Нет allowlist путей и фильтрации секретов.** `docs/PLAN.md` §13.4;
   `SECURITY.md`: «permissions are the boundary, not the prompt». В
   `docs/ROADMAP.md` — раздел «Later».
3. **Нет автоматических метрик pass@1 и бенчмарков.** `docs/PLAN.md` §13.9.
   `squad_scorecard` считает pass@1 по задачам самого плагина и ledger, а не
   по внешнему набору (`README.md`, «Инструменты»).
4. **Нет steer дочерних сессий.** Только `delivery:"queue"`
   (`docs/PLAN.md` §13.3). Прервать можно (`session.interrupt`), вмешаться в
   рассуждение — нет.
5. **Нет жёсткой гарантии бюджета.** `hardLimitUsd` блокирует новые
   назначения при перерасходе, но `docs/PLAN.md` §1 честно пишет: «не имеет
   жёсткого лимита бюджета». Бюджет воркера — 10 tool-calls для research и 20
   для остальных (`README.md`).
6. **Нет гарантии корректности.** `docs/PLAN.md` §1: гарантируется процесс,
   evidence и независимая проверка, а не правильность результата.
   `docs/ROADMAP.md`, «Not planned»: «SQUAD proves a process, not correctness».
7. **Нет истории и отката в in-place режиме.** `SECURITY.md`: «no history and
   no rollback»; файлы >2 МБ и бинарники только фингерпринтятся.
8. **Нет файла конфигурации.** `SquadConfig` живёт в коде
   (`docs/PLAN.md` §13.11; `docs/ROADMAP.md`, «Next»).
9. **Нет release-тега и release notes.** `docs/PLAN.md` §0, строка
   «Release tag ❌»; `docs/ROADMAP.md`, «Next» — «Release discipline».
10. **Нет собственной image-модели.** `engine:"api"` требует внешнюю модель,
    `engine:"vector"` — единственный путь без неё (`README.md`,
    «Ограничения»; `docs/ROADMAP.md`, «Later»).
11. **Нет веб-дашборда и мобильного доступа.** Только TUI-панель и RPC
    (`docs/PLAN.md` §10).
12. **Нет гарантии, что воркер не утёк файл, который ему разрешено читать.**
    `docs/ROADMAP.md`, «Not planned».

---

## Как проверить эти утверждения

- `README.md` — установка, инструменты, режимы изоляции, что реально
  проверяется, ограничения.
- `docs/PLAN.md` — архитектура, контракты, гейты, §13 «Не реализовано».
- `docs/ROADMAP.md` — now / next / later / not planned.
- `SECURITY.md` — модель доверия и известные ограничения.
- Внешние источники — ссылки в таблице; проверены 25.11.2026.
- В режиме `isolation:"none"` дифф задачи — папочный: он показывает изменения
  всех задач, работавших в этом каталоге, а не только этого файла
  (`README.md`, «Режимы изоляции»).
