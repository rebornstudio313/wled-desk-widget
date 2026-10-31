import { invoke } from '@tauri-apps/api/core';
import type { Device, Snapshot, Patch, Scene } from './model';
const native=Boolean((window as unknown as {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__);
async function call<T>(command:string,args:Record<string,unknown>,path:string,method='GET',body?:unknown):Promise<T>{
 if(native)return invoke<T>(command,args);
 const response=await fetch('/api'+path,{method,headers:method!=='GET'?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const value=await response.json(); if(!response.ok)throw Error(value.error||'Ошибка соединения'); return value;
}
export const bridge={
 scenes:()=>call<Scene[]>('list_scenes',{},'/scenes'),
 saveScene:(scene:Scene)=>call<Scene>('save_scene',{scene},'/scenes','POST',scene),
 list:()=>call<Device[]>('list_devices',{},'/devices'),
 add:(address:string)=>call<Device>('add_device',{address},'/devices','POST',{address}),
 remove:(id:string)=>call<void>('remove_device',{id},'/devices/'+id,'DELETE'),
 refresh:(id:string)=>call<Snapshot>('refresh_device',{id},'/devices/'+id),
 patch:(id:string,patch:Patch)=>call<Snapshot>('patch_state',{id,patch},'/devices/'+id+'/state','POST',patch),
};
