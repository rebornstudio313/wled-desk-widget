import {Channel,invoke} from '@tauri-apps/api/core';
import {decodePeekFrame,type PeekFrame} from '../../../packages/domain/src/peek.mjs';
export type PeekStatus='connecting'|'live'|'offline'|'stalled';
export type PeekEvent={type:'frame';frame:PeekFrame}|{type:'status';status:PeekStatus};
type Wire={kind:'status';status:PeekStatus}|{kind:'binary';bytes:number[]}|{kind:'text';text:string};
export function watchPeek(id:string,receive:(event:PeekEvent)=>void):()=>void{
 let disposed=false;
 const native=Boolean((window as unknown as {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__);
 if(native){
  const subscription=crypto.randomUUID(),channel=new Channel<Wire>();
  channel.onmessage=event=>{
   if(disposed)return;
   if(event.kind==='status')receive({type:'status',status:event.status});
   else{const frame=decodePeekFrame(event.kind==='binary'?new Uint8Array(event.bytes):event.text);if(frame)receive({type:'frame',frame});}
  };
  void invoke('start_peek',{id,subscription,onEvent:channel}).then(()=>{if(disposed)void invoke('stop_peek',{subscription}).catch(()=>{});}).catch(()=>{if(!disposed)receive({type:'status',status:'offline'});});
  return ()=>{disposed=true;void invoke('stop_peek',{subscription}).catch(()=>{});};
 }
 const source=new EventSource('/api/devices/'+encodeURIComponent(id)+'/peek');
 source.addEventListener('frame',event=>{try{const frame=JSON.parse((event as MessageEvent).data) as PeekFrame;if(!disposed&&Array.isArray(frame.colors)&&frame.colors.length&&frame.colors.length<=16384&&frame.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c)))receive({type:'frame',frame});}catch{}});
 source.addEventListener('status',event=>{try{const {status}=JSON.parse((event as MessageEvent).data);if(!disposed&&['connecting','live','offline','stalled'].includes(status))receive({type:'status',status});}catch{}});
 source.onerror=()=>{if(!disposed)receive({type:'status',status:'offline'});};
 return ()=>{disposed=true;source.close();};
}
