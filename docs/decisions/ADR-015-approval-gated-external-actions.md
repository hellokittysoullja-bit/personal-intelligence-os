# ADR-015: Approval-gated external actions

- Статус: Принято
- Дата: 2026-08-22

## Решение

Telegram, browser runtime и другие внешние integrations не получают прямого execution-пути. Любое действие уровня L3/L4 сначала создаёт неизменяемый `ApprovalRequest` с целевым каналом, risk level, preview, описанием side effect, hash нормализованного payload и временем истечения. Только explicit owner decision `approved` может разрешить будущему ToolExecutor выполнить **точно тот** payload; изменение payload после approval требует нового request.

Browser CAPTCHA, логин, ввод персональных данных и любые действия, которые нарушают правила сайта, не будут автоматизироваться или обходиться. Для CAPTCHA действует human takeover и полное новое observation после возврата управления.

## Инварианты первого среза

| Инвариант | Значение |
| --- | --- |
| Fail closed | При отсутствии policy/approval интеграция не выполняет действие. |
| Immutable preview | Approve привязан к payload hash, а не к изменяемой «задаче вообще». |
| Single-use | Одно approved request может разблокировать только одну попытку executor. |
| Expiry | Истёкшее approval не исполняется и требует нового explicit decision. |
| Audit without secrets | В журнал попадают metadata и hash, но не tokens, cookies, passwords или полный чувствительный payload. |
| No CAPTCHA bypass | Human takeover — единственный допустимый путь. |

Эта ADR не подключает Telegram token, browser profile или внешние credentials. Они будут запрошены только после того, как approval domain/API/UI и ToolExecutor policy boundary пройдут тесты и CI.
