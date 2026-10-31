# Сборка Windows x64

Нужны Node.js 24, pnpm 11.25.0, Rust 1.99.1 MSVC, Microsoft C++ Build Tools
(Desktop development with C++), Windows SDK и WebView2. Инструменты установки
не входят в пакет исходников. Cargo.lock нужно сохранить после успешного разрешения зависимостей.

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm build:native
```

Скрипт строит интерфейс, запускает Tauri/NSIS из `apps/desktop` и копирует результаты
в `release-local/`: EXE приложения, setup.exe, SHA256SUMS.txt. Каталог игнорируется Git.
Не запускайте прямой `tauri build` без предварительной сборки интерфейса.

В GitHub Actions предусмотрен ручной workflow **Windows installer**. Он собирает
артефакты, но не публикует Release и не объявляет сборку стабильной.

Перед выпуском проверить чистую установку, первое подключение, повторный запуск,
сценарии, Peek, компактный режим, трей/возврат/выход, деинсталляцию, DPI 100–200%.
Не выполнять проверки изменения цвета на чужих устройствах без разрешения.

[Prerequisites Tauri](https://v2.tauri.app/start/prerequisites/) ·
[Windows installer](https://v2.tauri.app/distribute/windows-installer/).
