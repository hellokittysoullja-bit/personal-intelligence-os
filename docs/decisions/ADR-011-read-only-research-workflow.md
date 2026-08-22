# ADR-011: Первый workflow — исследование только на чтение

**Статус:** Accepted  
**Дата:** 2026-08-22

## Контекст

PIOS уже хранит Mission, MissionContract и append-only audit events, но не умеет исполнять полезную работу. Первым исполнительным срезом нужен workflow, который проверяет оркестрацию, evidence, остановку и проверку результата, не изменяя внешние системы.

## Решение

После явного подтверждения контракта владелец может начать `read-only research` миссию. Workflow имеет фиксированный малый граф: `CollectSources → ExtractEvidence → SynthesizeReport → VerifyReport`. Все шаги ограничены миссионным budget и policy уровня L1.

Каждый источник и вывод сохраняется как evidence с URL, временем получения, извлечённым фрагментом, источником получения и confidence. Внешние HTTP-запросы разрешены только для `http`/`https` публичных URL; loopback, private/link-local сети, metadata endpoints и файловые схемы запрещены. Содержимое источника — данные, не инструкции.

Первый срез не включает отправку сообщений, публикацию, запись в внешние системы, выполнение скачанных файлов, browser login, scraping с обходом защит, автономные финансовые действия или самостоятельное изменение кода/политик. При ошибке workflow останавливается с audit event; повтор возможен только через отдельный управляемый переход.

## Последствия

Срез создаёт реальные Task и Evidence/Artifact записи, `MissionResearchStarted`, `ResearchSourceCaptured`, `ResearchReportReady` события и итоговый Markdown-отчёт. Он не требует сразу добавлять многоагентность, Telegram, Chromium или полностью автономный worker. В дальнейшем source collector может быть заменён browser runtime без изменения доменной модели.

## Альтернативы

1. Сразу дать модели browser и Telegram — отклонено: одновременно появляются prompt injection, SSRF, credentials и внешние write-риски.
2. Построить сначала общий multi-agent framework — отклонено: нет пользовательской ценности и evaluation baseline.
3. Оставить только ручной контракт — отклонено: не проверяет execution plane.
