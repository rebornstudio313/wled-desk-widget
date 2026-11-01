import {normalizeAddress} from './wled.mjs';
export function createStateHub(){
 const connections=new Map();
 return {subscribe(device,send){
  let hub=connections.get(device.id);
  if(!hub){
   hub={listeners:new Set(),socket:null,timer:null,closed:false,attempt:0};connections.set(device.id,hub);
   const emit=(type,value)=>{for(const listener of hub.listeners)listener(type,value);};
   const connect=()=>{
    if(hub.closed)return;const url=new URL(normalizeAddress(device.address));url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/ws';
    const socket=new WebSocket(url);hub.socket=socket;
    const timeout=setTimeout(()=>socket.close(),5000);
    socket.onopen=()=>{clearTimeout(timeout);hub.attempt=0;};
    socket.onmessage=event=>{if(typeof event.data!=='string'||event.data.length>262144)return;try{const value=JSON.parse(event.data);if(value.state&&typeof value.state.on==='boolean'&&Array.isArray(value.state.seg))emit('state',value);}catch{}};
    socket.onerror=()=>socket.close();socket.onclose=()=>{clearTimeout(timeout);if(hub.closed)return;emit('status',{status:'offline'});hub.timer=setTimeout(connect,Math.min(1000*2**hub.attempt++,10000));};
   };hub.connect=connect;
  }
  hub.listeners.add(send);if(!hub.socket)hub.connect();
  return()=>{hub.listeners.delete(send);if(!hub.listeners.size){hub.closed=true;clearTimeout(hub.timer);hub.socket?.close();connections.delete(device.id);}};
 }};
}
