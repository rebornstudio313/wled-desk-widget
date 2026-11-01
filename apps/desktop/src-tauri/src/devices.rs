use crate::{Context, Device};
use serde_json::{json, Value};
use std::{fs, net::Ipv4Addr};
use tauri::State;
pub(crate) fn address(input: &str) -> Result<String, String> {
    let full = if input.contains("://") {
        input.trim().to_string()
    } else {
        format!("http://{}", input.trim())
    };
    let url = reqwest::Url::parse(&full).map_err(|_| "Неверный адрес")?;
    if !["http", "https"].contains(&url.scheme())
        || !url.username().is_empty()
        || url.password().is_some()
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("Нужен локальный URL без пути и credentials".into());
    }
    let host = url.host_str().ok_or("Нет имени хоста")?;
    let local = host
        .parse::<Ipv4Addr>()
        .map(|ip| ip.is_private() || ip.is_loopback())
        .unwrap_or(false);
    if !local && host != "localhost" && !host.ends_with(".local") {
        return Err("Нужен локальный IPv4 или .local".into());
    }
    Ok(url.origin().ascii_serialization())
}
pub(crate) fn find(ctx: &Context, id: &str) -> Result<Device, String> {
    ctx.devices
        .lock()
        .map_err(|_| "Хранилище занято")?
        .iter()
        .find(|d| d.id == id)
        .cloned()
        .ok_or("Лампа не найдена".into())
}
fn save(ctx: &Context, devices: &[Device]) -> Result<(), String> {
    let temp = ctx.file.with_extension("tmp");
    fs::write(
        &temp,
        serde_json::to_vec_pretty(&json!({"schemaVersion":1,"devices":devices}))
            .map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    if ctx.file.exists() {
        fs::copy(&ctx.file, ctx.file.with_extension("bak")).map_err(|e| e.to_string())?;
    }
    fs::rename(temp, &ctx.file).map_err(|e| e.to_string())
}
async fn get(ctx: &Context, base: &str, path: &str) -> Result<Value, String> {
    ctx.client
        .get(format!("{base}{path}"))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())
}
async fn read(ctx: &Context, base: &str) -> Result<Value, String> {
    let info = get(ctx, base, "/json/info").await?;
    let state = get(ctx, base, "/json/state").await?;
    let effects = get(ctx, base, "/json/eff").await?;
    if !info["ver"].is_string()
        || !info["leds"]["count"].is_number()
        || !state["on"].is_boolean()
        || state["seg"]
            .as_array()
            .map(|a| a.is_empty())
            .unwrap_or(true)
        || !effects.is_array()
    {
        return Err("Ответ не похож на WLED".into());
    }
    let presets = get(ctx, base, "/presets.json").await.unwrap_or(json!({}));
    let palettes = get(ctx, base, "/json/pal")
        .await
        .ok()
        .filter(|v| {
            v.as_array()
                .map(|a| a.iter().all(Value::is_string))
                .unwrap_or(false)
        })
        .unwrap_or(json!([]));
    Ok(json!({"info":info,"state":state,"effects":effects,"presets":presets,"palettes":palettes}))
}
#[tauri::command]
pub fn list_devices(ctx: State<Context>) -> Result<Vec<Device>, String> {
    Ok(ctx.devices.lock().map_err(|_| "Хранилище занято")?.clone())
}
#[tauri::command]
pub async fn palette_previews(id: String, ctx: State<'_, Context>) -> Result<Value, String> {
    let d = find(&ctx, &id)?;
    let mut out = serde_json::Map::new();
    for page in 0..64 {
        let v = get(&ctx, &d.address, &format!("/json/palx?page={page}")).await?;
        let Some(values) = v["p"].as_object() else {
            break;
        };
        for (k, value) in values {
            if k.parse::<u16>().map(|v| v <= 255).unwrap_or(false) {
                out.insert(k.clone(), value.clone());
            }
        }
        if page >= v["m"].as_u64().unwrap_or(0).min(63) {
            break;
        }
    }
    Ok(Value::Object(out))
}
#[tauri::command]
pub async fn refresh_device(id: String, ctx: State<'_, Context>) -> Result<Value, String> {
    let d = find(&ctx, &id)?;
    read(&ctx, &d.address).await
}
#[tauri::command]
pub async fn add_device(address: String, ctx: State<'_, Context>) -> Result<Device, String> {
    let base = self::address(&address)?;
    let data = read(&ctx, &base).await?;
    let mut devices = ctx.devices.lock().map_err(|_| "Хранилище занято")?;
    let identity = data["info"]["mac"].as_str().map(str::to_string);
    if devices
        .iter()
        .any(|d| d.address == base || (identity.is_some() && d.identity == identity))
    {
        return Err("Лампа уже добавлена".into());
    }
    let d = Device {
        id: uuid::Uuid::new_v4().to_string(),
        name: data["info"]["name"].as_str().unwrap_or("WLED").into(),
        address: base,
        identity,
    };
    let mut next = devices.clone();
    next.push(d.clone());
    save(&ctx, &next)?;
    *devices = next;
    Ok(d)
}
#[tauri::command]
pub fn rename_device(id: String, name: String, ctx: State<Context>) -> Result<Device, String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 48 || name.chars().any(char::is_control) {
        return Err("Название должно содержать от 1 до 48 символов".into());
    }
    let mut devices = ctx.devices.lock().map_err(|_| "Хранилище занято")?;
    let mut next = devices.clone();
    let device = next
        .iter_mut()
        .find(|d| d.id == id)
        .ok_or("Лампа не найдена")?;
    device.name = name.into();
    let renamed = device.clone();
    save(&ctx, &next)?;
    *devices = next;
    Ok(renamed)
}
#[tauri::command]
pub async fn remove_device(id: String, ctx: State<'_, Context>) -> Result<(), String> {
    let _guard = ctx.writes.lock().await;
    {
        let mut devices = ctx.devices.lock().map_err(|_| "Хранилище занято")?;
        let next: Vec<_> = devices.iter().filter(|d| d.id != id).cloned().collect();
        save(&ctx, &next)?;
        *devices = next;
    }
    crate::scenes::prune(&ctx)?;
    crate::sync_targets::prune(&ctx)?;
    crate::peek::stop_device(&ctx, &id);
    if let Ok(mut streams) = ctx.states.lock() {
        streams.retain(|_, (device, task)| {
            if device == &id {
                task.abort();
                false
            } else {
                true
            }
        });
    }
    Ok(())
}
fn check_patch(patch: &Value) -> Result<(), String> {
    let object = patch.as_object().ok_or("Неверная команда")?;
    if object
        .keys()
        .any(|k| !["on", "bri", "ps", "seg"].contains(&k.as_str()))
    {
        return Err("Неподдерживаемое поле".into());
    }
    if let Some(v) = object.get("on") {
        if !v.is_boolean() {
            return Err("Неверное питание".into());
        }
    }
    for (key, min, max) in [("bri", 1, 255), ("ps", 1, 250)] {
        if let Some(v) = object.get(key) {
            if !v.as_u64().map(|n| n >= min && n <= max).unwrap_or(false) {
                return Err("Неверный параметр".into());
            }
        }
    }
    if let Some(segments) = object.get("seg") {
        let list = segments.as_array().ok_or("Неверный сегмент")?;
        if list.len() != 1 {
            return Err("Неверный сегмент".into());
        }
        for s in list {
            let obj = s.as_object().ok_or("Неверный сегмент")?;
            if obj
                .keys()
                .any(|k| !["id", "fx", "sx", "ix", "col", "pal"].contains(&k.as_str()))
                || !s["id"].as_u64().map(|v| v <= 255).unwrap_or(false)
            {
                return Err("Неверные поля сегмента".into());
            }
            for key in ["fx", "sx", "ix", "pal"] {
                if let Some(v) = obj.get(key) {
                    if !v.as_u64().map(|v| v <= 255).unwrap_or(false) {
                        return Err("Неверный эффект".into());
                    }
                }
            }
            if let Some(v) = obj.get("col") {
                let colors = v.as_array().ok_or("Неверный цвет")?;
                if colors.len() != 1 {
                    return Err("Неверный цвет".into());
                }
                let rgb = colors[0].as_array().ok_or("Неверный RGB")?;
                if rgb.len() != 3
                    || !rgb
                        .iter()
                        .all(|v| v.as_u64().map(|v| v <= 255).unwrap_or(false))
                {
                    return Err("Неверный RGB".into());
                }
            }
        }
    }
    Ok(())
}
#[tauri::command]
pub async fn patch_state(
    id: String,
    patch: Value,
    ctx: State<'_, Context>,
) -> Result<Value, String> {
    check_patch(&patch)?;
    let _guard = ctx.writes.lock().await;
    let d = find(&ctx, &id)?;
    let ack: Value = ctx
        .client
        .post(format!("{}/json/state", d.address))
        .json(&patch)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    if ack["success"] == false || ack.get("error").is_some() {
        return Err("WLED отклонил команду".into());
    }
    read(&ctx, &d.address).await
}
