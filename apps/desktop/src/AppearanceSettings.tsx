import {useEffect,useRef,useState} from 'react';
const storageKey='wled-desk.transparency.v1';
export function useTransparency(){
 const [transparency,setTransparency]=useState(()=>{try{const raw=localStorage.getItem(storageKey);if(raw===null)return 3;const value=Number(raw);return Number.isFinite(value)?Math.round(Math.max(0,Math.min(100,value))):3;}catch{return 3;}});
 useEffect(()=>{
  const alpha=1-transparency/100;
  document.documentElement.style.setProperty('--glass-top',`rgba(7,23,39,${alpha})`);
  document.documentElement.style.setProperty('--glass-bottom',`rgba(5,12,24,${alpha*.99})`);
  try{localStorage.setItem(storageKey,String(transparency));}catch{}
 },[transparency]);return {transparency,setTransparency};
}
type Value=ReturnType<typeof useTransparency>;
export function AppearanceSettings({value,onEdit}:{value:Value;onEdit:()=>void}){return <button type="button" className="appearance-settings appearance-launcher" aria-label="Настроить прозрачность виджета" onClick={onEdit}><span className="appearance-heading"><b>Прозрачность виджета</b><span>{value.transparency}%</span></span><span className="appearance-track" aria-hidden="true"><i style={{left:`calc(${value.transparency}% - ${value.transparency*.15}px)`}}/></span><small>Фон основного и мини-виджета</small></button>}
export function TransparencyPreview({value,onDone,onBack}:{value:Value;onDone:()=>void;onBack:()=>void}){
 const slider=useRef<HTMLInputElement>(null);
 useEffect(()=>{slider.current?.focus();const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();onDone();}};window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);},[]);
 return <section className="transparency-preview" role="region" aria-label="Предпросмотр прозрачности"><div className="appearance-heading"><label htmlFor="preview-transparency">Прозрачность виджета</label><output htmlFor="preview-transparency">{value.transparency}%</output></div><input ref={slider} id="preview-transparency" aria-label="Прозрачность виджета" type="range" min="0" max="100" step="1" value={value.transparency} onChange={e=>value.setTransparency(Number(e.target.value))}/><div className="transparency-preview-actions"><button type="button" onClick={onBack}>К настройкам</button><button type="button" onClick={onDone}>Готово</button></div><small className="glass-preview-note">Прозрачность стекла · текст остаётся чётким</small></section>;
}
