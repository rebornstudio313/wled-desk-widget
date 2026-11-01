import {Channel,invoke} from '@tauri-apps/api/core';
import type {Snapshot} from './model';
export type StateUpdate={state:Snapshot['state'];info?:Snapshot['info']};
export function watchState(id:string,receive:(value:StateUpdate)=>void,lost:()=>void){
 let disposed=false;
 const accept=(value:StateUpdate)=>{if(!disposed&&value&&typeof value.state?.on==='boolean'&&Array.isArray(value.state.seg)&&value.state.seg.length)receive(value);};
 if((window as unknown as {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__){
  const subscription=crypto.randomUUID(),channel=new Channel<{kind:string;value?:StateUpdate}>();
  channel.onmessage=event=>{if(disposed)return;if(event.kind==='state'&&event.value)accept(event.value);else if(event.kind==='status')lost();};
  void invoke('watch_state',{id,subscription,onEvent:channel}).then(()=>{if(disposed)void invoke('unwatch_state',{subscription});}).catch(()=>{if(!disposed)lost();});
  return()=>{disposed=true;void invoke('unwatch_state',{subscription}).catch(()=>{});};
 }
 const stream=new EventSource('/api/devices/'+encodeURIComponent(id)+'/events');
 stream.addEventListener('state',event=>{try{accept(JSON.parse((event as MessageEvent).data));}catch{}});
 stream.addEventListener('status',()=>{if(!disposed)lost();});stream.onerror=()=>{if(!disposed)lost();};
 return()=>{disposed=true;stream.close();};
}
