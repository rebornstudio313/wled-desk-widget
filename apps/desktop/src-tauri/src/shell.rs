// Native tray lifecycle; requires first Windows build/QA before shipping.
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
pub struct TrayReady;

pub fn show(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        crate::position::ensure_visible(&window);
        let _ = window.set_skip_taskbar(false);
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        crate::frame::round(&window);
    }
}
fn hide(app: &tauri::AppHandle) -> Result<(), String> {
    crate::position::flush(app);
    if app.try_state::<TrayReady>().is_none() {
        return Err("Значок в трее ещё не готов".into());
    }
    let window = app.get_webview_window("main").ok_or("Окно не найдено")?;
    window.set_skip_taskbar(true).map_err(|e| e.to_string())?;
    if let Err(error) = window.hide() {
        crate::position::ensure_visible(&window);
        let _ = window.set_skip_taskbar(false);
        return Err(error.to_string());
    }
    Ok(())
}
pub fn setup(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show_widget", "Показать виджет", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide_widget", "Скрыть виджет", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit_widget", "Выход", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;
    let icon = Image::from_bytes(include_bytes!("../icons/tray-32.png"))?;
    if let Some(window) = app.get_webview_window("main") {
        window.set_icon(Image::from_bytes(include_bytes!("../icons/app-256.png"))?)?;
    }
    TrayIconBuilder::with_id("widget-led-rgb-tray")
        .icon(icon)
        .tooltip("WLED Desk | Widget — нажмите, чтобы показать")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show_widget" => show(app),
            "hide_widget" => {
                let _ = hide(app);
            }
            "quit_widget" => {
                crate::position::flush(app);
                app.exit(0)
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show(tray.app_handle());
            }
        })
        .build(app)?;
    app.manage(TrayReady);
    Ok(())
}
pub fn on_window_event(window: &tauri::Window, event: &WindowEvent) {
    if window.label() == "main" {
        match event {
            WindowEvent::Moved(_) => crate::position::record(window.app_handle()),
            WindowEvent::Resized(_) => {
                if let Some(w) = window.app_handle().get_webview_window("main") {
                    crate::frame::round(&w);
                }
                crate::position::record(window.app_handle());
            }
            WindowEvent::ScaleFactorChanged { .. } => {
                if let Some(w) = window.app_handle().get_webview_window("main") {
                    crate::position::ensure_visible(&w);
                }
                crate::position::record(window.app_handle());
            }
            _ => {}
        }
    }

    if let WindowEvent::CloseRequested { api, .. } = event {
        if window.app_handle().try_state::<TrayReady>().is_some() {
            if hide(window.app_handle()).is_ok() {
                api.prevent_close();
            }
        }
    }
}
#[tauri::command]
pub fn hide_widget(app: tauri::AppHandle) -> Result<(), String> {
    hide(&app)
}
#[tauri::command]
pub fn resize_widget(app: tauri::AppHandle, height: u32) -> Result<(), String> {
    if !(180..=920).contains(&height) {
        return Err("Неверный размер окна".into());
    }
    let window = app.get_webview_window("main").ok_or("Окно не найдено")?;
    window
        .set_size(tauri::LogicalSize::new(320.0, height as f64))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pin_widget(app: tauri::AppHandle, pinned: bool) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Окно не найдено")?;
    window.set_always_on_top(pinned).map_err(|e| e.to_string())
}
