import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';

export function EffectPicker({label,value,options,disabled=false,onChange}:{label:string;value:string;options:string[];disabled?:boolean;onChange:(value:string)=>void}){
 const id=useId(),trigger=useRef<HTMLButtonElement>(null),list=useRef<HTMLDivElement>(null);
 const [open,setOpen]=useState(false),[active,setActive]=useState(0),[position,setPosition]=useState({left:8,top:8,width:240,height:200});
 const key=options.join('\0'),typed=useRef({text:'',at:0});
 function close(restore=true){setOpen(false);if(restore)trigger.current?.focus();}
 function choose(index:number){if(options[index])onChange(options[index]);close();}
 useEffect(()=>{
  if(!open)return;setActive(Math.max(0,options.indexOf(value)));
  const place=()=>{const box=trigger.current?.getBoundingClientRect();if(!box)return;const width=Math.min(Math.max(240,box.width),innerWidth-16),below=innerHeight-box.bottom-12,above=box.top-12;const height=Math.max(40,Math.min(240,Math.max(below,above)));setPosition({left:Math.max(8,Math.min(box.left,innerWidth-width-8)),top:below>=above?box.bottom+4:Math.max(8,box.top-height-4),width,height});};
  place();const focus=requestAnimationFrame(()=>list.current?.focus());
  const outside=(e:PointerEvent)=>{if(!trigger.current?.contains(e.target as Node)&&!list.current?.contains(e.target as Node))close(false);};
  document.addEventListener('pointerdown',outside);window.addEventListener('resize',place);
  return()=>{cancelAnimationFrame(focus);document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',place);};
 },[open,value,key]);
 useEffect(()=>{if(open)list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({block:'nearest'});},[open,active,position]);
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 return <><button ref={trigger} type="button" className="effect-picker" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined} disabled={disabled} onClick={()=>setOpen(!open)} onKeyDown={e=>{if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();setOpen(true);}}}><span>{value||'Нет эффектов'}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></button>
 {open&&createPortal(<div ref={list} id={id} className="effect-options" role="listbox" aria-label={`${label}: список`} aria-activedescendant={`${id}-${active}`} tabIndex={-1} style={{left:position.left,top:position.top,width:position.width,maxHeight:position.height}} onKeyDown={e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}
  if(e.key==='Tab'){close(false);return;}
  if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();choose(active);return;}
  const change=e.key==='ArrowDown'?Math.min(options.length-1,active+1):e.key==='ArrowUp'?Math.max(0,active-1):e.key==='Home'?0:e.key==='End'?options.length-1:null;
  if(change!==null){e.preventDefault();e.stopPropagation();setActive(change);return;}
  if(e.key.length===1&&!e.ctrlKey&&!e.altKey&&!e.metaKey){const now=Date.now();typed.current={text:(now-typed.current.at<700?typed.current.text:'')+e.key.toLowerCase(),at:now};const found=options.findIndex(name=>name.toLowerCase().startsWith(typed.current.text));if(found>=0)setActive(found);}
 }}>{options.map((name,index)=><button key={name} type="button" id={`${id}-${index}`} data-index={index} role="option" aria-selected={name===value} className={index===active?'focused':''} tabIndex={-1} onPointerMove={()=>setActive(index)} onClick={()=>choose(index)}>{name}{name===value&&<span aria-hidden="true">✓</span>}</button>)}</div>,document.body)}</>;
}
