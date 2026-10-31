// Native Peek transport. Source only until the first Windows/Rust build is verified.
use crate::{address, find, Context};
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::{collections::HashMap, sync::Mutex, time::{Duration, Instant}};
use tauri::{ipc::Channel, State};
use tokio_tungstenite::{connect_async_with_config, tungstenite::{protocol::WebSocketConfig, Message}};

pub type Streams = Mutex<HashMap<String, (String, tauri::async_runtime::JoinHandle<()>)>>;
fn valid_binary(bytes:&[u8])->bool{
 if bytes.len()<5||bytes[0]!=76{return false}
 let offset=match bytes[1]{1=>2,2=>4,_=>return false};
 if bytes.len()<=offset||(bytes.len()-offset)%3!=0{return false}
 let available=(bytes.len()-offset)/3;
 let count=if offset==4{usize::from(bytes[2])*usize::from(bytes[3])}else{available};
 count>0&&count<=16384&&count<=available
}
fn valid_text(text:&str)->bool{
 let Ok(value)=serde_json::from_str::<Value>(text)else{return false};
 let Some(colors)=value["leds"].as_array()else{return false};
 !colors.is_empty()&&colors.len()<=16384&&colors.iter().all(|c|c.as_str().map(|s|[6,8].contains(&s.len())&&s.bytes().all(|b|b.is_ascii_hexdigit())).unwrap_or(false))
}
async fn run(url:String,channel:Channel<Value>){
 let mut attempt=0u32;
 loop{
  if channel.send(json!({"kind":"status","status":"connecting"})).is_err(){return}
  let mut config=WebSocketConfig::default();config.max_message_size=Some(65536);config.max_frame_size=Some(65536);
  let connection=tokio::time::timeout(Duration::from_secs(5),connect_async_with_config(url.as_str(),Some(config),false)).await;
  if let Ok(Ok((mut socket,_)))=connection{
   // Only request observation. No state/color commands, and no lv:false on cleanup.
   if socket.send(Message::Text("{\"lv\":true}".into())).await.is_ok(){
    let mut last_frame=Instant::now();let mut last_sent=Instant::now()-Duration::from_secs(1);let mut stalled=false;
    loop{
     match tokio::time::timeout(Duration::from_secs(1),socket.next()).await{
      Ok(Some(Ok(message)))=>{
       let event=match message{
        Message::Binary(bytes) if valid_binary(&bytes)=>Some(json!({"kind":"binary","bytes":bytes.to_vec()})),
        Message::Text(text) if valid_text(text.as_str())=>Some(json!({"kind":"text","text":text.as_str()})),
        Message::Close(_)=>break,
        _=>None,
       };
       if let Some(event)=event{
        last_frame=Instant::now();stalled=false;attempt=0;
        if last_sent.elapsed()>=Duration::from_millis(80){last_sent=Instant::now();if channel.send(event).is_err(){return}}
       }
      },
      Ok(_)=>break,
      Err(_)=>{},
     }
     // A second Peek client can take over without closing this socket. Do not steal it back.
     if !stalled&&last_frame.elapsed()>Duration::from_secs(5){
      stalled=true;if channel.send(json!({"kind":"status","status":"stalled"})).is_err(){return}
     }
    }
   }
  }
  if channel.send(json!({"kind":"status","status":"offline"})).is_err(){return}
  tokio::time::sleep(Duration::from_millis((1000u64<<attempt.min(4)).min(10000))).await;attempt=attempt.saturating_add(1);
 }
}
#[tauri::command]
pub fn start_peek(id:String,subscription:String,on_event:Channel<Value>,ctx:State<'_,Context>)->Result<(),String>{
 uuid::Uuid::parse_str(&subscription).map_err(|_|"Неверная подписка Peek")?;
 let device=find(&ctx,&id)?;
 let base=address(&device.address)?;let mut url=reqwest::Url::parse(&base).map_err(|_|"Неверный адрес")?;
 let scheme=if url.scheme()=="https"{"wss"}else{"ws"};url.set_scheme(scheme).map_err(|_|"Неверный протокол")?;url.set_path("/ws");
 let mut streams=ctx.peeks.lock().map_err(|_|"Peek занят")?;
 if streams.contains_key(&subscription)||streams.len()>=16{return Err("Слишком много подписок Peek".into())}
 let task=tauri::async_runtime::spawn(run(url.to_string(),on_event));streams.insert(subscription,(id,task));Ok(())
}
#[tauri::command]
pub fn stop_peek(subscription:String,ctx:State<'_,Context>)->Result<(),String>{
 if let Some((_,task))=ctx.peeks.lock().map_err(|_|"Peek занят")?.remove(&subscription){task.abort();}Ok(())
}
pub fn stop_device(ctx:&Context,id:&str){
 if let Ok(mut streams)=ctx.peeks.lock(){streams.retain(|_,(device,task)|{if device==id{task.abort();false}else{true}});}
}
