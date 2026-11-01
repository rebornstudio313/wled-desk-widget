import {invoke} from '@tauri-apps/api/core';
import {getCurrentWindow} from '@tauri-apps/api/window';
export const nativeShell=Boolean((window as unknown as {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__);
export function observeWindowSize(element:HTMLElement){
 if(!nativeShell)return ()=>{};
 let last=0;
 const observer=new ResizeObserver(()=>{const height=Math.max(180,Math.min(920,Math.ceil(element.getBoundingClientRect().height)));if(height!==last){last=height;void invoke('resize_widget',{height}).catch(()=>{});}});
 observer.observe(element);return ()=>observer.disconnect();
}
export function savedCompact(){try{return localStorage.getItem('widget-led-rgb.compact.v1')==='true';}catch{return false;}}
export function storeCompact(value:boolean){try{localStorage.setItem('widget-led-rgb.compact.v1',String(value));}catch{}}

export async function dragWidget(){
 if(!nativeShell||document.documentElement.dataset.windowDragging==='true')return;
 const window=getCurrentWindow();document.documentElement.dataset.windowDragging='true';
 try{await window.startDragging();}
 finally{delete document.documentElement.dataset.windowDragging;}
}
export function savedPinned(){try{return localStorage.getItem('wled-desk.pinned.v1')==='true';}catch{return false;}}
export async function pinWidget(value:boolean){if(nativeShell)await invoke('pin_widget',{pinned:value});}
export function storePinned(value:boolean){try{localStorage.setItem('wled-desk.pinned.v1',String(value));}catch{}}

export async function closeWidget(){if(nativeShell)await getCurrentWindow().close();}
