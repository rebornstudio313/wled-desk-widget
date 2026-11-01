use crate::Context;
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    fs,
};
use tauri::State;
#[derive(Clone, Serialize, Deserialize)]
pub struct Targets {
    source: String,
    targets: Vec<String>,
}
fn read(ctx: &Context) -> Result<HashMap<String, Vec<String>>, String> {
    let file = ctx.file.with_file_name("sync-targets.json");
    if !file.exists() {
        return Ok(HashMap::new());
    }
    serde_json::from_slice(&fs::read(file).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}
pub fn prune(ctx: &Context) -> Result<(), String> {
    let ids: HashSet<String> = ctx
        .devices
        .lock()
        .map_err(|_| "Список занят")?
        .iter()
        .map(|d| d.id.clone())
        .collect();
    let mut data = read(ctx)?;
    let before = data.clone();
    data.retain(|source, targets| {
        targets.retain(|id| ids.contains(id));
        ids.contains(source)
    });
    if data != before {
        let file = ctx.file.with_file_name("sync-targets.json");
        let temp = file.with_extension("tmp");
        fs::write(
            &temp,
            serde_json::to_vec_pretty(&data).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        if file.exists() {
            fs::copy(&file, file.with_extension("bak")).map_err(|e| e.to_string())?;
        }
        fs::rename(temp, file).map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
pub fn list_sync_targets(ctx: State<'_, Context>) -> Result<HashMap<String, Vec<String>>, String> {
    read(&ctx)
}
#[tauri::command]
pub async fn save_sync_targets(
    source: String,
    targets: Vec<String>,
    ctx: State<'_, Context>,
) -> Result<Targets, String> {
    let _guard = ctx.writes.lock().await;
    {
        let devices = ctx.devices.lock().map_err(|_| "Список занят")?;
        if !devices.iter().any(|d| d.id == source) {
            return Err("Исходная лампа удалена".into());
        }
        let mut seen = HashSet::new();
        for id in &targets {
            if id == &source || !seen.insert(id) || !devices.iter().any(|d| &d.id == id) {
                return Err("Неверный выбор ламп".into());
            }
        }
    }
    let mut data = read(&ctx)?;
    data.insert(source.clone(), targets.clone());
    let file = ctx.file.with_file_name("sync-targets.json");
    let temp = file.with_extension("tmp");
    fs::write(
        &temp,
        serde_json::to_vec_pretty(&data).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    if file.exists() {
        fs::copy(&file, file.with_extension("bak")).map_err(|e| e.to_string())?;
    }
    fs::rename(temp, file).map_err(|e| e.to_string())?;
    Ok(Targets { source, targets })
}
