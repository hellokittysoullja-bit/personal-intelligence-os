# Personal Intelligence OS

Личная операционная система искусственного интеллекта: принимает
расплывчатые намерения владельца, превращает их в формальные миссии с
проверяемыми критериями успеха, самостоятельно планирует, выполняет,
проверяет и учится — с полным аудитом, возможностью остановки и отката, и
без критической зависимости от одной модели, провайдера или фреймворка.

Проект прошёл **Milestone 0 — Discovery** (архитектура и ADR) и
**Milestone 1 — Foundation**: монорепозиторий устанавливается и
запускается, API и worker поднимаются, PostgreSQL подключается через
Drizzle. Доменная модель миссий и оркестрация — в следующих milestone.

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

Milestone 0 (документы и ADR) и Milestone 1 (Foundation) завершены.
Следующий шаг — Milestone 2 (Mission и Events), см. `docs/ROADMAP.md`.
