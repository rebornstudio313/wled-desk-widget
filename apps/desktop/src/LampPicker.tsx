import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Entry} from './model';
import {Icon} from './Icon';

function status(entry:Entry){return entry.error?{kind:'offline',text:'Нет связи'}:!entry.snapshot?{kind:'connecting',text:'Подключение'}:{kind:'online',text:entry.snapshot.state.on?'В сети · свет включён':'В сети · свет выключен'};}
function displayName(entry:Entry,entries:Entry[]){
 if(entries.filter(e=>e.device.name===entry.device.name).length<2)return entry.device.name;
 const host=entry.device.address.replace(/^https?:\/\//,'').split('/')[0];
 return `${entry.device.name} · ${/^\d+\.\d+\.\d+\.\d+$/.test(host)?host.split('.').at(-1):host}`;
}
export function LampPicker({entries,selection,disabled,onSelect,onPower}:{entries:Entry[];selection:string;disabled:boolean;onSelect:(id:string)=>void;onPower:(entry:Entry)=>Promise<void>}){
 const [open,setOpen]=useState(false),[position,setPosition]=useState({left:4,top:4,width:260,height:220});
 const trigger=useRef<HTMLButtonElement>(null),list=useRef<HTMLDivElement>(null),id=useId();
 const current=entries.find(e=>e.device.id===selection);
 const close=(focus=true)=>{setOpen(false);if(focus)trigger.current?.focus();};
 useLayoutEffect(()=>{if(!open)return;const box=trigger.current!.getBoundingClientRect(),width=Math.min(280,innerWidth-8),below=innerHeight-box.bottom-8,above=box.top-8,height=Math.min(240,Math.max(below,above));setPosition({left:Math.max(4,Math.min(box.left,innerWidth-width-4)),top:below>=above?box.bottom+4:Math.max(4,box.top-height-4),width,height});},[open]);
 useEffect(()=>{
  if(!open)return;list.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();if(!list.current?.contains(document.activeElement))list.current?.querySelector<HTMLElement>('button')?.focus();
  const outside=(e:PointerEvent)=>{if(!list.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))close(false);};const dismiss=()=>close(false);
  document.addEventListener('pointerdown',outside);window.addEventListener('resize',dismiss);return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',dismiss);};
 },[open]);
 return <><button ref={trigger} type="button" className={'lamp-picker'+(current?' selected':'')} role="combobox" aria-label="Выбрать лампу" aria-expanded={open} aria-haspopup="dialog" aria-controls={open?id:undefined} disabled={disabled||!entries.length} onClick={()=>setOpen(value=>!value)} onKeyDown={e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();setOpen(true);}}}><Icon kind="lamp"/>{current&&<i aria-hidden="true" className={'connection-dot '+status(current).kind}/>}<span>{current?displayName(current,entries):'Выбрать лампу'}</span><svg className="picker-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></button>
 {open&&createPortal(<div ref={list} id={id} role="dialog" aria-label="Список ламп" className="lamp-options" style={{left:position.left,top:position.top,width:position.width,maxHeight:position.height}} onKeyDown={e=>{
  if(e.key==='Escape'||e.key==='Tab'){e.preventDefault();e.stopPropagation();close();return;}
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const buttons=Array.from(list.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));const index=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}
 }}>{entries.map(entry=>{const state=status(entry);return <div className="lamp-option-row" key={entry.device.id} data-selected={selection===entry.device.id}><button className="lamp-option-select" disabled={disabled} type="button" aria-pressed={selection===entry.device.id} aria-label={`${displayName(entry,entries)}: ${state.text}`} title={entry.device.address} onClick={()=>{onSelect(entry.device.id);close();}}><Icon kind="lamp"/><i aria-hidden="true" className={'connection-dot '+state.kind}/><span><b>{displayName(entry,entries)}</b><small>{state.text}</small></span>{selection===entry.device.id&&<span className="lamp-check" aria-hidden="true">✓</span>}</button><button type="button" className="lamp-option-power" role="switch" aria-label={`Питание ${displayName(entry,entries)}`} aria-checked={!!entry.snapshot?.state.on} disabled={disabled||state.kind!=='online'} title={state.kind!=='online'?'Нет соединения с лампой':entry.snapshot?.state.on?'Выключить лампу':'Включить лампу'} onClick={()=>void onPower(entry)}><span className="switch-track"><span><Icon kind="power"/></span></span></button></div>;})}</div>,document.body)}</>;
}
