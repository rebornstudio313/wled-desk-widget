# UI и Windows проверки

`pnpm test:ui` запускает поддерживаемую регрессионную подборку scripts/regression.mjs на изолированных локальных WLED fixtures. Нужны Playwright и Edge. Сеть домашних ламп не используется. Каждый тест имеет свой порт и временный профиль. Если Playwright находится вне проекта, можно задать PLAYWRIGHT_MODULE как file URL его index.mjs.

Дополнительные Windows-тесты: single-instance-smoke.ps1 и window-motion-smoke.ps1. Запускаются из корня проекта после сборки release-local/wled-desk-widget.exe и оставляют один открытый виджет. Проверяют возврат из трея, повторные запуски, отсутствие системной рамки, нативное отсечение углов и сохранение позиции. Реальную перезагрузку не выполняют.

Исторические тесты ui-smoke, peek-smoke, compact-smoke, combine-smoke и realtime-smoke используют старые селекторы и не входят в текущую подборку. Их сценарии покрываются актуальными menu/lamp-picker/hotkeys/palettes/peek-settings/peek-recovery/sync-targets тестами; при развитии соответствующих возможностей исторические файлы следует заменить, а не считать прошедшими.
