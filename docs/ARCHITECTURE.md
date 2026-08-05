# ARCHITECTURE — Personal Intelligence OS

Статус: Milestone 0 (Discovery)
Версия документа: 0.1.0

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

### 1.2 Application (`packages/application`)

Use cases — оркестрация доменных объектов и портов без знания конкретной
инфраструктуры (получает реализации портов через dependency injection).

Ключевые use cases: `CreateMission`, `InterpretGoal`, `BuildMissionContract`,
`SelectStrategy`, `BuildTaskGraph`, `ComposeTeam`, `StartTask`,
`CompleteTask`, `VerifyResult`, `RequestApproval`, `ResumeMission`,
`CancelMission`, `ExtractLesson`, `ProposeSkill`, `RunEvaluation`.

Каждый use case — небольшой класс/функция с явным входом и выходом,
покрываемая unit-тестами через fake-реализации портов.

### 1.3 Infrastructure

Адаптеры к конкретным технологиям, каждый реализует один или несколько
доменных портов:

- `packages/database` — PostgreSQL repositories поверх Drizzle ORM;
- `packages/model-gateway` — адаптеры провайдеров моделей;
- `packages/workflow-engine` — `LangGraphWorkflowEngine` и в будущем другие;
- `packages/browser-runtime` — Playwright adapter;
- `packages/tool-runtime` — filesystem/terminal/git tools;
- `packages/artifacts` — локальное хранилище артефактов (в будущем S3);
- `packages/observability` — логирование, трассировка.

### 1.4 Interfaces

- `apps/api` — HTTP + realtime (SSE/WebSocket) API на Fastify;
- `apps/web` — Next.js web-интерфейс (операторская консоль);
- `apps/worker` — процесс, исполняющий миссии (workflow engine +
  agent runtime + tool runtime), потребляет очередь задач;
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

Realtime-доставка событий в UI идёт через `EventBus` (порт домена),
реализованный поверх Postgres LISTEN/NOTIFY или простого in-process
EventEmitter в Milestone 1–2, с возможностью позже заменить на Redis pub/sub
— без изменения потребителей.

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
  inputSchema: ZodSchema<Input>;
  outputSchema: ZodSchema<Output>;
  riskLevel: RiskLevel;
  execute(input: Input, ctx: ToolExecutionContext): Promise<Output>;
}

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
изменений в `orchestrator-core`.

## 8. Tool Runtime и Policy

`packages/tool-runtime` — единая точка выполнения инструментов:
валидация входа по Zod → проверка разрешений через `PolicyEngine` →
(при необходимости) `ApprovalRequest` → событие `ToolCallRequested` →
выполнение → сохранение результата/артефакта → `Evidence` (если применимо)
→ нормализованное наблюдение обратно агенту. Модель никогда не выполняет
инструмент напрямую — она только предлагает вызов.

Уровни риска действий (L0–L4) и правило автоматического/ручного
подтверждения — детально в `SECURITY.md`.

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

`packages/team-composer` — решает, нужен ли субагент, сколько, какие роли,
какой уровень модели, бюджет, кто проверяет. Не создаёт команду, если один
исполнитель справится лучше и дешевле.

`packages/learning` — `Learning Engine`: сравнение ожидания и результата,
классификация ошибок, `Lesson Candidate`, `Skill Candidate`, запуск evals в
изолированной ветке, сравнение метрик, обязательное подтверждение владельца
для изменений ядра. Самоизменение кода — только через процесс Improvement
Proposal (отдельная ветка, тесты, независимый review, diff владельцу,
подтверждение, rollback).

## 12. API и realtime

Минимальный REST + realtime API описан в исходном ТЗ (раздел 17) и будет
детализирован как OpenAPI/Zod-контракты в `packages/contracts` при
реализации Milestone 2+. Realtime-канал (SSE или WebSocket — выбор
фиксируется ADR в момент Milestone 2) передаёт события об изменении
статуса/фазы/задачи/agent job/tool call/approval/artifact.

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
   единственная точка вызова инструмента — `ToolExecutor`.
5. **Неограниченный рост стоимости/времени миссии.** Митигируется
   обязательными лимитами на Mission/Task/AgentJob (max model calls, max
   tool calls, max duration, max cost, max correction loops) с первого дня
   доменной модели, даже если Milestone 1–3 их не проверяет в реальном времени.
