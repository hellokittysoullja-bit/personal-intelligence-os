# ADR-013: Versioned owner memory с review и supersession

- Статус: Принято
- Дата: 2026-08-22

## Контекст

Долговременная память без provenance, lifecycle и дедупликации быстро накапливает противоречия. Автоматическая запись model output в active memory особенно опасна: это превращает ошибочную или инъекционную фразу в будущую инструкцию для системы.

## Решение

Первый memory-срез принимает кандидаты только от владельца. Каждая запись создаётся в статусе `candidate`, затем владелец отдельно выполняет `candidate → approved → active`. Автоматического LLM-to-memory write-пути нет.

При activation application service ищет активную память с теми же `ownerId + scope + subject`. Если она есть, прежняя запись становится `superseded`, а новая получает `supersedesId`; значение не перезаписывается. PostgreSQL дополнительно удерживает partial unique index, который физически не допускает две `active` записи для того же ключа.

| Аспект | Реализация | Ограничение |
| --- | --- | --- |
| Provenance | Сохраняются source mission/report/evidence IDs и `submittedBy: owner`. | Источник не доказывает истинность содержания сам по себе. |
| Review | Candidate нельзя активировать до отдельного owner approval. | Это не заменяет внимательность владельца при вводе. |
| Конфликт | Supersession создаёт revision chain, старый факт не переписывается. | Семантические дубликаты с разными `subject` требуют будущего curator/evaluation слоя. |
| Forget | Статус `forgotten` исключается из штатного `GET /memories` и retrieval-port. | Append-only audit event остаётся; event содержит только metadata, не `content`. |
| Concurrency | Version проверяется в application и repository update. | Для сложного multi-writer режима нужен будущий policy/lock слой. |

## Последствия

Эта память пригодна как контролируемая база предпочтений, решений и фактов, но не должна трактоваться как «самообучение без ограничений». В следующем срезе добавляются evaluation records и curator proposals, однако их принятие также остаётся за владельцем.

Ни browser, ни Telegram, ни внешние write-интеграции эта ADR не включает.
