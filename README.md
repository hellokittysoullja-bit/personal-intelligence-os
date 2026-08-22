# Personal Intelligence OS

Личная операционная система искусственного интеллекта: принимает
расплывчатые намерения владельца, превращает их в формальные миссии с
проверяемыми критериями успеха, самостоятельно планирует, выполняет,
проверяет и учится — с полным аудитом, возможностью остановки и отката, и
без критической зависимости от одной модели, провайдера или фреймворка.

Проект реализует контролируемый research-контур: owner-reviewed mission
contracts, read-only захват публичных источников, citation-bound report drafts,
независимую claim verification при отдельной server-side model configuration,
versioned owner memory и durable recovery foundation. Состояние сохраняется в
PostgreSQL и переживает перезапуск процессов. Внешние write-действия, Telegram,
собственный browser automation и автономное исполнение queued jobs пока намеренно
не включены.

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
- [`docs/HYBRID_RUNTIME.md`](docs/HYBRID_RUNTIME.md) — переносимые профили запуска и операционные safeguards.
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

Текущая ветка `manus/secure-mission-contract` содержит безопасные вертикальные
срезы research, model gateway, verification, versioned memory и durable recovery.
До включения любых внешних действий остаются policy/approval gateway, atomic job
claim/leader election, evaluated executor и выбранное владельцем постоянное
размещение.
