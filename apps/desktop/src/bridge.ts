import { invoke } from '@tauri-apps/api/core';
import type {UpdateResult} from './About';
import type {FoundLamp} from './Discovery';
import type { Device, Snapshot, Patch, Scene } from './model';
const native=Boolean((window as unknown as {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__);
async function call<T>(command:string,args:Record<string,unknown>,path:string,method='GET',body?:unknown):Promise<T>{
 if(native)return invoke<T>(command,args);
 const response=await fetch('/api'+path,{method,headers:method!=='GET'?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const value=await response.json(); if(!response.ok)throw Error(value.error||'Ошибка соединения'); return value;
}
export const bridge={
 palettePreviews:(id:string)=>call<Record<string,unknown[]>>('palette_previews',{id},'/devices/'+id+'/palettes'),
 checkUpdates:()=>call<UpdateResult>('check_updates',{},'/updates','POST',{}),
 discover:()=>call<FoundLamp[]>('discover_devices',{},'/discovery','POST',{}),
 syncTargets:()=>call<Record<string,string[]>>('list_sync_targets',{},'/sync-targets'),
 saveSyncTargets:(source:string,targets:string[])=>call<{source:string;targets:string[]}>('save_sync_targets',{source,targets},'/sync-targets','POST',{source,targets}),
 scenes:()=>call<Scene[]>('list_scenes',{},'/scenes'),
 saveScene:(scene:Scene)=>call<Scene>('save_scene',{scene},'/scenes','POST',scene),
 list:()=>call<Device[]>('list_devices',{},'/devices'),
 add:(address:string)=>call<Device>('add_device',{address},'/devices','POST',{address}),
 rename:(id:string,name:string)=>call<Device>('rename_device',{id,name},'/devices/'+id+'/name','POST',{name}),
 remove:(id:string)=>call<void>('remove_device',{id},'/devices/'+id,'DELETE'),
 refresh:(id:string)=>call<Snapshot>('refresh_device',{id},'/devices/'+id),
 patch:(id:string,patch:Patch)=>call<Snapshot>('patch_state',{id,patch},'/devices/'+id+'/state','POST',patch),
};
