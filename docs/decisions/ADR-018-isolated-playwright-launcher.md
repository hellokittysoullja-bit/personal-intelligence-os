# ADR-018: Isolated Playwright launcher без default Chrome profile

**Статус:** принято.  
**Дата:** 2026-08-23.

## Контекст

PIOS должен получить собственный browser runtime, но «общий» режим не должен означать неограниченную автоматизацию ежедневного Chrome владельца. Официальная документация Playwright предупреждает, что автоматизация default Chrome `User Data` directory не поддерживается и может ломать загрузку страниц либо завершать browser. Persistent context допускает лишь один browser instance на directory.[1]

## Решение

Добавлен `@pios/browser-runtime` с минимальным `IsolatedPersistentBrowserLauncher`. Он принимает только active `agent_isolated` `BrowserProfile` и получает profile directory строго как `<configured PIOS profile root>/<profile UUID>`. Label владельца, default Chrome path и произвольный filesystem path не участвуют в выборе directory.

Launcher использует Playwright persistent context со следующими baseline options: `headless: true` по умолчанию, `acceptDownloads: false`, `chromiumSandbox: true`, `bypassCSP: false`. Сразу после запуска context получает route guard: каждая future request URL проходит тот же public HTTP(S) SSRF guard, что и read-only source reader; credentials, non-standard ports, localhost/private addresses блокируются. Это снижает риск SSRF, но не отменяет опубликованную оговорку про DNS rebinding до production network isolation.

`owner_shared` profile намеренно отклоняется launcher-ом: до появления отдельного human takeover transport он не может быть автоматически открыт. В будущем такой режим будет отдельным **PIOS-controlled profile directory**, а не default Chrome profile владельца. CAPTCHA, MFA, login и персональные данные остаются ручными.

## Не входит в этот срез

Playwright library зафиксирована как dependency, но Chromium binary не установлен, не скачан и не запускается. Нет environment wiring, Docker/browser installation layer, profile directory creation, persistence session manager, navigation/observe/click/type tools, ToolRegistry, API route, worker execution, account connection или shared-profile transport. Никаких сайтов не открывалось.

## Последствия

Код теперь имеет проверяемый и изолированный launch contract для будущего собственно browser runtime, но не является доступным пользователю браузером. Следующий срез обязан добавить versioned session orchestration и read-only observation ToolDefinition через `ToolExecutor → PolicyEngine`; внешние writes останутся approval-gated.

## References

[1]: https://playwright.dev/docs/api/class-browsertype "Playwright BrowserType — persistent context and default Chrome profile warning"
