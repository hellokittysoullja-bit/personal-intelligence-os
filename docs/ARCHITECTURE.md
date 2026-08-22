# ARCHITECTURE — Personal Intelligence OS

Статус: Milestone 2 (Mission и Events) реализован
Версия документа: 0.3.0

Этот документ описывает архитектуру фундамента PIOS: слои, границы модулей,
основные интерфейсы, когнитивный цикл оркестратора и целевую структуру
репозитория. Он не описывает реализацию — реализация начинается с
Milestone 1 и далее по `ROADMAP.md`.

## 1. Архитектурные слои

Система строится по принципу Clean/Hexagonal Architecture с четырьмя
слоями. Зависимости идут строго внутрь: `interfaces → application →
domain`, `infrastructure → domain`. Domain ни от чего не зависит.

```
                 ┌─────────────────────────────┐
                 │          interfaces          │  HTTP API, realtime, CLI, web
                 └───────────────┬───────────────┘
                                 │ вызывает
                 ┌───────────────▼───────────────┐
                 │          application           │  use cases (оркестрация)
                 └───────────────┬───────────────┘
                                 │ зависит от интерфейсов domain
                 ┌───────────────▼───────────────┐
                 │            domain              │  сущности, правила, порты
                 └───────────────▲───────────────┘
                                 │ реализует порты domain
                 ┌───────────────┴───────────────┐
                 │        infrastructure          │  Postgres, LangGraph,
                 │                                 │  Playwright, model SDKs...
                 └─────────────────────────────────┘
```

### 1.1 Domain (`packages/domain`)

Не имеет зависимостей от Fastify, LangGraph, Playwright, SDK моделей или
любых внешних фреймворков (кроме TypeScript и Zod для описания схем —
Zod рассматривается как язык описания контрактов, а не фреймворк выполнения).

Содержит:

- сущности (Mission, Task, Goal, AgentJob, Decision, Evidence, Artifact,
  MemoryRecord, Skill, ApprovalRequest, Event и др.) как TypeScript-типы +
  Zod-схемы;
- value objects (Budget, RiskLevel, AutonomyLevel, CapabilityProfile и т.д.);
- конечные автоматы статусов (MissionStatus, TaskStatus, AgentJobStatus) и
  правила допустимых переходов;
- доменные события;
- **порты** — интерфейсы, которые реализует infrastructure:
  `MissionRepository`, `TaskRepository`, `EventStore`, `WorkflowEngine`,
  `ModelProvider`, `ModelRouter`, `Tool`, `ToolRegistry`, `MemoryStore`,
  `ArtifactStore`, `PolicyEngine`, `EvaluationRunner`, `AgentRuntime`;
- доменные ошибки (`DomainError` и наследники: `InvalidTransitionError`,
  `BudgetExceededError`, `PolicyViolationError` и т.д.).

Domain не знает о HTTP, SQL, конкретных провайдерах моделей или браузере. Он
знает только форму данных и правила.

### 1.2 Application и Orchestrator Core

> Уточнено после аудита: исходное дерево (раздел 18 ТЗ) явно перечисляет
> `application/` и `orchestrator-core/` как два разных пакета. До аудита
> `ARCHITECTURE.md` описывал только один слой «application» и при этом
> ссылался на несуществующий `orchestrator-core` в других документах
> (`PRODUCT_VISION.md`, ADR-005, ADR-006). Ниже — устранение этого разрыва.

**`packages/application`** — обычные use cases уровня CRUD/операций над
сущностями, не требующие знания текущей фазы когнитивного цикла:
`CreateMission`, `RequestApproval`, `ResumeMission`, `CancelMission`,
`ProposeSkill`, `RunEvaluation`. Получают реализации портов через
dependency injection, не знают об инфраструктуре.

**`packages/orchestrator-core`** — координация когнитивного цикла
(раздел 4 ниже): `InterpretGoal`, `BuildMissionContract`, `SelectStrategy`,
`BuildTaskGraph`, `ComposeTeam`, `StartTask`, `CompleteTask`,
`VerifyResult`, `ExtractLesson` — вся логика, управляющая переходами
`MissionStatus`/`TaskStatus` по фазам INTAKE→...→FINISH. Зависит только от
`packages/domain` и портов; использует `WorkflowEngine` как порт, но сам
не содержит LangGraph-специфики (см. §7). Это единственное место, где
живёт «мозг» оркестратора — то, что раньше в документах называлось
`orchestrator-core` без явного определения, теперь имеет конкретный дом.

Оба пакета — часть application-слоя на диаграмме §1: `interfaces →
application/orchestrator-core → domain`. Разделение внутри слоя не меняет
направление зависимостей.

Каждый use case — небольшой класс/функция с явным входом и выходом,
покрываемая unit-тестами через fake-реализации портов.

### 1.3 Infrastructure

Адаптеры к конкретным технологиям, каждый реализует один или несколько
доменных портов:

- `packages/database` — PostgreSQL repositories поверх Drizzle ORM;
- `packages/model-gateway` — адаптеры провайдеров моделей;
- `packages/workflow-engine` — `LangGraphWorkflowEngine` и в будущем другие;
- `packages/browser-runtime` — будущий Playwright adapter; пока отсутствует. Его domain/application/database control-plane для versioned `BrowserProfile`/`BrowserSession` уже существует, но не запускает Chromium, не хранит profile paths/cookies и не может выполнять action (ADR-016);
- `packages/tool-runtime` — реализованный fail-closed `ToolExecutor`: policy decision, immutable approval proposal и atomic single-use consumption. Registry и реальные filesystem/terminal/git/browser adapters пока отсутствуют (ADR-017);
- `packages/agent-runtime` — реализация порта `AgentRuntime`: получает
  `AgentJob`, строит его контекст (`contextPolicy`), вызывает
  `ModelRouter`/`ModelProvider`, предлагает вызовы инструментов через
  `packages/tool-runtime`, возвращает `AgentJobResult`. До Milestone 0
  этот пакет отсутствовал в документе, хотя порт `AgentRuntime` уже был
  описан в §5 — исправлено;
- `packages/policy` — консервативная `PolicyEngine` implementation (L0/L1 auto; L2 deny до явной project policy; L3/L4 external require approval; см. ADR-017). До аудита `PolicyEngine` существовал только как порт без указанного дома — исправлено;
- `packages/artifacts` — локальное хранилище артефактов (в будущем S3);
- `packages/observability` — логирование, трассировка;
- `packages/testkit` — общие fake-реализации портов для тестов
  (`FakeModelProvider`, in-memory `MissionRepository`/`TaskRepository`,
  фикстуры) — переиспользуются unit- и integration-тестами всех пакетов,
  не дублируются в каждом пакете отдельно.

`packages/contracts` — не infrastructure и не domain: это wire-формат
внешнего API (то, что видит `apps/web` и любой внешний клиент через REST/
realtime). Схемы в `packages/contracts` обычно производны от схем
`packages/domain` (сериализуемое подмножество, без внутренних деталей),
а не дублируются вручную — правило, которого не было в документе до
аудита и которое было источником риска рассинхронизации двух наборов
Zod-схем.

### 1.4 Interfaces

- `apps/api` — HTTP + realtime (SSE/WebSocket) API на Fastify;
- `apps/web` — Next.js web-интерфейс (операторская консоль);
- `apps/worker` — процесс, исполняющий миссии (workflow engine +
  agent runtime + tool runtime). До Milestone 10 диспетчеризация не
  использует внешнюю очередь (Redis/BullMQ и подобные технологии — прямо
  запланированы только на Milestone 10, см. `ROADMAP.md`): worker узнаёт о
  готовых к исполнению миссиях через тот же механизм, что и `EventBus`
  (Postgres `LISTEN/NOTIFY` на смену `Mission.status` в `ready`-подобное
  состояние, либо polling как fallback) — без новой инфраструктуры. Это
  уточнение внесено после аудита: более ранняя версия документа говорила
  о «потреблении очереди задач», что прямо противоречило решению не
  вводить очередь до Milestone 10;
- CLI — тонкая обвязка над application use cases для локальной отладки
  (появляется по мере необходимости, не отдельный пакет с первого дня).

## 2. Монорепозиторий

pnpm workspaces + Turborepo. Один `pnpm install`, одна `PostgreSQL`
(Docker Compose локально). Каждый пакет — независимый `package.json` с
явными зависимостями; domain не может импортировать infrastructure —
это проверяется на уровне package.json (domain не имеет их в
dependencies) и, если потребуется, дополнительно линтером границ
(`eslint-plugin-boundaries` — оценить в Milestone 1, не устанавливать
заранее без необходимости).

## 3. Событийная модель и источник истины

`mission_events` — append-only таблица в PostgreSQL, центральный журнал
аудита. Каждое существенное действие в системе порождает неизменяемое
событие с полями: `eventId`, `eventType`, `timestamp`, `ownerId`,
`missionId`, `taskId`, `agentJobId`, `traceId`, `causationId`,
`correlationId`, `payload`, `schemaVersion`.

Текущее состояние (Mission.status, Task.status и т.д.) хранится отдельно в
собственных таблицах для быстрых запросов — это read-model, производный от
событий на уровне приложения (use case одновременно обновляет состояние и
пишет событие в одной транзакции). Это **не** полноценный event sourcing —
восстановление всего состояния только из событий не является целью
Milestone 0–9, но последовательная и централизованная запись событий
обязательна с первого дня, потому что она — основа аудита, отладки и
Debug Timeline.

Realtime-доставка событий в UI идёт через `EventBus` (порт домена).

> Исправлено после аудита: более ранняя версия документа допускала
> реализацию через «простой in-process EventEmitter» в Milestone 1–2. Это
> физически не работает при уже принятом разделении `apps/api` и
> `apps/worker` на два процесса (§1.4) — события, порождённые в worker,
> не долетят до in-process подписчиков в api. Единственная реализация
> `EventBus`, работающая между процессами без новой инфраструктуры,
> реализуется поверх Postgres `LISTEN/NOTIFY` (та же база, что и источник
> истины) с Milestone 2 — с возможностью позже заменить на Redis pub/sub
> без изменения потребителей порта. In-process fan-out допустим только как
> деталь реализации *внутри* одного процесса (например, чтобы не делать
> лишний `LISTEN` на каждого локального подписчика api), но не как
> единственный транспорт.

## 4. Когнитивный цикл оркестратора

Главный цикл миссии — конечный автомат высокого уровня:

```
INTAKE → UNDERSTAND → CONTRACT → STRATEGY → PLAN → COMPOSE_TEAM
   → EXECUTE → VERIFY → CHALLENGE → CORRECT → ACCEPT → LEARN → FINISH
```

Он реализован как небольшой граф в `WorkflowEngine` (Milestone 4:
`UNDERSTAND → CONTRACT → PLAN → EXECUTE → VERIFY → CORRECT|COMPLETE →
LEARN → FINISH` — минимальная версия; полные фазы STRATEGY/COMPOSE_TEAM/
CHALLENGE добавляются в Milestone 6–7). Каждая фаза — переход
`MissionStatus`. Динамика внутри фазы EXECUTE (граф задач, параллелизм,
субагенты) моделируется доменными сущностями `TaskGraph`/`Task`/`AgentJob`,
а не отдельными узлами workflow-графа — LangGraph не должен превращаться в
статическое дерево из десятков узлов на каждую возможную роль.

Подробное описание каждой фазы — в исходном ТЗ (раздел 7) и переносится в
`DOMAIN_MODEL.md` по мере реализации соответствующего Milestone.

## 5. Ключевые доменные порты (интерфейсы)

Ниже — сокращённые сигнатуры для ориентации; финальные версии будут описаны
Zod-схемами и TS-типами в `packages/domain` при реализации.

```ts
interface WorkflowEngine {
  start(missionId: MissionId, input: MissionStartInput): Promise<RunHandle>;
  pause(runId: RunId): Promise<void>;
  resume(runId: RunId): Promise<void>;
  cancel(runId: RunId): Promise<void>;
  signal(runId: RunId, signal: WorkflowSignal): Promise<void>;
  getState(runId: RunId): Promise<WorkflowState>;
  checkpoint(runId: RunId): Promise<CheckpointId>;
}

interface ModelProvider {
  complete(request: ModelRequest): Promise<ModelResponse>;
  stream(request: ModelRequest): AsyncIterable<ModelStreamChunk>;
  estimateCost(request: ModelRequest): CostEstimate;
}

interface ModelRouter {
  resolve(capability: CapabilityProfile): ModelProvider;
}

interface Tool<Input, Output> {
  id: string;
  name: string;
  description: string;
  inputSchema: ZodSchema<Input>;
  outputSchema: ZodSchema<Output>;
  riskLevel: RiskLevel;
  requiredPermissions: Permission[];
  sideEffects: SideEffectDescription[];
  idempotency: 'idempotent' | 'not_idempotent' | 'unknown';
  timeout: DurationMs;
  retryPolicy: RetryPolicy;       // для транзиентных сбоёв самого вызова
  rollbackStrategy: RollbackStrategy | 'none';
  verificationStrategy: VerificationStrategy;
  execute(input: Input, ctx: ToolExecutionContext): Promise<Output>;
}
```

> Исправлено после аудита: более ранняя версия документа приводила
> сокращённый sketch (`id, inputSchema, outputSchema, riskLevel, execute`),
> потерявший поля, явно требуемые ТЗ (раздел 11): `requiredPermissions,
> sideEffects, idempotency, timeout, retryPolicy, rollbackStrategy,
> verificationStrategy`. Без `idempotency`/`retryPolicy` `ToolExecutor` не
> может безопасно решить, можно ли повторить вызов после восстановления
> процесса (см. §17 «Известные ограничения» и `ADR-010`) — это не
> опциональные поля, а необходимое условие безопасного retry/recovery.

```ts

interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(filter: EventFilter, handler: EventHandler): Unsubscribe;
}

interface MemoryStore {
  propose(candidate: MemoryCandidate): Promise<MemoryRecordId>;
  approve(id: MemoryRecordId): Promise<void>;
  reject(id: MemoryRecordId, reason: string): Promise<void>;
  supersede(oldId: MemoryRecordId, next: MemoryCandidate): Promise<MemoryRecordId>;
  retrieve(query: MemoryQuery): Promise<MemoryRecord[]>;
  forget(id: MemoryRecordId): Promise<void>;
}

interface ArtifactStore {
  put(artifact: NewArtifact): Promise<Artifact>;
  get(id: ArtifactId): Promise<ArtifactWithContent>;
}

interface PolicyEngine {
  classify(action: ProposedAction): ActionRiskLevel;
  decide(action: ProposedAction, mission: Mission): PolicyDecision; // auto | require_approval | deny
}

interface EvaluationRunner {
  run(suite: EvalSuiteId, candidate: EvalCandidate): Promise<EvalReport>;
}

interface AgentRuntime {
  execute(job: AgentJob, ctx: AgentExecutionContext): Promise<AgentJobResult>;
}
```

Все реализации этих портов живут в infrastructure-пакетах; domain и
application видят только интерфейсы.

## 6. Model Gateway

`packages/model-gateway` изолирует оркестратор от конкретных SDK моделей.
Оркестратор запрашивает не имя модели, а `CapabilityProfile`:
`reasoning_high`, `reasoning_standard`, `coding_high`, `coding_fast`,
`vision_browser`, `research_long_context`, `verification_strict`,
`classification_cheap`, `summarization_fast`. `ModelRouter` превращает
capability в конкретного провайдера + модель через конфигурацию (не через
код). Первая версия: один реальный provider adapter + `FakeModelProvider`
для тестов. Все структурные ответы валидируются Zod; при ошибке —
ограниченная попытка repair, затем контролируемая ошибка (никогда не
проглатывается молча).

## 7. Workflow Engine

`packages/workflow-engine` определяет доменный интерфейс `WorkflowEngine` и
предоставляет первую реализацию `LangGraphWorkflowEngine`. LangGraph-типы не
пересекают границу пакета: наружу торчит только доменный интерфейс.
Будущие адаптеры (`LocalWorkflowEngine` для тестов без LangGraph,
`TemporalWorkflowEngine` для долгоживущих процессов) подключаются без
изменений в `packages/orchestrator-core`/`packages/domain`.

> Уточнено после аудита: эта гарантия относится к control-plane
> интерфейсу (`start/pause/resume/cancel/signal/getState/checkpoint`) и к
> доменным сущностям Mission/Task/AgentJob — она не означает, что логика,
> *авторизующая* фазу EXECUTE (как строится граф выполнения шагов внутри
> одного рана), переносится между движками бесплатно. LangGraph позволяет
> узлам вызывать инструменты напрямую внутри шага; Temporal требует
> детерминированных workflow-функций с побочными эффектами только через
> Activities — принципиально другая модель авторства. Переход на Temporal
> в Milestone 10 потребует переписать код, реализующий узлы/шаги EXECUTE,
> даже если Mission/Task не изменятся. См. `ADR-006`, раздел «Уточнение
> после аудита».

## 8. Tool Runtime и Policy

`packages/tool-runtime` (реализация в связке с `packages/policy`) — единая
точка выполнения инструментов:
валидация входа по Zod → проверка разрешений через `PolicyEngine` →
(при необходимости) `ApprovalRequest` → событие `ToolCallRequested` →
выполнение → сохранение результата/артефакта → `Evidence` (если применимо)
→ нормализованное наблюдение обратно агенту. Модель никогда не выполняет
инструмент напрямую — она только предлагает вызов.

Уровни риска действий (L0–L4) и правило автоматического/ручного
подтверждения — детально в `SECURITY.md`.

`ToolExecutor` — единственная точка выполнения для *всех* инструментов,
включая браузерные: `packages/browser-runtime` (§9) поставляет реализации
`Tool` (например, `browser_click`, `browser_type`), которые регистрируются
в том же `ToolRegistry` и проходят тот же пайплайн `ToolExecutor`, а не
параллельный путь выполнения. Это уточнение внесено после аудита — без
него `browser-runtime` как отдельный пакет мог быть прочитан как
альтернативный, а не дополняющий исполнительный путь, что подрывало бы
инвариант «ни один Tool не выполняется в обход PolicyEngine».

Интероперабельность с внешними/будущими инструментами и языками (включая
Python-инструменты) обеспечивается через `MCPToolAdapter` — отдельный
адаптер поверх интерфейса `Tool`, реализующий вызовы инструментов через
Model Context Protocol. MCP не становится доменной моделью проекта
(принцип 1.2 `PRODUCT_VISION.md`): `MCPToolAdapter` — это ещё одна
реализация `Tool`, ничем не отличающаяся с точки зрения `ToolExecutor` от
`read_file` или `browser_click`.

## 9. Browser Runtime

`packages/browser-runtime` — Playwright поверх persistent-профиля владельца.
Наблюдение идёт по убыванию структурированности: URL/title → accessibility
snapshot → список интерактивных элементов → текст → сеть → screenshot →
vision (только как fallback). Действия: semantic locator → role/name →
stable attributes → text → координаты (последний fallback). Каждое действие
имеет `expectedResult`, после выполнения `BrowserRuntime` проверяет
фактическое изменение состояния страницы. `BrowserSession.controlOwner`
(`agent | human | paused`) реализует Human Takeover для CAPTCHA и любых
ситуаций, где агент не должен действовать самостоятельно; после возврата
управления план не продолжается вслепую — выполняется полное новое
наблюдение.

## 10. Memory

`packages/memory` — `MemoryService` с операциями `propose / approve / reject
/ supersede / retrieve / forget / expire / search`. Модель никогда не
пишет постоянную память напрямую — она создаёт `MemoryCandidate`,
`MemoryCurator` (use case + политика) решает, сохранять ли его. Типы:
owner preference, project fact, world fact, decision, episode, failure,
lesson, procedure, relationship, temporary/working context. Поиск в
Milestone 8 — SQL/full-text Postgres; `SemanticMemoryIndex` (pgvector) —
отдельный порт, добавляется позже без изменения `MemoryService`.

## 11. Verification, Learning, Team Composer

`packages/verification` — `VerificationEngine`, принимающий
MissionContract + Task + Result + Artifacts + Evidence + Policy и
возвращающий `accepted | rejected | needs_more_evidence | blocked |
human_review_required`, с постатейным разбором критериев. LLM-ревьюер —
один из источников доказательства, не единственный.

**Инвариант независимости верификации** (добавлено после аудита, ранее
присутствовало только в исходном ТЗ раздел 7.7 и было потеряно при
переносе в этот документ): для задач, верифицируемых через `AgentJob`,
Verifier обязан выполняться как отдельный `AgentJob` от исполнителя этой
же задачи — переиспользование одного и того же `AgentJob` для роли
Builder и роли Verifier одной задачи запрещено. Контекст, передаваемый
Verifier, не включает `Decision.rationaleSummary` или любое иное
самоотчётное объяснение исполнителя о том, почему задача выполнена
успешно — Verifier видит только MissionContract, критерии, артефакты и
Evidence, и формирует независимое суждение по ним.

`packages/team-composer` — решает, нужен ли субагент, сколько, какие роли,
какой уровень модели, бюджет, кто проверяет. Не создаёт команду, если один
исполнитель справится лучше и дешевле. Любое создание `AgentJob` —
включая вложенные, порождаемые другим `AgentJob` — проходит через
`TeamComposer` и обязано пройти проверку глобальных пределов миссии
(глубина рекурсии, суммарный и остаточный бюджет — см. `DOMAIN_MODEL.md`
§5, §15 и `ADR-009`). Это ограничение добавлено после аудита: до него
ничто в документе не мешало неограниченному порождению вложенных агентов.

`packages/learning` — `Learning Engine`: сравнение ожидания и результата,
классификация ошибок, `Lesson Candidate`, `Skill Candidate`, запуск evals в
изолированной ветке, сравнение метрик, обязательное подтверждение владельца
для изменений ядра. Самоизменение кода — только через процесс Improvement
Proposal (отдельная ветка, тесты, независимый review, diff владельцу,
подтверждение, rollback).

## 12. API и realtime

Минимальный REST + realtime API описан в исходном ТЗ (раздел 17) и
детализирован как Zod-контракты в `packages/contracts`. Realtime-канал
реализован в Milestone 2 через **Server-Sent Events** (`GET
/missions/:id/events/stream`) — выбран вместо WebSocket как более простой
вариант для однонаправленного потока (сервер → браузер): в Milestone 2 нет
клиент→сервер realtime-взаимодействия, которое оправдывало бы сложность
WebSocket. Решение не оформлено отдельным ADR — это выбор конкретной
транспортной технологии внутри уже принятого архитектурного решения
(EventBus поверх Postgres LISTEN/NOTIFY, см. §3), а не новый архитектурный
принцип. Пересмотр к WebSocket возможен позже (например, для Human
Takeover в Browser Runtime, Milestone 7, где нужна обратная связь
браузер→сервер) без изменения `EventBus`/`EventStore` портов.

## 13. Prompt Management

Все системные инструкции — версионируемые файлы в `prompts/`, не строки в
коде. Каждый промпт имеет `promptId`, версию, назначение, input contract,
output schema, changelog. Роли Milestone 0–1 задела:
`goal-interpreter`, `strategy-selector`, `task-graph-planner`,
`team-composer`, `generic-worker`, `verifier`, `critic`,
`lesson-extractor`, `memory-curator`. Наполнение промптов — по мере
реализации соответствующего use case, не заранее.

## 14. Observability

Каждый запуск несёт `traceId`, `ownerId`, `missionId`, `runId`, `taskId`,
`agentJobId`, `toolCallId`, `modelRequestId`. Логи структурированы (Pino),
трассировка — через интерфейсы OpenTelemetry (без обязательного развёртывания
полного стека в первых Milestone). Секреты, пароли, cookies, authorization
headers никогда не логируются. `Debug Timeline` миссии строится как
проекция `mission_events`.

## 15. Целевая структура репозитория (справочно)

Полное дерево — в разделе 18 исходного ТЗ и в `ROADMAP.md` (там же —
что создаётся на каком Milestone). Milestone 0 создаёт только `docs/` и
`docs/decisions/`. Точное дерево, которое будет создано на Milestone 1,
приведено в конце `ROADMAP.md` вместе со списком зависимостей.

## 16. Технологические решения и их обоснование

Сводка решений — в ADR (`docs/decisions/`). Ключевые:

| Решение | ADR |
|---|---|
| Модульный монолит вместо микросервисов | ADR-001 |
| TypeScript strict как основной язык | ADR-002 |
| Domain независим от фреймворков | ADR-003 |
| Event log как основа аудита | ADR-004 |
| Model Gateway как заменяемый слой | ADR-005 |
| WorkflowEngine как адаптер (LangGraph.js первым) | ADR-006 |
| PostgreSQL как единственный источник истины | ADR-007 |
| Обязательное подтверждение владельца для необратимых действий | ADR-008 |
| Пределы рекурсии и бюджета субагентов | ADR-009 |
| Модель согласованности состояния/событий и восстановление после сбоя | ADR-010 |

## 17. Основные технические риски

См. финальный раздел `ROADMAP.md` — «Риски Milestone 1» и общий раздел
рисков ниже в этом документе.

1. **Утечка LangGraph-специфики в домен.** Митигируется правилом: LangGraph
   типы не покидают `packages/workflow-engine`; ревью PR проверяет импорты.
2. **Разрастание таблицы событий без партиционирования.** На Milestone 1
   не критично; заложить `missionId`/`createdAt` индексы сразу, партиционирование
   — вопрос Milestone 10.
3. **Vendor lock через structured output конкретного провайдера.** Митигируется
   тем, что весь output проходит через Zod-валидацию в `model-gateway`, а не
   напрямую в domain/application.
4. **Ложное чувство безопасности от PolicyEngine, если инструменты не все
   проходят через ToolRuntime.** Митигируется architectural test'ом:
   единственная точка вызова инструмента — `ToolExecutor`. Уточнено после
   аудита: этот architectural test **обязателен, начиная с Milestone 5**
   (не «желательно, если удобно») — до его появления PolicyEngine является
   программным соглашением, а не проверяемой границей (см. §18 ниже и
   `SECURITY.md`).
5. **Неограниченный рост стоимости/времени миссии.** Митигируется
   обязательными лимитами на Mission/Task/AgentJob (max model calls, max
   tool calls, max duration, max cost, max correction loops) с первого дня
   доменной модели, даже если Milestone 1–3 их не проверяет в реальном
   времени. Дополнено после аудита: сюда же относится неограниченное
   порождение вложенных субагентов — см. §11 и `ADR-009`.

## 18. Известные архитектурные ограничения (зафиксировано после аудита Milestone 0)

Честная фиксация того, что фундамент **не** гарантирует сегодня, чтобы
эти пробелы не были приняты по умолчанию за решённые:

1. **PolicyEngine — программная, а не ОС-уровневая граница до Docker
   sandbox (Milestone 10).** `run_command` и файловые инструменты
   исполняются в том же Node.js-процессе, что и остальное приложение; их
   изоляция сегодня — дисциплина прохождения через `ToolExecutor`,
   проверяемая review и (с Milestone 5, обязательно) architectural
   тестом, запрещающим прямой импорт `child_process`/`fs`/сетевых модулей
   вне `packages/tool-runtime` и `packages/browser-runtime`. Это не
   заменяет OS-уровневую изоляцию — она приходит только с Docker sandbox.
2. **Нет аутентификации API.** `apps/api` до появления явного требования
   на сетевое раскрытие предполагает доступ только с localhost/доверенной
   сети одного владельца. Добавление аутентификации — обязательное
   предусловие для любого сетевого доступа за пределы localhost, а не
   последующая доработка (см. `SECURITY.md`).
3. **Recovery после падения процесса не спроектирован до Milestone 4.**
   `WorkflowEngine.checkpoint/getState` даёт технические примитивы, но
   reconciliation-логика при рестарте `apps/worker` (что делать с
   миссией/tool call, зависшими в незавершённом статусе) — открытая
   задача Milestone 4, обязательная к решению до первого реального
   исполнения инструментов с побочными эффектами. См. `ADR-010`.
4. **Конфликт между `MemoryStore.forget()` и неизменяемостью
   `mission_events`.** `forget()` убирает запись из активного
   использования, но не переписывает историю аудита задним числом —
   события, которые могут нести чувствительное содержимое, обязаны
   ссылаться на артефакт/память по `id`, а не встраивать содержимое
   целиком (см. `DOMAIN_MODEL.md` §9, §12).

## 19. Пределы автономного создания субагентов

Формализовано после аудита (ранее — только словесный принцип «не
имитировать интеллект количеством субагентов», без architectural
инварианта):

- `Mission.budget` включает `maxConcurrentAgentJobs` и
  `maxAgentJobDepth` (см. `DOMAIN_MODEL.md` §2, §5, §15);
- бюджет (`tokenBudget`/`monetaryBudget`) любого `AgentJob` выделяется
  из остатка бюджета `Mission`, никогда не независим от него;
- `AgentJob` хранит `parentAgentJobId`; создание AgentJob с глубиной,
  превышающей `maxAgentJobDepth`, или создание, превышающее
  `maxConcurrentAgentJobs`, отклоняется `PolicyEngine`/`TeamComposer` до
  вызова модели — не после;
- полное обоснование — `ADR-009`.
