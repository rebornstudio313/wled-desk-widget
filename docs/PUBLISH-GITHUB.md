# Публикация

Название: **WLED Desk | Widget**. Предлагаемый репозиторий: **rebornstudio313/wled-desk-widget**.
Описание: Desktop widget for WLED on ESP32 and ESP8266 — colors, effects, presets and live LED preview.
Темы: wled, esp32, esp8266, led, rgb, windows, tauri, desktop-widget.

README использует относительные ссылки и локальный баннер. Домашняя страница — README
репозитория; отдельный GitHub Pages сайт для этого не требуется. Пять альтернативных
README находятся в `docs/readme-options`, концепт-лист — в `assets/design`.

В репозиторий включаются исходники, Cargo.lock/pnpm-lock, документация, тесты,
публичные скриншоты, векторные оригиналы иконок. Не включаются `.local`, node_modules,
dist, target, ключи, профили ламп и установщики. Бинарные файлы публикуются отдельно
в Releases после проверки. Пакет исходников формируется allowlist-скриптом.

Первый релиз — pre-release `v0.1.0-alpha.1`. Приложить setup.exe, необязательный
отдельный EXE, SHA256SUMS.txt и заметки о статусе подписи/проверок. Не помечать Latest
и не обещать стабильность до проверок Windows. Права GitHub Actions по умолчанию read-only.
