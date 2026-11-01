use crate::{Context, Device};
use futures_util::{stream, StreamExt};
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    time::{Duration, Instant},
};
#[derive(Clone, Serialize)]
pub struct Found {
    pub name: String,
    pub address: String,
    pub identity: Option<String>,
    pub version: String,
    pub leds: u64,
}
#[derive(Default)]
pub struct Discovery(pub tokio::sync::Mutex<()>);
fn identity(value: &str) -> String {
    value
        .chars()
        .filter(|c| *c != ':' && *c != '-')
        .collect::<String>()
        .to_ascii_lowercase()
}
fn candidate(ip: std::net::Ipv4Addr, port: u16) -> Option<String> {
    if port == 0 || !ip.is_private() {
        return None;
    }
    crate::address(&format!("http://{ip}:{port}")).ok()
}
fn mdns() -> Vec<String> {
    let Ok(daemon) = mdns_sd::ServiceDaemon::new() else {
        return Vec::new();
    };
    let Ok(events) = daemon.browse("_wled._tcp.local.") else {
        let _ = daemon.shutdown();
        return Vec::new();
    };
    let end = Instant::now() + Duration::from_secs(4);
    let mut urls = HashSet::new();
    while Instant::now() < end {
        if let Ok(mdns_sd::ServiceEvent::ServiceResolved(info)) =
            events.recv_timeout(Duration::from_millis(150))
        {
            for ip in info.get_addresses_v4() {
                if let Some(url) = candidate(ip, info.get_port()) {
                    urls.insert(url);
                }
            }
        }
        if urls.len() >= 256 {
            break;
        }
    }
    let _ = daemon.stop_browse("_wled._tcp.local.");
    if let Ok(done) = daemon.shutdown() {
        let _ = done.recv_timeout(Duration::from_secs(1));
    }
    urls.into_iter().collect()
}
fn node_addresses(data: &Value) -> Vec<String> {
    data["nodes"]
        .as_array()
        .into_iter()
        .flatten()
        .take(256)
        .filter_map(|node| {
            let ip = node["ip"].as_str()?.parse::<std::net::Ipv4Addr>().ok()?;
            candidate(ip, 80)
        })
        .collect()
}
async fn json(client: &reqwest::Client, url: &str, path: &str) -> Option<Value> {
    let mut response = client
        .get(format!("{url}{path}"))
        .timeout(Duration::from_millis(1600))
        .send()
        .await
        .ok()?
        .error_for_status()
        .ok()?;
    if response
        .content_length()
        .map(|n| n > 131072)
        .unwrap_or(false)
    {
        return None;
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.ok()? {
        if bytes.len() + chunk.len() > 131072 {
            return None;
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).ok()
}
fn confirmed(address: String, data: Value) -> Option<Found> {
    let info = &data["info"];
    if !data["state"]["on"].is_boolean() {
        return None;
    }
    let version = info["ver"].as_str()?;
    let leds = info["leds"]["count"].as_u64()?;
    Some(Found {
        name: info["name"]
            .as_str()
            .filter(|v| !v.trim().is_empty())
            .unwrap_or("WLED")
            .chars()
            .take(96)
            .collect(),
        address,
        identity: info["mac"].as_str().map(str::to_string),
        version: version.chars().take(48).collect(),
        leds,
    })
}
async fn search(client: reqwest::Client, registered: Vec<Device>) -> Vec<Found> {
    let deadline = Instant::now() + Duration::from_secs(12);
    let node_deadline = Instant::now() + Duration::from_secs(4);
    let browse = tauri::async_runtime::spawn_blocking(mdns);
    let seeds: Vec<String> = registered.iter().map(|d| d.address.clone()).collect();
    let nearby: Vec<Vec<String>> = stream::iter(seeds)
        .map(|url| {
            let client = client.clone();
            async move {
                if Instant::now() >= node_deadline {
                    return Vec::new();
                }
                json(&client, &url, "/json/nodes")
                    .await
                    .map(|v| node_addresses(&v))
                    .unwrap_or_default()
            }
        })
        .buffer_unordered(4)
        .collect()
        .await;
    let mut addresses: HashSet<String> = registered.iter().map(|d| d.address.clone()).collect();
    addresses.extend(nearby.into_iter().flatten());
    addresses.extend(browse.await.unwrap_or_default());
    let mut candidates: Vec<String> = addresses.into_iter().collect();
    candidates.sort();
    candidates.truncate(256);
    let results: Vec<Found> = stream::iter(candidates)
        .map(|url| {
            let client = client.clone();
            async move {
                if Instant::now() >= deadline {
                    return None;
                }
                confirmed(url.clone(), json(&client, &url, "/json/si").await?)
            }
        })
        .buffer_unordered(4)
        .filter_map(|v| async { v })
        .collect()
        .await;
    let mut unique = HashMap::new();
    for mut found in results {
        if let Some(saved) = registered.iter().find(|d| {
            d.address == found.address
                || d.identity
                    .as_ref()
                    .zip(found.identity.as_ref())
                    .map(|(a, b)| identity(a) == identity(b))
                    .unwrap_or(false)
        }) {
            found.name = saved.name.clone();
        }
        let key = found
            .identity
            .as_ref()
            .map(|v| identity(v))
            .filter(|v| !v.is_empty())
            .unwrap_or(found.address.clone());
        unique.entry(key).or_insert(found);
    }
    let mut values: Vec<Found> = unique.into_values().collect();
    values.sort_by(|a, b| a.name.cmp(&b.name).then(a.address.cmp(&b.address)));
    values
}
#[tauri::command]
pub async fn discover_devices(
    ctx: tauri::State<'_, Context>,
    discovery: tauri::State<'_, Discovery>,
) -> Result<Vec<Found>, String> {
    let _guard = discovery
        .0
        .try_lock()
        .map_err(|_| "Поиск уже выполняется")?;
    let registered = ctx.devices.lock().map_err(|_| "Список ламп занят")?.clone();
    tokio::time::timeout(
        Duration::from_secs(14),
        search(ctx.client.clone(), registered),
    )
    .await
    .map_err(|_| {
        "Поиск занял слишком много времени. Повторите поиск или добавьте адрес вручную.".into()
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn filters_advertised_addresses() {
        assert_eq!(
            candidate("192.168.1.4".parse().unwrap(), 80).unwrap(),
            "http://192.168.1.4"
        );
        assert!(candidate("8.8.8.8".parse().unwrap(), 80).is_none());
        assert!(candidate("192.168.1.4".parse().unwrap(), 0).is_none());
        assert!(node_addresses(&serde_json::json!({"nodes":[{"ip":"8.8.8.8"},{"ip":"192.168.1.7"},{"ip":"not-an-ip"}]})).len()==1);
    }
    #[test]
    fn verifies_wled_and_identity() {
        assert!(confirmed(
            "http://192.168.1.4".into(),
            serde_json::json!({"info":{"name":"Fake","ver":"1","leds":{"count":10}}})
        )
        .is_none());
        let value = serde_json::json!({"info":{"name":"Lamp","ver":"16.0.1","mac":"AA:BB","leds":{"count":144}},"state":{"on":false}});
        assert_eq!(
            confirmed("http://192.168.1.4".into(), value).unwrap().leds,
            144
        );
        assert_eq!(identity("AA:bb-CC"), "aabbcc");
    }
    #[test]
    #[ignore = "Run manually on a local network; read-only discovery"]
    fn local_network_probe() {
        let registered: Vec<Device> = std::env::var("WLED_DISCOVERY_PROBE_PROFILE")
            .ok()
            .and_then(|p| std::fs::read(p).ok())
            .and_then(|data| serde_json::from_slice::<Value>(&data).ok())
            .and_then(|data| serde_json::from_value(data["devices"].clone()).ok())
            .unwrap_or_default();
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(2))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap();
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let results = runtime.block_on(search(client, registered));
        println!("Confirmed local WLED devices: {}", results.len());
    }
}
