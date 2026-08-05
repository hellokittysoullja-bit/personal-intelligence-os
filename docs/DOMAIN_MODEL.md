# DOMAIN MODEL — Personal Intelligence OS

Статус: Milestone 0 (Discovery)
Версия документа: 0.1.0

Этот документ фиксирует доменную модель на уровне контракта: сущности,
статусы, переходы, события, доказательства. Реализация (TS-типы + Zod-схемы
в `packages/domain`) начинается в Milestone 2 и должна соответствовать
этому документу; расхождения фиксируются либо изменением кода, либо ADR +
обновлением этого файла.

Все сущности, кроме `Event`, изменяемы через явные переходы состояний,
описанные ниже; недопустимые переходы — доменная ошибка
`InvalidTransitionError`, а не тихий no-op.

## 1. Goal

Буквальный или почти буквальный запрос владельца и первичная интерпретация
намерения. Goal может порождать одну или несколько Mission (например, при
перепланировании) и может иметь родителя (декомпозиция целей).

| Поле | Тип | Назначение |
|---|---|---|
| id | GoalId | |
| ownerId | OwnerId | |
| rawRequest | string | буквальный текст запроса владельца |
| inferredIntent | string \| null | предполагаемая настоящая цель |
| desiredOutcome | string \| null | ожидаемый результат |
| parentGoalId | GoalId \| null | декомпозиция |
| priority | enum(low, normal, high, urgent) | |
| status | enum(new, interpreted, converted_to_mission, archived) | |
| createdAt / updatedAt | timestamp | |

## 2. Mission

Единица работы верхнего уровня, соответствующая одному прогону
когнитивного цикла (раздел 4 `ARCHITECTURE.md`).

Статусы и допустимые переходы:

```
created
  → understanding
understanding
  → awaiting_clarification | planning
awaiting_clarification
  → understanding                    (после ответа владельца)
planning
  → executing | awaiting_approval
executing
  → verifying | awaiting_approval | correcting
verifying
  → correcting | learning | failed
correcting
  → executing | failed               (после исчерпания attempts/бюджета)
awaiting_approval
  → planning | executing | verifying | cancelled  (в зависимости от фазы, откуда пришли)
learning
  → completed
completed / failed / cancelled       (терминальные)
```

Любой статус, кроме терминальных, может перейти в `cancelled` по явной
команде владельца (`CancelMission`). Пауза (`MissionPaused`/
`MissionResumed`) — не отдельный статус, а флаг workflow-рана поверх
текущей фазы (см. `WorkflowEngine.pause/resume` в `ARCHITECTURE.md`), чтобы
не удваивать конечный автомат.

Поля: `id, ownerId, goalId, title, objective, status, autonomyLevel,
riskLevel, budget, successCriteria, constraints, unknowns, assumptions,
stopConditions, currentPhase, createdAt, startedAt, completedAt, version`.

`budget` — обязательная структура с лимитами (не опция):
`maxModelCalls, maxToolCalls, maxDurationMs, maxEstimatedCostUsd,
maxCorrectionLoops`. Превышение любого лимита — управляемый переход в
`failed` с Evidence о причине, никогда не бесконечный цикл.

## 3. MissionContract

Не отдельная сущность с собственным жизненным циклом статусов, а
неизменяемый (immutable, версионируемый) документ, прикреплённый к Mission
в фазе CONTRACT. Повторная генерация контракта (например, после
`ClarificationReceived`) создаёт новую версию, а не мутирует старую — это
нужно для аудита («на основании чего мы решили действовать именно так»).

Поля: `statedRequest, inferredGoal, expectedDeliverables, successCriteria,
constraints, assumptions, unknowns, risks, allowedAutonomy,
requiredApprovals, evidenceRequirements, budget, stopConditions`.

`assumptions` обязаны быть непустыми, если контракт создан без уточняющего
вопроса владельцу при наличии неизвестных — это прямое отражение принципа
«обратимое решение → разумное допущение + документирование» (раздел 1.6
ТЗ, `PRODUCT_VISION.md` §3.6).

## 4. Task / TaskGraph

Task — узел графа задач миссии. TaskGraph — не отдельная таблица, а
производная структура (Task + `parentTaskId` + `dependencies`), с
опциональным материализованным snapshot'ом при создании плана (для
Evidence "план на момент T").

Статусы:

```
pending → ready → running → completed
running → blocked → ready               (после снятия блокера)
running → awaiting_approval → running | rejected
running → verifying → completed | rejected
rejected → retrying → running            (если attemptCount < maxAttempts)
rejected → failed                        (если лимит исчерпан)
* → cancelled                            (каскадно при отмене миссии)
```

Поля: `id, missionId, parentTaskId, title, description, taskType, status,
dependencies, assignedAgentJobId, inputArtifactIds, outputArtifactIds,
successCriteria, evidenceRequirements, maxAttempts, attemptCount, timeout,
budget, createdAt, updatedAt`.

`dependencies` — список `taskId`, задача переходит в `ready` только когда
все зависимости `completed`.

## 5. AgentJob

Субагент — временная работа (job), не постоянная персона/сессия. Роль —
атрибут job, а не отдельная долгоживущая сущность.

Статусы: `created → running → (completed | failed | cancelled)`.
`AgentJob` не имеет собственного цикла retry — retry живёт на уровне Task
(новый AgentJob создаётся заново с урезанным/уточнённым контекстом).

Поля: `id, missionId, taskId, role, mission, systemInstructions,
contextPolicy, selectedCapabilities, allowedToolIds, forbiddenToolIds,
modelCapability, modelConfiguration, tokenBudget, monetaryBudget,
maxSteps, outputSchema, successCriteria, evidenceRequirements, status,
createdAt, completedAt`.

Изоляция по умолчанию (раздел 10 ТЗ): AgentJob **не** получает
автоматически полную память владельца, все секреты, полный filesystem,
инструменты других агентов, права оркестратора или возможность порождать
неограниченное число дочерних агентов. `contextPolicy` явно перечисляет,
что подмешивается в контекст.

## 6. Decision

Аудитируемый выбор (оркестратора, агента или владельца) между
альтернативами.

Поля: `id, missionId, taskId, authorType, authorId, question, options,
selectedOption, rationaleSummary, evidenceIds, confidence, reversibility,
risk, createdAt`.

Жёсткое правило: `rationaleSummary` — краткое объяснение для аудита, **не**
хранилище полного chain-of-thought модели. Скрытые рассуждения не
персистятся нигде (раздел 23.17 ТЗ).

## 7. Evidence

Доказательство выполнения конкретного критерия успеха.

Поля: `id, missionId, taskId, criterionId, evidenceType, description,
expectedResult, actualResult, artifactId, source, status, confidence,
createdAt`.

`evidenceType` (enum): `test_result, browser_observation, file_diff,
command_output, source_reference, user_confirmation, screenshot,
structured_validation, external_response`.

Evidence всегда привязан к конкретному `criterionId` из
`MissionContract.successCriteria` или `Task.successCriteria` — доказательство
«вообще» без критерия не является валидным.

## 8. Artifact

Файл/объект, произведённый или использованный миссией.

Поля: `id, missionId, taskId, type, name, mimeType, storageLocation,
checksum, size, metadata, createdBy, createdAt`.

Milestone 1–9: `storageLocation` указывает на локальный путь в
`workspace/artifacts`. `ArtifactStore` — порт домена; S3-адаптер
подключается позже без изменения вызывающего кода.

## 9. MemoryRecord

Поля: `id, memoryType, scope, ownerId, projectId, subject, content,
structuredData, sourceEventId, sourceArtifactId, confidence, validFrom,
validUntil, status, supersedesId, createdAt`.

`memoryType`: `owner_preference, project_fact, world_fact, decision,
episode, failure, lesson, procedure, relationship, temporary_context`.

Статусы записи памяти (введены для реализации `MemoryService`, детализация
в Milestone 8): `candidate → approved → (active | superseded | expired |
forgotten)`, либо `candidate → rejected`. `supersedesId` формирует цепочку
ревизий факта, не перезапись.

## 10. Skill

Поля: `id, name, description, version, status, applicabilityConditions,
requiredInputs, procedure, requiredTools, forbiddenConditions,
validationTests, successRate, usageCount, sourceLessons, createdAt,
updatedAt`.

Статусы: `candidate → experimental → approved`, либо `→ rejected` на любом
этапе; `approved → deprecated` при устаревании. Переход `experimental →
approved` требует прохождения `validationTests` через `EvaluationRunner` и
(для skill, влияющих на ядро) подтверждения владельца — см. раздел 14 ТЗ и
`ARCHITECTURE.md` §11.

## 11. ApprovalRequest

Поля: `id, missionId, taskId, actionDescription, risk, sideEffects,
preview, expiresAt, status, resolvedBy, resolution, createdAt, resolvedAt`.

Статусы: `pending → (approved | rejected | expired)`. Просроченный запрос
(`expiresAt` прошёл) не считается отказом молча — он переводит миссию в
контролируемое состояние ожидания и требует явной обработки (не удаляется
и не автоматически отклоняется без записи события).

## 12. Событийная модель

`mission_events` — append-only. Каждое событие: `eventId, eventType,
timestamp, ownerId, missionId, taskId, agentJobId, traceId, causationId,
correlationId, payload, schemaVersion`.

Минимальный набор типов событий (Milestone 2+, наполняется по мере
реализации use case, но контракт полей фиксирован с Milestone 2):

```
MissionCreated, GoalInterpreted, MissionContractCreated,
ClarificationRequested, ClarificationReceived, StrategySelected,
TaskGraphCreated, TaskCreated, AgentJobCreated, AgentJobStarted,
ModelRequestStarted, ModelRequestCompleted, ModelRequestFailed,
ToolCallRequested, ToolCallApproved, ToolCallRejected, ToolCallStarted,
ToolCallCompleted, ToolCallFailed, ArtifactCreated, EvidenceCreated,
TaskVerificationStarted, TaskAccepted, TaskRejected, TaskRetried,
ApprovalRequested, ApprovalResolved, MissionPaused, MissionResumed,
MissionCompleted, MissionFailed, LessonProposed, SkillProposed,
EvaluationStarted, EvaluationCompleted
```

`causationId` — событие, непосредственно вызвавшее текущее (напр.
`ApprovalResolved` → `ToolCallApproved`). `correlationId` — обычно равен
`missionId` или `runId`, объединяет всю цепочку одного прогона для
трассировки. `schemaVersion` обязателен с первого события — эволюция схемы
событий не должна ломать чтение старых записей.

## 13. Уровни риска действий (для справки)

Полная таблица политики допуска — в `SECURITY.md`. Здесь фиксируется только
то, что `riskLevel`/`ActionRiskLevel` — общий enum `L0 | L1 | L2 | L3 | L4`,
используемый и в `Mission.riskLevel`, и в `Tool.riskLevel`, и в решениях
`PolicyEngine`, чтобы избежать рассинхронизации нескольких параллельных
классификаций риска.

## 14. Открытые вопросы домена (для решения на соответствующих Milestone)

- Точная модель хранения `TaskGraph` snapshot (материализовать при
  создании плана, или всегда выводить из текущих `Task.dependencies`?) —
  решить на Milestone 4 при реализации PLAN.
- Формат `contextPolicy` в AgentJob (декларативный список источников vs.
  предвычисленный context bundle) — решить на Milestone 6.
- Партиционирование `mission_events` по времени/миссии — не требуется до
  Milestone 10, но индексы по `missionId, createdAt` закладываются в первой
  миграции.
