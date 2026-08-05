# Personal Intelligence OS

Личная операционная система искусственного интеллекта: принимает
расплывчатые намерения владельца, превращает их в формальные миссии с
проверяемыми критериями успеха, самостоятельно планирует, выполняет,
проверяет и учится — с полным аудитом, возможностью остановки и отката, и
без критической зависимости от одной модели, провайдера или фреймворка.

Проект прошёл **Milestone 0 — Discovery**, **Milestone 1 — Foundation** и
**Milestone 2 — Mission и Events**: можно создать миссию (пока без
реального LLM — буквально из текста запроса), увидеть её в списке и на
отдельной странице с live-таймлайном событий, состояние переживает
перезапуск процессов. Оркестрация, модели и агенты — в следующих
milestone.

## Документация

- [`docs/PRODUCT_VISION.md`](docs/PRODUCT_VISION.md) — философия, границы,
  критерии качества фундамента.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — слои, доменные порты,
  ключевые компоненты.
- [`docs/DOMAIN_MODEL.md`](docs/DOMAIN_MODEL.md) — сущности, статусы,
  переходы, событийная модель.
- [`docs/SECURITY.md`](docs/SECURITY.md) — уровни риска действий, approval
  workflow, защита от prompt injection.
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — правила разработки,
  процесс после каждого milestone.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — план по milestone, включая
  предложенную структуру Milestone 1.
- [`docs/decisions/`](docs/decisions/) — Architecture Decision Records.

## Быстрый старт

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
docker compose -f docker/docker-compose.yml up -d   # PostgreSQL 16
pnpm db:migrate
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm --filter @pios/api run dev      # apps/api    — http://localhost:3001/health/live
pnpm --filter @pios/worker run dev   # apps/worker — http://localhost:3002/health/live
pnpm --filter @pios/web run dev      # apps/web    — http://localhost:3000
```

Подробности — `docs/DEVELOPMENT.md` §7–8.

## Статус

Milestone 0, 1 и 2 завершены. Следующий шаг — Milestone 3 (Model Gateway),
см. `docs/ROADMAP.md`.
