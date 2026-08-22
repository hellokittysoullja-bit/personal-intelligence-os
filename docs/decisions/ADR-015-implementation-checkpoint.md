# Approval API/UI implementation checkpoint

Следующий вертикальный срез после `56b0d1e` должен добавить owner-only API/UI для `ApprovalRequest` без подключения Telegram, browser profile или внешних credentials.

Порядок: application use cases для create/list/approve/reject/consume с compare-and-set; API contracts и owner routes; transparent web panel; integration tests; полный quality gate; CI. Реальный executor, Telegram и browser runtime остаются отдельными срезами после проверки этого gate.
