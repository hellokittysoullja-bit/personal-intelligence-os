# ADR-019: Versioned browser session control-plane и human takeover

**Статус:** принято.  
**Дата:** 2026-08-23.

## Контекст

`BrowserProfile` описывает режим и ownership отдельного PIOS browser profile, но сам по себе не позволяет безопасно зафиксировать, кто управляет конкретной browser session, когда агент обязан остановиться и когда после human intervention требуется новое наблюдение.

## Решение

Добавлен owner-scoped `BrowserSession` lifecycle с PostgreSQL persistence, optimistic versioning и metadata-only audit events. API и dashboard позволяют только создать session control-plane state, просмотреть его и изменить ownership state.

| Переход | Результат | Инвариант |
| --- | --- | --- |
| `start` | `paused`; isolated profile — `agent`, shared profile — `human`; `reobservationRequired=true` | Никакая page state не предполагается известной агенту. |
| `takeover` | `paused`, control передаётся `human`, re-observation становится обязательным | Агент не может продолжать работу во время ручной сессии. |
| `return-control` | `paused`, control возвращается `agent`, re-observation обязательно | Ручные логины, MFA/CAPTCHA или другие изменения не считаются наблюдёнными автоматически. |
| `record observation` | Только для `agent` control; снимает re-observation и делает session `active` | Сейчас доступно лишь application/runtime boundary, не owner API и не web UI. |
| `close` | `closed`, control `paused`, re-observation снова обязательно | Session больше не может выполнять переходы. |

Каждый mutation требует `expectedVersion`, а repository применяет compare-and-set. Event store хранит только session/profile ID, lifecycle state и version; URL, page text, screenshots, cookies, credentials и profile paths отсутствуют.

## Не входит в этот срез

Создание session не запускает Chromium. API намеренно не предоставляет `observe`, navigation, click, type, upload или download endpoint. В dashboard все формулировки и controls относятся только к control-plane state. Playwright launcher, введённый ADR-018, не wired в API/worker; Chromium binary не установлен.

## Последствия

Следующий browser runtime slice обязан вызывать `record observation` из контролируемого read-only tool path после реального полного observation. Только после этого session может стать active. Внешние browser write actions останутся в `ToolExecutor → PolicyEngine → ApprovalRequest` path; human takeover не может быть обойдён.
