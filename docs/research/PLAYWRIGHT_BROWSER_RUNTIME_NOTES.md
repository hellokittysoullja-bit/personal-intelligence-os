# Playwright browser runtime design notes

Дата проверки: 2026-08-23.

Официальная документация Playwright подтверждает, что `launchPersistentContext(userDataDir)` использует persistent storage и одновременно допускает только одну browser instance на один `userDataDir`. Она также предупреждает, что автоматизация default Chrome user profile не поддерживается: использовать основной `User Data` каталог ежедневного Chrome может приводить к незагружающимся страницам или завершению browser. Для PIOS это означает, что даже owner-controlled shared mode обязан использовать **отдельный PIOS-controlled directory**, а не default профиль владельца.[1]

Playwright требует соответствующий browser binary для своей версии; Chromium browser/OS dependencies должны быть установлены отдельным контролируемым шагом. Документация указывает поддержку Ubuntu 24.04 и актуального Node 22.x, что совместимо с целевой runtime средой, но не означает, что browser уже установлен в PIOS.[2] [3]

Следствие для текущего дизайна: owner-shared profile означает human-controlled отдельный PIOS browser profile, а не неограниченный доступ или привязку к ежедневному Chrome владельца. Логины, MFA/CAPTCHA и личные данные останутся human takeover. Перед real launch необходимы отдельная installation/deployment процедура, ToolExecutor/PolicyEngine (уже подготовлены) и profile locking.

## References

[1]: https://playwright.dev/docs/api/class-browsertype "Playwright BrowserType — launchPersistentContext"
[2]: https://playwright.dev/docs/intro "Playwright Installation and system requirements"
[3]: https://playwright.dev/docs/browsers "Playwright Browsers and binary installation"
