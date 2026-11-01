use crate::{address, find, Context};
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::time::Duration;
use tauri::{ipc::Channel, State};
use tokio_tungstenite::{
    connect_async_with_config,
    tungstenite::{protocol::WebSocketConfig, Message},
};

#[tauri::command]
pub fn watch_state(
    id: String,
    subscription: String,
    on_event: Channel<Value>,
    ctx: State<'_, Context>,
) -> Result<(), String> {
    uuid::Uuid::parse_str(&subscription).map_err(|_| "Неверная подписка")?;
    let device = find(&ctx, &id)?;
    let base = address(&device.address)?;
    let mut url = reqwest::Url::parse(&base).map_err(|e| e.to_string())?;
    let scheme = if url.scheme() == "https" { "wss" } else { "ws" };
    url.set_scheme(scheme).map_err(|_| "Неверный протокол")?;
    url.set_path("/ws");
    let mut streams = ctx.states.lock().map_err(|_| "Подписки заняты")?;
    if streams.contains_key(&subscription) || streams.len() >= 32 {
        return Err("Слишком много подписок".into());
    }
    let task = tauri::async_runtime::spawn(async move {
        let mut attempt = 0u32;
        loop {
            let mut config = WebSocketConfig::default();
            config.max_message_size = Some(262144);
            config.max_frame_size = Some(262144);
            if let Ok(Ok((mut socket, _))) = tokio::time::timeout(
                Duration::from_secs(5),
                connect_async_with_config(url.as_str(), Some(config), false),
            )
            .await
            {
                attempt = 0;
                while let Some(Ok(message)) = socket.next().await {
                    if let Message::Text(text) = message {
                        if let Ok(value) = serde_json::from_str::<Value>(&text) {
                            if value["state"]["on"].is_boolean() && value["state"]["seg"].is_array()
                            {
                                if on_event
                                    .send(json!({"kind":"state","value":value}))
                                    .is_err()
                                {
                                    return;
                                }
                            }
                        }
                    }
                }
            }
            if on_event
                .send(json!({"kind":"status","status":"offline"}))
                .is_err()
            {
                return;
            }
            tokio::time::sleep(Duration::from_millis(
                (1000u64 << attempt.min(4)).min(10000),
            ))
            .await;
            attempt += 1;
        }
    });
    streams.insert(subscription, (id, task));
    Ok(())
}
#[tauri::command]
pub fn unwatch_state(subscription: String, ctx: State<'_, Context>) -> Result<(), String> {
    if let Some((_, task)) = ctx
        .states
        .lock()
        .map_err(|_| "Подписки заняты")?
        .remove(&subscription)
    {
        task.abort();
    }
    Ok(())
}
