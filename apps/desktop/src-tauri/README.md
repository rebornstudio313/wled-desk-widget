# Нативная оболочка — исходники без подтверждённой сборки

Необходимы Rust, MSVC C++ Build Tools и Windows SDK по инструкции Tauri.
В Node prototype нативный CLI не установлен. На этапе native build добавьте
@tauri-apps/cli совместимой версии и выполняйте его из apps/desktop (рядом src-tauri).
Проверить рабочую директорию beforeDevCommand и закрепить Rust-зависимости Cargo.lock.
До фактической компиляции команды native build и исходники считаются непроверенными.
Сетевые сценарии текущего этапа проверены только через Node preview backend.
