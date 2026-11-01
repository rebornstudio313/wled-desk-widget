// Persistent WLED scene slots.
use crate::Context;
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};
use tauri::State;
#[derive(Clone, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase", deny_unknown_fields)]
enum Action {
    Preset {
        #[serde(rename = "presetId")]
        preset_id: u16,
    },
    Custom {
        on: bool,
        bri: u8,
        color: String,
        effect: String,
        speed: u8,
        intensity: u8,
    },
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Target {
    device_id: String,
    action: Action,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Scene {
    slot: String,
    targets: Vec<Target>,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Store {
    schema_version: u8,
    scenes: Vec<Scene>,
}
fn valid(scene: &Scene) -> Result<(), String> {
    if !["work", "evening", "cinema"].contains(&scene.slot.as_str()) || scene.targets.len() > 64 {
        return Err("Неверный сценарий".into());
    }
    let mut seen = std::collections::HashSet::new();
    for t in &scene.targets {
        if t.device_id.is_empty() || t.device_id.len() > 100 || !seen.insert(&t.device_id) {
            return Err("Неверный список ламп".into());
        }
        match &t.action {
            Action::Preset { preset_id } => {
                if !(1..=250).contains(preset_id) {
                    return Err("Неверный пресет".into());
                }
            }
            Action::Custom {
                bri, color, effect, ..
            } => {
                if *bri == 0
                    || color.len() != 7
                    || !color.starts_with('#')
                    || !color.as_bytes()[1..].iter().all(|b| b.is_ascii_hexdigit())
                    || effect.trim().is_empty()
                    || effect.len() > 100
                {
                    return Err("Проверьте параметры сценария".into());
                }
            }
        }
    }
    Ok(())
}
fn load(path: &Path) -> Result<Store, String> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Ok(Store {
                schema_version: 1,
                scenes: Vec::new(),
            })
        }
        Err(e) => return Err(e.to_string()),
    };
    let store: Store = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    if store.schema_version != 1 || store.scenes.len() > 3 {
        return Err("Неверный файл сценариев".into());
    }
    let mut slots = std::collections::HashSet::new();
    for scene in &store.scenes {
        valid(scene)?;
        if !slots.insert(&scene.slot) {
            return Err("Повтор сценария".into());
        }
    }
    Ok(store)
}
pub fn prune(ctx: &Context) -> Result<(), String> {
    let ids: std::collections::HashSet<String> = ctx
        .devices
        .lock()
        .map_err(|_| "Хранилище занято")?
        .iter()
        .map(|d| d.id.clone())
        .collect();
    let path = ctx.file.with_file_name("scenes.json");
    let mut store = load(&path)?;
    let mut changed = false;
    for scene in &mut store.scenes {
        let before = scene.targets.len();
        scene.targets.retain(|t| ids.contains(&t.device_id));
        changed |= before != scene.targets.len();
    }
    if changed {
        let temp = path.with_extension("json.tmp");
        fs::write(
            &temp,
            serde_json::to_vec_pretty(&store).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        fs::copy(&path, path.with_extension("json.bak")).map_err(|e| e.to_string())?;
        fs::rename(temp, path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
pub async fn list_scenes(ctx: State<'_, Context>) -> Result<Vec<Scene>, String> {
    let _guard = ctx.writes.lock().await;
    prune(&ctx)?;
    let path = ctx.file.with_file_name("scenes.json");
    Ok(load(&path)?.scenes)
}
#[tauri::command]
pub async fn save_scene(scene: Scene, ctx: State<'_, Context>) -> Result<Scene, String> {
    let _guard = ctx.writes.lock().await;
    valid(&scene)?;
    {
        let devices = ctx.devices.lock().map_err(|_| "Хранилище занято")?;
        if scene
            .targets
            .iter()
            .any(|t| !devices.iter().any(|d| d.id == t.device_id))
        {
            return Err("Лампа удалена. Уберите её из сценария".into());
        }
    }
    let path = ctx.file.with_file_name("scenes.json");
    let mut store = load(&path)?;
    store.scenes.retain(|s| s.slot != scene.slot);
    store.scenes.push(scene.clone());
    let temp = path.with_extension("json.tmp");
    fs::write(
        &temp,
        serde_json::to_vec_pretty(&store).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    if path.exists() {
        fs::copy(&path, path.with_extension("json.bak")).map_err(|e| e.to_string())?;
    }
    fs::rename(temp, path).map_err(|e| e.to_string())?;
    Ok(scene)
}
