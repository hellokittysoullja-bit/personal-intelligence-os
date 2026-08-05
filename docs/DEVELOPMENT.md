# DEVELOPMENT — Personal Intelligence OS

Статус: Milestone 1 (Foundation) реализован
Версия документа: 0.3.0

Этот документ фиксирует правила разработки. Раздел 8 содержит реальные
команды, работающие начиная с Milestone 1.

## 1. Стек (сводно)

- Язык: TypeScript, strict mode, без `any` без крайней необходимости
  (и с обязательным комментарием-обоснованием, если он всё же нужен);
- Монорепозиторий: pnpm workspaces + Turborepo;
- Frontend: Next.js + React, минималистичный UI, без преждевременной
  дизайн-системы;
- Backend: Node.js + Fastify, REST + SSE/WebSocket для realtime;
- Схемы: Zod (рантайм-валидация) + JSON Schema для внешних контрактов;
- База данных: PostgreSQL + Drizzle ORM, миграции через Drizzle;
  pgvector закладывается архитектурно, не подключается без нужды;
- Агентное выполнение: собственный `WorkflowEngine`, первая реализация —
  LangGraph.js adapter;
- Модели: собственный Model Gateway, конфигурация моделей — вне
  бизнес-логики;
- Браузер: Playwright, persistent profile;
- Тесты: Vitest (unit/integration), Playwright Test (browser);
- Наблюдаемость: Pino + интерфейсы OpenTelemetry;
- Изоляция: Docker Compose для локальной PostgreSQL; sandbox — через
  интерфейс, с заменой на Docker позже;
- Конфигурация: `.env` только локально, валидация через Zod,
  `.env.example` обязателен, секреты не попадают в Git.

## 2. Структура репозитория

См. `ROADMAP.md` (дерево Milestone 1) и раздел 18 исходного ТЗ для полного
целевого дерева. Domain-пакеты не зависят от инфраструктурных — это
проверяется на review и, начиная с момента, когда это станет неудобно
проверять руками, дополнительно линтером границ.

## 3. Правила кодирования

Из раздела 23 ТЗ, обязательны для любого PR:

1. Не реализовывать сразу несколько milestone — каждый Milestone
   отдельный проход, с остановкой и отчётом по завершении.
2. Не добавлять зависимости без объяснения (что даёт, почему именно она,
   какие альтернативы рассмотрены — коротко, в PR-описании или ADR).
3. Не создавать абстракцию без текущего или явно запланированного
   применения (см. `PRODUCT_VISION.md` §3 — три похожих строки лучше
   преждевременной абстракции).
4. Domain не зависит от конкретных фреймворков (Fastify, LangGraph,
   Playwright, SDK моделей).
5. Не использовать `any` без крайней необходимости.
6. Не скрывать ошибки TypeScript (`// @ts-ignore` и подобное — запрещено
   без явного обоснования и issue-ссылки).
7. Не отключать проверки ради зелёного CI.
8. Не оставлять заглушки, выдаваемые за готовую реализацию — если что-то
   не готово, это явно помечено TODO с контекстом (см. п.11) и не
   молчаливо «работает наполовину».
9. Все TODO содержат milestone или issue-контекст (`// TODO(M6): ...`).
10. Любое внешнее действие проходит `PolicyEngine`.
11. Любой ответ модели, влияющий на состояние, проходит schema-валидацию
    (Zod) прежде, чем попасть в domain/application.
12. Любая Mission имеет лимиты (max model calls, max tool calls, max
    duration, max estimated cost, max correction loops).
13. Любой бесконечный цикл — критическая ошибка.
14. Все фоновые процессы поддерживают cancellation.
15. Не хранить скрытые chain-of-thought рассуждения моделей — только
    решения, краткие rationale summaries, доказательства, результаты,
    события (см. `DOMAIN_MODEL.md` §6).
16. Небольшие, логически завершённые коммиты.
17. Перед изменением архитектуры — ADR.
18. Перед удалением существующей логики — объяснение причины (в PR).
19. Для обратимых неопределённых решений — разумное допущение,
    задокументированное явно (в `MissionContract.assumptions` на уровне
    домена; в PR/ADR — на уровне разработки инфраструктуры).
20. Для необратимых решений — остановка и запрос владельцу.
21. После каждого Milestone проект должен запускаться целиком.
22. Не утверждать, что функциональность работает, пока это не подтверждено
    тестом или реальным запуском.

## 4. Процесс после каждого Milestone

1. `pnpm install`;
2. typecheck (`pnpm typecheck` / `tsc --noEmit` по всем пакетам);
3. lint;
4. tests (unit + integration, при наличии — browser/eval);
5. запуск приложения (`apps/api`, `apps/worker`, `apps/web` — минимум health
   check);
6. обновление документации, затронутой изменениями (`ARCHITECTURE.md`,
   `DOMAIN_MODEL.md`, `ROADMAP.md` и т.д.);
7. краткий отчёт владельцу: что сделано, какие решения приняты, какие
   вопросы остаются, что дальше;
8. остановка и ожидание подтверждения перед следующим Milestone.

## 5. Тестирование (сводно, детали — по мере реализации)

- **Unit**: переходы `MissionStatus`/`TaskStatus`, `PolicyEngine`, бюджет,
  Zod-схемы, retry logic, permission decisions, memory superseding, skill
  versioning.
- **Integration**: PostgreSQL repositories, append events, создание
  миссии, workflow pause/resume, fake model response, fake tool call,
  approval flow, verification rejection and correction.
- **Browser**: локальная тестовая страница — найти элемент, нажать, ввести
  текст, проверить результат, screenshot, переключение controlOwner.
- **Eval**: минимум 10 базовых кейсов оркестратора (см. `ROADMAP.md`,
  Milestone 9, и раздел 20.4 исходного ТЗ) с метриками: task success,
  criteria coverage, evidence completeness, число вызовов модели, token
  usage, оценка стоимости, длительность, tool failures, retries, human
  interventions, unnecessary questions, policy violations, число агентов,
  verifier rejection rate.

## 6. Git

- Коммиты — небольшие и логически завершённые;
- ветка разработки для этой задачи: `claude/personal-intelligence-os-arch-fgzdfo`;
- перед архитектурными изменениями — ADR в `docs/decisions/`;
- секреты никогда не коммитятся; при случайном коммите — ротация ключа,
  не только удаление из истории.

## 7. Конфигурация окружения

- `.env.example` в корне — перечисляет все переменные без значений;
  скопируйте в `.env` для локальной разработки (`.env` в `.gitignore`);
- валидация окружения через Zod при старте `apps/api` и `apps/worker` —
  приложение не стартует с невалидным/неполным конфигом (см.
  `apps/api/src/env.ts`, `apps/worker/src/env.ts`);
- локальная PostgreSQL — через `docker/docker-compose.yml`. `apps/api` и
  `apps/worker` ищут `.env` в корне репозитория независимо от того, из
  какой директории запущен процесс.

## 8. Команды (Milestone 1)

```bash
# Установка (Node и pnpm версии закреплены — .nvmrc, packageManager в package.json)
corepack enable
pnpm install --frozen-lockfile

# PostgreSQL 16 локально
cp .env.example .env
docker compose -f docker/docker-compose.yml up -d

# Схема и первая миграция (packages/database/src/schema.ts)
pnpm db:generate   # drizzle-kit generate -> migrations/*.sql
pnpm db:migrate     # применяет migrations/*.sql к DATABASE_URL

# Проверки — как в CI (.github/workflows/ci.yml)
pnpm typecheck
pnpm lint
pnpm test
pnpm build

# Разработка (watch-режим, отдельные терминалы или `pnpm dev` из корня — turbo запустит все параллельно)
pnpm --filter @pios/api run dev       # Fastify на API_PORT (по умолчанию 3001)
pnpm --filter @pios/worker run dev    # Fastify на WORKER_PORT (по умолчанию 3002)
pnpm --filter @pios/web run dev       # Next.js на :3000

# Production-подобный запуск после `pnpm build`
node apps/api/dist/main.js
node apps/worker/dist/main.js
pnpm --filter @pios/web run start
```

Health-эндпоинты: `GET /health/live` (процесс жив) и `GET /health/ready`
(проверяет Postgres, 200/503) — на `apps/api` и `apps/worker`.

### Известное ограничение локальной проверки Docker Compose

В некоторых песочницах (в т.ч. в среде, где выполнялась реализация
Milestone 1) исходящий сетевой доступ к CDN-хосту, с которого Docker
раздаёт слои образов (`production.cloudfront.docker.com`), блокируется
политикой окружения — `docker compose up` в такой среде не может
выполнить `docker pull postgres:16`. Это ограничение конкретной
песочницы, а не самого `docker-compose.yml`: на обычной машине
разработчика и в GitHub Actions (без такого прокси) `docker compose -f
docker/docker-compose.yml up -d` работает штатно — это подтверждено тем,
что тот же сервис-контейнер `postgres:16` используется в CI
(`.github/workflows/ci.yml`). В самой песочнице Milestone 1 проверялся
через нативно установленный в образе PostgreSQL 16 (та же версия), что
не меняет ни код, ни конфигурацию.
