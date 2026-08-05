# ROADMAP — Personal Intelligence OS

Статус: Milestone 0 (Discovery) — в процессе
Версия документа: 0.1.0

Работа ведётся строго по milestone. Каждый milestone заканчивается
работающим, протестированным состоянием проекта, кратким отчётом и
остановкой до подтверждения владельца (см. `DEVELOPMENT.md` §4). Ни один
milestone не начинается до подтверждения предыдущего.

## Обзор milestone

| # | Название | Ключевой результат |
|---|---|---|
| 0 | Discovery и документы | Архитектурная документация и ADR (этот проход) |
| 1 | Foundation | Репозиторий устанавливается и запускается, Postgres подключается |
| 2 | Mission и Events | Миссия создаётся, события пишутся и видны в UI, без реального LLM |
| 3 | Model Gateway | Фаза UNDERSTAND реально работает, создаётся MissionContract |
| 4 | Minimal Orchestrator | Полный минимальный цикл: UNDERSTAND→...→FINISH на mock/filesystem tool |
| 5 | Tool Runtime | Безопасная работа с filesystem/terminal/git, approvals, аудит |
| 6 | Dynamic Subagents | Team Composer, независимые Researcher/Builder/Verifier/Critic |
| 7 | Browser | Playwright runtime, human takeover, prompt injection defence |
| 8 | Memory | Owner/project/episode/decision/failure memory, curator |
| 9 | Learning и Skills | Lesson/Skill candidates, eval runner, controlled adoption |
| 10 | Long-running и масштабирование | Только после стабильности 1–9: очереди, Temporal, S3, sandbox и т.д. |

Ниже — только Milestone 0 (текущий) и предложение по Milestone 1. Milestone
2–10 детализируются непосредственно перед своим запуском, чтобы план не
расходился с фактическим состоянием кода.

---

## Milestone 0 — Discovery и документы (текущий)

### Сделано в этом проходе

- `docs/PRODUCT_VISION.md` — философия, нецели, критерии качества фундамента.
- `docs/ARCHITECTURE.md` — слои, порты, компонентная архитектура.
- `docs/DOMAIN_MODEL.md` — сущности, статусы, переходы, события.
- `docs/SECURITY.md` — уровни риска L0–L4, approval workflow, prompt
  injection defence, sandbox, секреты.
- `docs/DEVELOPMENT.md` — правила разработки, процесс после milestone,
  тестирование.
- `docs/decisions/ADR-001..008` — восемь исходных архитектурных решений.
- Этот файл — сводный план и предложение по Milestone 1.

### Явно НЕ сделано в этом проходе

- Не создан `pnpm`/Turborepo workspace.
- Не создан ни один `package.json`, ни одна папка `apps/`/`packages/`.
- Не установлено ни одной зависимости.
- Не написано ни одной строки кода приложения.

Это осознанное следование инструкции: документы — до реализации.

---

## Milestone 1 — Foundation (предложение, не реализовано)

### Цель

Рабочий, типизированный, тестируемый монорепозиторий, который
устанавливается, проходит typecheck/lint/tests и поднимает три пустых
(health-check-only) процесса + Postgres в Docker. Никакой доменной логики
миссий — она начинается в Milestone 2.

### Предлагаемое дерево

```
personal-intelligence-os/
  .github/
    workflows/
      ci.yml                      # install → typecheck → lint → test
  apps/
    web/                          # Next.js, одна страница health/placeholder
      package.json
      next.config.ts
      src/app/page.tsx
    api/                          # Fastify, GET /health
      package.json
      src/main.ts
      src/env.ts                  # Zod env validation
    worker/                       # процесс-заглушка, GET /health на отдельном порту
      package.json
      src/main.ts
      src/env.ts
  packages/
    domain/                       # пустой каркас: errors.ts, branding utils
      package.json
      src/index.ts
    contracts/                    # общие Zod-схемы для API (health response и т.п.)
      package.json
      src/index.ts
    database/                     # Drizzle client + первая миграция (пустая схема)
      package.json
      src/client.ts
      src/schema/index.ts
      drizzle.config.ts
    observability/                # Pino logger factory, traceId helper
      package.json
      src/logger.ts
  docker/
    docker-compose.yml            # postgres:16
  docs/                           # уже создано в Milestone 0
  migrations/                     # Drizzle output dir
  workspace/                      # рабочая директория для будущих tool-runtime (Milestone 5)
    .gitkeep
  .env.example
  .gitignore
  package.json                    # workspace root
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
```

`packages/application`, `agent-runtime`, `team-composer`, `tool-runtime`,
`browser-runtime`, `memory`, `verification`, `learning`, `policy`,
`artifacts`, `model-gateway`, `workflow-engine`, `testkit`, а также
`tools/`, `prompts/`, `evals/` — из целевого дерева (раздел 18 ТЗ) — **не**
создаются в Milestone 1 пустыми папками ради «полноты дерева». Они
появляются в том milestone, где для них есть первая реальная реализация
(правило «не создавать абстракцию без текущего применения»,
`DEVELOPMENT.md` §3.3). Это единственное отступление от буквального
дерева раздела 18 ТЗ, и оно обосновано тем же документом (раздел 22, п.5:
Turborepo может требовать немного другую структуру — адаптировать, не
разрушая логические границы).

### Предлагаемые зависимости Milestone 1 и обоснование

| Зависимость | Назначение | Почему именно она |
|---|---|---|
| `typescript` | язык проекта | явное требование ТЗ, strict mode |
| `pnpm` (через corepack) | package manager монорепозитория | явное требование ТЗ, быстрые изоморфные workspace-линки |
| `turbo` | оркестрация задач монорепо (build/test/lint по графу пакетов) | явное требование ТЗ |
| `zod` | рантайм-валидация env и будущих контрактов | явное требование ТЗ, единый язык схем domain+contracts |
| `fastify` | HTTP API `apps/api` | явное требование ТЗ, лёгкий и быстрый, хорошо типизируется |
| `next`, `react`, `react-dom` | `apps/web` | явное требование ТЗ |
| `drizzle-orm`, `drizzle-kit` | ORM и миграции к Postgres | явное требование ТЗ |
| `postgres` (driver, напр. `pg` или `postgres.js`) | клиент для Drizzle | нужен конкретный driver под Drizzle; выбор driver зафиксировать в момент реализации `packages/database` (Milestone 1 commit), а не здесь |
| `pino` | структурированные логи | явное требование ТЗ |
| `vitest` | unit/integration тесты | явное требование ТЗ |
| `dotenv` | локальная загрузка `.env` | явное требование ТЗ, только для local dev |
| `eslint` + `@typescript-eslint/*` | статический анализ, единый стиль | стандарт для TS-монорепо, нужен для CI-проверки «lint» из `DEVELOPMENT.md` §4 |
| `tsx` или `ts-node` (dev-only) | локальный запуск TS без сборки для `apps/*` в dev-режиме | упрощает Milestone 1 dev-loop; финальный выбор — на реализации |

Явно НЕ добавляется в Milestone 1: `langgraph`, `@langchain/*`, Playwright,
любой SDK моделей (`openai`, `@anthropic-ai/sdk`), `pgvector`, Redis/BullMQ,
Temporal, CrewAI. Все они появляются вместе с первой реализацией
соответствующего порта (Milestone 3, 6, 7) — раньше не нужны и не
устанавливаются.

### Критерии готовности Milestone 1

- `pnpm install` проходит из корня без ошибок;
- `pnpm typecheck` (по всем пакетам через turbo) — зелёный;
- `pnpm lint` — зелёный;
- `pnpm test` — зелёный (хотя бы по одному smoke-тесту на пакет с логикой:
  `env.ts` валидация, `logger.ts`);
- `docker compose -f docker/docker-compose.yml up -d` поднимает Postgres,
  `apps/api` успешно подключается к ней при старте (health check включает
  DB ping);
- `apps/api`, `apps/worker` отвечают на `GET /health`;
- `apps/web` открывается и рендерит placeholder-страницу;
- `.env.example` присутствует и покрывает все переменные, которые читает
  `env.ts` в `api`/`worker`;
- CI (`.github/workflows/ci.yml`) прогоняет install → typecheck → lint →
  test на push/PR.

### Риски Milestone 1

1. **Выбор Postgres-driver для Drizzle** (`pg` vs `postgres.js`) — не
   критичен архитектурно (изолирован в `packages/database`), но влияет на
   поведение под нагрузкой/пулинг в будущем. Решение фиксируется прямым
   комментарием в коде на месте создания клиента, отдельный ADR не нужен
   (не архитектурное решение уровня ADR — деталь адаптера).
2. **SSE vs WebSocket** для realtime — отложено до Milestone 2 (когда
   появятся реальные события для стриминга); в Milestone 1 не решается.
3. **Граница `packages/domain` пустая** — есть риск, что первый реальный
   код в Milestone 2 «утащит» за собой случайную зависимость от
   инфраструктуры. Митигируется явным правилом в `DEVELOPMENT.md` и
   ревью PR (см. `ARCHITECTURE.md` §2 про architectural lint — оценить
   его подключение уже в Milestone 1 или отложить до появления первого
   нарушения).
4. **Corepack/pnpm версии в CI vs локально** — фиксируется через
   `packageManager` в корневом `package.json` и `engines`.

---

## Milestone 2–10 (сводно, без детализации)

Детальные результаты каждого milestone — как в разделе 22 исходного ТЗ:

- **M2 Mission и Events**: Goal/Mission/Task/Event сущности и репозитории,
  `mission_events`, API создания миссии, UI списка/карточки, realtime
  timeline. Без реального LLM.
- **M3 Model Gateway**: provider interface, fake provider, один реальный
  adapter, capability routing, structured output, usage/cost logging,
  retries, timeout, schema repair.
- **M4 Minimal Orchestrator**: UNDERSTAND→CONTRACT→PLAN→EXECUTE→VERIFY→
  CORRECT|COMPLETE→LEARN→FINISH на mock/filesystem tool; verifier может
  отклонить результат.
- **M5 Tool Runtime**: ToolRegistry, ToolExecutor, PolicyEngine, approvals,
  filesystem/terminal/git tools, аудит, diff/rollback через Git.
- **M6 Dynamic Subagents**: Team Composer, AgentJob, Agent Runtime,
  Researcher/Builder/Verifier/Critic, бюджет агентов, независимые
  контексты, параллелизм где оправдан.
- **M7 Browser**: Playwright runtime, BrowserSession, observe/navigate/
  click/type/scroll/screenshot, verification, human takeover, prompt
  injection defence.
- **M8 Memory**: Memory Candidate/Curator, owner/project/episode/decision/
  failure memory, retrieval, superseding, forgetting.
- **M9 Learning и Skills**: Lesson Candidate, Skill Candidate, skill
  versions, validation tests, eval runner, comparison reports, approval
  перед принятием core improvements.
- **M10 Long-running и масштабирование**: только после стабильности
  предыдущих — Redis/BullMQ, Temporal, отдельные workers, S3, Docker
  sandbox, pgvector, remote access, WebRTC, мобильный клиент, CrewAI
  adapter, локальные модели.

Каждый из этих milestone получит собственный детальный план (аналогичный
разделу Milestone 1 выше) непосредственно перед стартом.
