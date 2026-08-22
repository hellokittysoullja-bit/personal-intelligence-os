# DOMAIN MODEL — Personal Intelligence OS

Статус: Milestone 0 (Discovery) — пересмотрено после архитектурного аудита
Версия документа: 0.2.0

> Примечание после аудита: поля сущностей, реализуемых начиная с
> Milestone 2 (Goal, Mission, Task, Event), имеют высокую уверенность.
> Поля сущностей, реализация которых запланирована на Milestone 8–9
> (MemoryRecord, Skill), приведены с низкой уверенностью — они
> ориентировочные и подлежат пересмотру при реализации; не читайте их как
> зафиксированный контракт наравне с Mission/Task.

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
maxCorrectionLoops, maxConcurrentAgentJobs, maxAgentJobDepth`. Превышение
любого лимита — управляемый переход в `failed` с Evidence о причине,
никогда не бесконечный цикл.

Последние два поля (`maxConcurrentAgentJobs`, `maxAgentJobDepth`) добавлены
после архитектурного аудита Milestone 0 — до этого в схеме не было
architectural-инварианта против неконтролируемого порождения вложенных
субагентов (см. §5, §15, `ADR-009`). Реализуются вместе с AgentJob на
Milestone 6, но резервируются в схеме `Mission.budget` уже с Milestone 2,
чтобы не потребовать ломающей миграции позже.

## 3. MissionContract

Не отдельная сущность с собственным жизненным циклом статусов, а
неизменяемый (immutable, версионируемый) документ, прикреплённый к Mission
в фазе CONTRACT. Повторная генерация контракта (например, после
`ClarificationReceived`) создаёт новую версию, а не мутирует старую — это
нужно для аудита («на основании чего мы решили действовать именно так»).

Поля: `statedRequest, inferredGoal, expectedDeliverables, successCriteria,
constraints, assumptions, unknowns, risks, allowedAutonomy,
requiredApprovals, evidenceRequirements, budget, stopConditions,
contractVersion`.

`contractVersion` — добавлено после аудита: целое число, увеличивающееся
на единицу при каждой перегенерации контракта в рамках одной Mission
(ревизия документа). Это отдельное понятие от `schemaVersion`, который
несут события (`DOMAIN_MODEL.md` §12) — `schemaVersion` описывает версию
*формы* данных (эволюцию Zod-схемы между релизами приложения),
`contractVersion` описывает *ревизию содержимого* внутри одной миссии.
До аудита оба смысла были смешаны под словом «версия», что создавало риск
путаницы при реализации.

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
budget, version, createdAt, updatedAt`.

`dependencies` — список `taskId`, задача переходит в `ready` только когда
все зависимости `completed`.

`version` — добавлено после аудита для оптимистичной блокировки
(optimistic concurrency control): любое обновление Task обязано сверить и
увеличить `version`, конфликтующая параллельная запись (например,
одновременное поступление `Evidence` от tool call и отмена задачи)
завершается доменной ошибкой конфликта версий, а не молчаливой
перезаписью. До аудита это поле было только у Mission, хотя у Task
конкурентные записи (tool calls, evidence) реалистичнее.

**Retry на двух разных уровнях** (разведено после аудита, ранее не было
явного различия): `attemptCount`/`maxAttempts` на Task — это
*семантический* retry с перепланированием (после отклонения Verifier или
провала задачи в целом создаётся новый `AgentJob`). Он отличается от
*механического* retry на уровне отдельного вызова инструмента
(`Tool.retryPolicy`, см. `ARCHITECTURE.md` §5) — повтора транзиентной
сетевой/временной ошибки самого вызова, не требующего переосмысления
задачи. Смешивание этих двух механизмов в одном счётчике было бы ошибкой:
транзиентный сбой инструмента не должен расходовать `attemptCount` Task.

## 5. AgentJob

Субагент — временная работа (job), не постоянная персона/сессия. Роль —
атрибут job, а не отдельная долгоживущая сущность.

Статусы: `created → running → (completed | failed | cancelled)`.
`AgentJob` не имеет собственного цикла retry — retry живёт на уровне Task
(новый AgentJob создаётся заново с урезанным/уточнённым контекстом).

Поля: `id, missionId, taskId, parentAgentJobId, role, mission,
systemInstructions, contextPolicy, selectedCapabilities, allowedToolIds,
forbiddenToolIds, modelCapability, modelConfiguration, tokenBudget,
monetaryBudget, maxSteps, outputSchema, successCriteria,
evidenceRequirements, status, createdAt, completedAt`.

`parentAgentJobId` — добавлено после аудита (nullable, `null` для
AgentJob, созданного напрямую оркестратором). Вместе с
`Mission.budget.maxAgentJobDepth` это даёт проверяемую глубину рекурсии:
глубина AgentJob = число переходов по цепочке `parentAgentJobId` до
корня. Создание AgentJob с глубиной выше лимита отклоняется
`TeamComposer`/`PolicyEngine` до вызова модели. Подробнее — `ADR-009`.

**Бюджет AgentJob не независим от бюджета Mission** (зафиксировано после
аудита как явный инвариант, ранее подразумевалось, но не было записано):
`tokenBudget`/`monetaryBudget` любого AgentJob выделяются из остатка
`Mission.budget`, и `TeamComposer` обязан проверить остаток перед
созданием — сумма бюджетов всех AgentJob миссии никогда не может
превысить бюджет самой Mission.

Изоляция по умолчанию (раздел 10 ТЗ): AgentJob **не** получает
автоматически полную память владельца, все секреты, полный filesystem,
инструменты других агентов, права оркестратора или возможность порождать
неограниченное число дочерних агентов. `contextPolicy` явно перечисляет,
что подмешивается в контекст.

**Изоляция Verifier от Executor** (перенесено из ТЗ 7.7, было потеряно
при первом переносе в документацию — восстановлено после аудита): если
роль AgentJob — `Verifier` для задачи T, этот AgentJob не может быть тем
же AgentJob, что исполнял T как Builder/executor, и его `contextPolicy` не
включает `rationaleSummary`/reasoning исполнителя T.

Предварительный набросок формы `contextPolicy` (ориентир для Milestone 6,
не финальное решение — открытый вопрос §14 остаётся открытым по существу
решения, но не по форме): декларативный список источников с явными
флагами, а не предвычисленный context bundle —
`{ includeOwnerMemory: boolean, includeProjectMemory: ProjectMemoryScope
| false, includeSecrets: false | SecretRef[], includeParentTaskArtifacts:
boolean, includeSiblingAgentResults: boolean }`, где `includeSecrets`
по умолчанию `false` и явное включение классифицируется PolicyEngine не
ниже L2 (см. `SECURITY.md`).

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

**Ссылка вместо встраивания для чувствительного содержимого** (правило
добавлено после аудита): если `actualResult`/`description` могли бы
содержать чувствительное или объёмное содержимое (например, дословный
текст memory-кандидата или файла), Evidence и порождаемое им событие
обязаны ссылаться на `artifactId`/`sourceEventId`, а не встраивать
содержимое целиком в `payload` события. Причина — `mission_events`
append-only и не подчиняется `MemoryStore.forget()` (см. §9); дублирование
содержимого в событие делает «забывание» иллюзорным.

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

**Правило дедупликации** (добавлено после аудита — без него отсутствовал
ответ на вопрос «что мешает накоплению мусора и противоречивых фактов в
памяти»): прежде чем создать новую запись из `MemoryCandidate`,
`MemoryCurator` обязан проверить существующие `active`-записи того же
`scope` + `subject`. Если такая запись есть и новый кандидат её уточняет
или противоречит ей — новая запись создаётся через `supersede` (старая
переходит в `superseded`), а не как независимая запись. Две одновременно
`active` записи одного `scope`+`subject`, утверждающие разное, — это
состояние, которое `MemoryCurator` не должен допускать; если обнаружено
постфактум (например, при миграции данных), это ошибка целостности,
требующая ручного разрешения, а не штатное поведение.

**Право на забвение vs неизменяемый журнал событий** (зафиксировано после
аудита как осознанный компромисс, не как автоматически решённая
проблема): `forget(id)` удаляет запись из активного использования
(`retrieve`/`search` её больше не возвращают), но не переписывает
`mission_events` задним числом. Событие, породившее память (например,
`LessonProposed`, если из него был создан `MemoryRecord`), продолжает
существовать в журнале аудита — поэтому правило §7 («ссылка, а не
встраивание») обязательно для любого события, которое может нести
содержимое, впоследствии подлежащее забвению: если содержимое хранится
только по `sourceEventId`/`artifactId`, забвение самого `MemoryRecord`
делает содержимое практически недостижимым через штатные интерфейсы, даже
если формально «событие было». Это ограничение, а не полное «право на
удаление» в юридическом смысле — должно быть явно проговорено с
владельцем до того, как в системе появятся действительно чувствительные
данные (не позже Milestone 8).

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
- Финальная (не предварительная) форма `contextPolicy` в AgentJob —
  набросок дан в §5, окончательное решение на Milestone 6.
- Партиционирование `mission_events` по времени/миссии — не требуется до
  Milestone 10, но индексы по `missionId, createdAt` закладываются в первой
  миграции.
- Точный набор случаев, требующих ручного разрешения конфликта версий
  (`version` на Task/Mission) — решить на Milestone 2 при реализации
  репозиториев.

## 15. Инварианты, зафиксированные после архитектурного аудита Milestone 0

Ниже — сводка правил, добавленных в этот документ по итогам аудита,
собранная в одном месте для удобства проверки на code review (детали и
обоснование — в соответствующих параграфах выше и в `ADR-009`/`ADR-010`):

1. `Mission.budget` включает `maxConcurrentAgentJobs` и `maxAgentJobDepth`
   (§2); бюджет любого AgentJob выделяется из остатка бюджета Mission (§5).
2. `AgentJob.parentAgentJobId` делает глубину рекурсии проверяемой (§5).
3. Verifier для задачи — всегда отдельный AgentJob от исполнителя этой же
   задачи; контекст Verifier не включает rationale исполнителя (§5).
4. `Task.version` и `Mission.version` — оптимистичная блокировка;
   конфликтующая параллельная запись — доменная ошибка, не тихая
   перезапись (§4).
5. Механический retry инструмента (`Tool.retryPolicy`) и семантический
   retry задачи (`Task.attemptCount`) — разные счётчики, не смешиваются (§4).
6. `MissionContract.contractVersion` (ревизия внутри миссии) отделён от
   `schemaVersion` события (версия формы данных) (§3).
7. Чувствительное/объёмное содержимое ссылается по `artifactId`/
   `sourceEventId` в Evidence и событиях, а не встраивается целиком (§7).
8. `MemoryCurator` проверяет дубликаты по `scope`+`subject` перед
   созданием записи; конфликтующие `active`-записи разрешаются через
   `supersede`, не сосуществуют (§9).
9. `forget()` в MemoryStore не переписывает `mission_events` — это
   осознанный, задокументированный компромисс, не полное удаление (§9).

## 14. BrowserProfile и BrowserSession control-plane

`BrowserProfile` и `BrowserSession` реализованы как owner-scoped versioned control-plane (ADR-016). Они выражают намерение и безопасное состояние будущего browser runtime, а не содержимое настоящего профиля Chromium.

| Сущность | Ключевые поля | Инварианты |
| --- | --- | --- |
| `BrowserProfile` | `id`, `ownerId`, `label`, `mode`, `status`, `version`, timestamps | `mode` равен `agent_isolated` или `owner_shared`; disabled profile не может порождать новые sessions; изменение состояния выполняется CAS по `version`. |
| `BrowserSession` | `id`, `ownerId`, `profileId`, `status`, `controlOwner`, `reobservationRequired`, `version`, timestamps | Новая session всегда `paused` и требует полного наблюдения. После `human_takeover` либо возврата агенту повторное наблюдение обязательно до будущего action. |

Режим `agent_isolated` создаёт будущую session с owner control `agent`, но до полного наблюдения действие всё равно запрещено. Режим `owner_shared` начинает с owner control `human`; агент не может наблюдать или действовать без явного возврата управления. `active` session допускается только после полного наблюдения и только для будущего `ToolExecutor → PolicyEngine` path.

В текущем срезе persistence хранит лишь control-plane state. Не сохраняются filesystem path, URL, page text, screenshot, cookie, credential, пароль или payload browser action. Создание и отключение profile создают append-only audit events с техническим ID, mode, status и version; label и чувствительные browser data в event не попадают.

> Это не означает, что Chromium/Playwright уже установлен или запущен. Пока отсутствуют `ToolExecutor`, `PolicyEngine`, реальный browser adapter и owner-mediated transport для human takeover. Поэтому нельзя открывать сайты, подключать аккаунты или выполнять browser actions через эту модель.
