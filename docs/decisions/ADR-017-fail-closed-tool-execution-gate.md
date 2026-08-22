# ADR-017: Fail-closed ToolExecutor и единый PolicyEngine gate

**Статус:** принято.  
**Дата:** 2026-08-23.

## Контекст

До этого среза approval API/UI умели фиксировать решение владельца, но не существовало единого механизма, который мог бы безопасно связывать конкретный tool payload, policy decision и одноразовое потребление одобренного request. Подключение Playwright/Chromium или Telegram напрямую создало бы альтернативный execution path и нарушило бы ADR-015.

## Решение

Вводятся два независимых infrastructure package boundaries:

| Компонент | Ответственность | Безопасное значение по умолчанию |
| --- | --- | --- |
| `@pios/policy` | Классифицирует вызов по channel, action kind и L0–L4 risk level. | L0/L1 — `auto`; L2 — `deny` до явной project policy; L3/L4 external — `require_approval`; рискованный local channel — `deny`. |
| `@pios/tool-runtime` | Является единственным будущим execution gateway для зарегистрированных tools. | Не запускает tool, пока policy не вернёт `auto` либо пока exact approved request не будет атомарно consumed. |

При `require_approval` `ToolExecutor` создаёт `ApprovalRequest` с SHA-256 от canonical JSON payload. Preview обязателен, но не входит в audit event. При выполнении `executeApproved` executor повторно рассчитывает hash, сверяет owner, channel и action kind, а затем single-use consumption выполняется CAS-переходом `approved → consumed` в транзакции **до** вызова tool. Истёкший request атомарно переходит в `expired` и tool не вызывается. После consume повторная попытка не разрешается.

Lifecycle `ApprovalRequested`, `ApprovalDecided`, `ApprovalConsumed`, `ApprovalExpired` теперь попадает в append-only event store. Payload событий содержит только технические ID, channel, action kind, risk, status и payload hash — без preview, текста, URL, cookie, token или credentials.

## Не входит в этот срез

Нет registry, доступного модели, нет публичного API для proposal/execution, нет durable retry, idempotency key для external vendor, browser adapter, Playwright/Chromium, Telegram adapter или любого зарегистрированного внешнего tool. In-memory test tools проверяют pipeline, но не подключаются к сети.

## Последствия

Browser runtime обязан поставлять implementations `ToolDefinition` только после отдельного adapter slice; он не может вызывать Chromium напрямую. До появления durable idempotency/reconciliation policy failed external calls после consume не retry-ятся автоматически: одноразовое одобрение считается использованным, и повтор требует нового owner-approved request.
