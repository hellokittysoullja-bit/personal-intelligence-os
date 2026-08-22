# ADR-016: Browser profile control-plane до подключения Chromium

**Статус:** принято.  
**Дата:** 2026-08-23.

## Контекст

PIOS должен поддерживать два понятных владельцу режима будущего браузера: отдельный профиль агента для безопасных задач и общий режим для обычного браузинга под контролем владельца. При этом текущая система ещё не имеет `ToolExecutor`, `PolicyEngine`, browser adapter, durable execution или установленного Chromium runtime. Прямое добавление запуска Playwright/Chromium на этом этапе создало бы обход единственного policy path, установленного в `SECURITY.md` и `ADR-015`.

## Решение

Вводится **только control-plane**, состоящий из versioned owner-scoped `BrowserProfile` и `BrowserSession` domain contracts. Поддерживаются два режима:

| Режим | Назначение | Начальный владелец контроля сессии |
| --- | --- | --- |
| `agent_isolated` | Будущий отдельный профиль для контролируемых задач агента. | `agent`, но сессия `paused` до полного наблюдения. |
| `owner_shared` | Будущий общий браузерный режим владельца. | `human`; агент не может наблюдать или действовать, пока контроль явно не возвращён. |

Все новые сессии требуют полного наблюдения до любого будущего action. `human_takeover` переводит сессию в `paused`, а возврат контроля агенту вновь устанавливает `reobservationRequired`. Versioned transitions используют CAS в persistence layer. Создание и отключение profile создают append-only audit events, не содержащие label, URL, page text, cookie, credential, filesystem path или browser payload.

В интерфейсе доступны только создание, просмотр и отключение profile records. Панель прямо сообщает, что Chromium не запускается, сайты не открываются и доступ к аккаунтам не выполняется.

## Не входит в этот срез

Этот срез **не** устанавливает и не запускает Chromium/Playwright, не создаёт файловый профиль браузера, не хранит cookie или секреты, не открывает URL, не выполняет click/type/form submit, не работает с Telegram и не добавляет background execution. Он также не даёт разрешения на подключение личных аккаунтов.

Перед появлением реального browser adapter обязательны общий `ToolExecutor → PolicyEngine`, immutable approval consumption для L3/L4, идемпотентность/recovery и отдельный owner-mediated human takeover transport. CAPTCHA, MFA, логины и ввод персональных данных остаются ручными действиями владельца без обхода защит.

## Последствия

Система уже умеет явно и проверяемо выразить два режима профиля и безопасно держать состояние human takeover. Однако это не является собственным браузером в эксплуатационном смысле. Реальный Chromium runtime появится лишь после обязательного общего execution gate и выбранного владельцем hosting/profile transport.
