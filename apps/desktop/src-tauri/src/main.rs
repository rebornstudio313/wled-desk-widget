#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod devices;
mod frame;
mod peek;
mod position;
mod scenes;
mod shell;
mod state;
mod sync_targets;
use devices::{address, find};
mod discovery;
mod hotkeys;
mod startup;
mod updates;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{fs, path::PathBuf, sync::Mutex, time::Duration};
use tauri::Manager;
#[derive(Clone, Serialize, Deserialize)]
struct Device {
    id: String,
    name: String,
    address: String,
    identity: Option<String>,
}
struct Context {
    states: peek::Streams,
    peeks: peek::Streams,
    devices: Mutex<Vec<Device>>,
    writes: tokio::sync::Mutex<()>,
    file: PathBuf,
    client: reqwest::Client,
}
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let handle = app.clone();
            let _ = app.run_on_main_thread(move || shell::show(&handle));
        }))
        .on_window_event(shell::on_window_event)
        .setup(|app| {
            let folder = app.path().app_data_dir()?;
            fs::create_dir_all(&folder)?;
            let file = folder.join("devices.json");
            let devices = if file.exists() {
                let data: Value = serde_json::from_slice(&fs::read(&file)?)?;
                if data["schemaVersion"] != 1 {
                    return Err("Неизвестная версия профиля".into());
                }
                let loaded: Vec<Device> = serde_json::from_value(data["devices"].clone())?;
                for d in &loaded {
                    address(&d.address).map_err(std::io::Error::other)?;
                }
                loaded
            } else {
                Vec::new()
            };
            app.manage(Context {
                states: Mutex::new(Default::default()),
                peeks: Mutex::new(Default::default()),
                devices: Mutex::new(devices),
                writes: tokio::sync::Mutex::new(()),
                file,
                client: reqwest::Client::builder()
                    .timeout(Duration::from_secs(5))
                    .redirect(reqwest::redirect::Policy::none())
                    .build()?,
            });
            app.manage(hotkeys::Hotkeys::default());
            app.manage(discovery::Discovery::default());
            shell::setup(app)?;
            if let Some(window) = app.get_webview_window("main") {
                frame::install(&window)?;
            }
            position::setup(app)?;
            if let Some(window) = app.get_webview_window("main") {
                frame::round(&window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            startup::startup_status,
            startup::configure_startup,
            devices::palette_previews,
            updates::check_updates,
            updates::get_build_info,
            updates::open_release,
            discovery::discover_devices,
            hotkeys::configure_hotkeys,
            sync_targets::list_sync_targets,
            sync_targets::save_sync_targets,
            state::watch_state,
            state::unwatch_state,
            devices::list_devices,
            devices::add_device,
            devices::rename_device,
            devices::remove_device,
            devices::refresh_device,
            devices::patch_state,
            peek::start_peek,
            peek::stop_peek,
            scenes::list_scenes,
            scenes::save_scene,
            shell::hide_widget,
            shell::resize_widget,
            shell::pin_widget
        ])
        .run(tauri::generate_context!())
        .expect("Не удалось запустить WLED Desk | Widget");
}
