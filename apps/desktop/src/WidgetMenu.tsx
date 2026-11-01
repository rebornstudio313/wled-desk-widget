import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Icon} from './Icon';

export function WidgetMenu({point,compact,pinned,native,onCompact,onPinned,onClose,lampMode,onLampMode,lampSources,lampSource,onLampSource}:{point:{x:number;y:number};compact:boolean;pinned:boolean;native:boolean;onCompact:()=>void;onPinned:()=>void;onClose:()=>void;lampMode:boolean;onLampMode:()=>void;lampSources:{id:string;name:string}[];lampSource?:string;onLampSource:(id:string)=>void}){
 const menu=useRef<HTMLDivElement>(null),[position,setPosition]=useState(point);
 useLayoutEffect(()=>{const box=menu.current?.getBoundingClientRect();if(box)setPosition({x:Math.max(4,Math.min(point.x,innerWidth-box.width-4)),y:Math.max(4,Math.min(point.y,innerHeight-box.height-4))});},[point]);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  menu.current?.querySelector<HTMLElement>('[role="menuitemcheckbox"]:not(:disabled)')?.focus();
  const outside=(event:PointerEvent)=>{if(!menu.current?.contains(event.target as Node))onClose();};
  const close=()=>onClose();document.addEventListener('pointerdown',outside);window.addEventListener('blur',close);window.addEventListener('resize',close);
  return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('blur',close);window.removeEventListener('resize',close);previous?.focus();};
 },[]);
 return createPortal(<div ref={menu} className="widget-context-menu" role="menu" aria-label="Меню виджета" style={{left:position.x,top:position.y}} onContextMenu={e=>e.preventDefault()} onKeyDown={e=>{
  if(e.key==='Escape'||e.key==='Tab'){e.preventDefault();e.stopPropagation();onClose();return;}
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const items=Array.from(menu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));const index=items.indexOf(document.activeElement as HTMLButtonElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}
 }}>
  <button role="menuitemcheckbox" disabled={lampMode} aria-checked={compact} onClick={()=>{onCompact();onClose();}}><Icon kind={compact?'expand':'collapse'}/><span>{compact?'Развернуть виджет':'Мини-режим'}</span><span className="menu-check" aria-hidden="true">{compact?'✓':''}</span></button>
  <button role="menuitemcheckbox" aria-checked={pinned} disabled={!native} title={native?'Закрепить окно поверх остальных':'Доступно в настольной версии'} onClick={()=>{onPinned();onClose();}}><Icon kind="pin"/><span>Поверх других окон</span><span className="menu-check" aria-hidden="true">{pinned?'✓':''}</span></button>
  <button role="menuitemcheckbox" aria-checked={lampMode} onClick={()=>{onLampMode();onClose();}}><Icon kind="lamp"/><span>{lampMode?'Обычное управление':'Режим «Лампа»'}</span><span className="menu-check" aria-hidden="true">{lampMode?'✓':''}</span></button>
  <span className="lamp-menu-label">Лента для лампы</span>
  {lampSources.map(source=><button key={source.id} className="lamp-source-item" role="menuitemradio" aria-checked={lampSource===source.id} onClick={()=>{onLampSource(source.id);onClose();}}><Icon kind="peek"/><span>{source.name}</span><span className="menu-check" aria-hidden="true">{lampSource===source.id?'✓':''}</span></button>)}
 </div>,document.body);
}
