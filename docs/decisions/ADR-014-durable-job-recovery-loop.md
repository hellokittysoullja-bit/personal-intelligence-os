# ADR-014: Durable job recovery loop без слепого retry

- Статус: Принято
- Дата: 2026-08-22

## Контекст

Worker должен переживать рестарт и не оставлять работу навечно в `running`. Однако автоматический повтор результата с неизвестным внешним эффектом опасен: будущий browser write, отправка сообщения или форма могли выполниться перед crash, хотя запись о завершении не успела сохраниться.

## Решение

Введён отдельный control-plane объект `DurableJob` с persisted `status`, `leaseOwner`, `leaseExpiresAt`, `lastHeartbeatAt`, `attempt` и `lastError`. Первый worker loop выполняет **только** reconciliation. Он не исполняет queued jobs и не вызывает модели, browser, Telegram, API или tools.

При обнаружении `running` job с истекшей lease worker переводит его в `blocked_recovery`, очищает lease и сохраняет понятную причину. Никакой автоматический retry не допускается до появления ToolExecutor с явно формализованной idempotency policy и owner-visible reconciliation flow.

| Состояние | Поведение текущего worker | Почему |
| --- | --- | --- |
| `queued` | Не исполняется. | Нельзя скрыто включить автономность раньше policy/executor слоя. |
| `running` с действующей lease | Не трогается. | Работа принадлежит активному worker. |
| `running` с истекшей lease | Переходит в `blocked_recovery`. | Исход неизвестен; повтор может дублировать side effect. |
| `blocked_recovery` | Требует будущего явного решения/reconciliation. | Безопасность выше liveness для неизвестных эффектов. |

## Последствия

Этот срез создаёт durable state и безопасное восстановление, но **не** является готовой очередью исполнения и не обещает автономную 24/7 работу. Для реального persistent runtime нужны отдельные deployment profiles, readiness/observability, leader/lease стратегия и явная политика инструментов. Перед подключением внешних write-интеграций будут добавлены approval proposal и ToolExecutor.
