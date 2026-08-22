# ADR-012: Citation-bound отчёты и отдельная verifier capability

- Статус: Принято
- Дата: 2026-08-22

## Контекст

Read-only research workflow уже сохраняет evidence с происхождением и хешем. Модельный черновик без явных ссылок на эти записи нельзя проверять, а сам автор черновика не должен быть единственным судьёй собственной работы.

## Решение

Система хранит `research_reports` как неизменяемые структурированные draft-версии. Каждый summary и claim обязан содержать UUID уже сохранённого evidence. Application use case отклоняет неизвестные ID, отсутствующие claims, неверную JSON-структуру и некорректный результат даже после одной ограниченной repair-попытки.

Отдельный use case создаёт append-only `research_report_verifications`. Он запрашивает capability `verification_strict`, а не имя модели, и возвращает ровно один результат для каждого claim. В verifier result разрешены лишь ссылки, первоначально привязанные к этому claim. Итог `passed` вычисляется программно только тогда, когда каждый claim имеет verdict `supported`; любой `contradicted` или `inconclusive` даёт `needs_review`.

| Граница | Гарантия | Не является гарантией |
| --- | --- | --- |
| Evidence → draft | Claim и summary содержат только существующие evidence IDs. | Сам факт цитирования не доказывает истинность вывода. |
| Draft → verifier | Verifier вызывает отдельную capability `verification_strict`, а не route автора. | Независимость не абсолютна, если владелец намеренно настроит обе capability на одну модель. |
| LLM output → state | Zod/schema, точные citation ID и максимум одна repair-попытка проверяются до записи. | Это не устраняет все ошибки, bias или prompt injection модели. |
| Runtime config | Без `PIOS_MODEL_VERIFICATION_STRICT` API явно возвращает `503 verifier_not_configured`. | Система не создаёт видимость «проверенного» отчёта без verifier. |

## Последствия

В production следует конфигурировать `PIOS_MODEL_VERIFICATION_STRICT` на модель или провайдера, отличный от `PIOS_MODEL_RESEARCH_LONG_CONTEXT`, если требуемая степень независимости оправдывает стоимость. Оба ключа и URL остаются server-side; в браузер передаются только structured drafts и verifier results.

Эта фаза не меняет внешний мир, не открывает browser login, не публикует отчёты и не одобряет действия. Reviewer-результат остаётся советом для владельца, а не разрешением на write-capability.
