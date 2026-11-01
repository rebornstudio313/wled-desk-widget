use crate::Context;
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Preferences {
    start_hidden: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    enabled: bool,
    start_hidden: bool,
}
fn launcher() -> Result<auto_launch::AutoLaunch, String> {
    let path = std::env::current_exe().map_err(|_| "Не найден путь приложения")?;
    auto_launch::AutoLaunchBuilder::new()
        .set_app_name("WLED Desk Widget")
        .set_app_path(&format!("\"{}\"", path.display()))
        .set_windows_enable_mode(auto_launch::WindowsEnableMode::CurrentUser)
        .set_args(&["--autostart"])
        .build()
        .map_err(|_| "Не удалось подготовить автозагрузку".to_string())
}
fn preferences(ctx: &Context) -> Preferences {
    std::fs::read(ctx.file.with_file_name("startup.json"))
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}
#[tauri::command]
pub fn startup_status(_app: tauri::AppHandle, ctx: State<Context>) -> Result<Status, String> {
    Ok(Status {
        enabled: launcher()?
            .is_enabled()
            .map_err(|_| "Не удалось прочитать автозагрузку Windows")?,
        start_hidden: preferences(&ctx).start_hidden,
    })
}
#[tauri::command]
pub async fn configure_startup(
    enabled: bool,
    start_hidden: bool,
    _app: tauri::AppHandle,
    ctx: State<'_, Context>,
) -> Result<Status, String> {
    let _guard = ctx.writes.lock().await;
    let launcher = launcher()?;
    if enabled {
        launcher.enable()
    } else if launcher.is_enabled().unwrap_or(false) {
        launcher.disable()
    } else {
        Ok(())
    }
    .map_err(|_| "Не удалось изменить автозагрузку Windows")?;
    let file = ctx.file.with_file_name("startup.json");
    let temp = file.with_extension("tmp");
    std::fs::write(
        &temp,
        serde_json::to_vec(&Preferences { start_hidden }).unwrap(),
    )
    .map_err(|_| "Не удалось сохранить настройку запуска")?;
    std::fs::rename(temp, file).map_err(|_| "Не удалось сохранить настройку запуска")?;
    Ok(Status {
        enabled: launcher
            .is_enabled()
            .map_err(|_| "Не удалось проверить автозагрузку")?,
        start_hidden,
    })
}
pub fn should_hide(app: &tauri::App) -> bool {
    std::env::args().any(|v| v == "--autostart")
        && app
            .try_state::<Context>()
            .map(|ctx| preferences(&ctx).start_hidden)
            .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    #[test]
    fn registry_round_trip() {
        let exe = std::env::current_exe().unwrap();
        let name = format!("WLED Desk Test {}", uuid::Uuid::new_v4());
        let launch = auto_launch::AutoLaunchBuilder::new()
            .set_app_name(&name)
            .set_app_path(&format!("\"{}\"", exe.display()))
            .set_args(&["--autostart"])
            .set_windows_enable_mode(auto_launch::WindowsEnableMode::CurrentUser)
            .build()
            .unwrap();
        assert!(!launch.is_enabled().unwrap());
        launch.enable().unwrap();
        let enabled = launch.is_enabled().unwrap();
        let removed = launch.disable();
        assert!(enabled);
        removed.unwrap();
        assert!(!launch.is_enabled().unwrap());
    }
}
