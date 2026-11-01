import {useEffect,useRef,useState} from 'react';
import type {Entry} from './model';
import {watchPeek,type PeekStatus} from './peek-transport';

type Renderer={update:(frame:{colors:string[];on?:boolean})=>boolean;clear:()=>void;destroy:()=>void};
type Factory=(canvas:HTMLCanvasElement,options?:{maxFps:number})=>Renderer;
const labels:Record<PeekStatus,string>={connecting:'Подключаем Peek…',live:'Живой свет',offline:'Нет связи с лентой',stalled:'Ожидаем кадры Peek…'};

export function LampWidget({entry,onControls}:{entry?:Entry;onControls:()=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),renderer=useRef<Renderer|null>(null);
 const [loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false),[status,setStatus]=useState<PeekStatus>('connecting');
 const [visible,setVisible]=useState(!document.hidden);
 const powered=!!entry?.snapshot&&entry.snapshot.state.on!==false&&!entry.error;
 useEffect(()=>{const update=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
 useEffect(()=>{
  let active=true;
  const url=new URL('/lamp-widget/lamp-widget-host.mjs',location.origin).href;
  void import(/* @vite-ignore */ url).then((module:{createLampWidget:Factory})=>{
   if(!active||!canvas.current)return;
   renderer.current=module.createLampWidget(canvas.current,{maxFps:20});setLoaded(true);
  }).catch(()=>{if(active)setFailed(true);});
  return()=>{active=false;renderer.current?.destroy();renderer.current=null;};
 },[]);
 useEffect(()=>{
  renderer.current?.clear();setStatus('connecting');
  if(!loaded||!visible||!powered||!entry)return;
  let active=true,stop=()=>{},timer:ReturnType<typeof setTimeout>|undefined,retries=0;
  const connect=()=>{if(!active)return;stop=watchPeek(entry.device.id,event=>{
   if(!active)return;
   if(event.type==='frame'){
    clearTimeout(timer);timer=undefined;setStatus('live');renderer.current?.update({colors:event.frame.colors,on:true});
   }else{
    setStatus(event.status);if(event.status!=='live')renderer.current?.clear();
    if(event.status==='stalled'&&!timer&&retries<2)timer=setTimeout(()=>{
     timer=undefined;stop();retries++;timer=setTimeout(()=>{timer=undefined;connect();},400);
    },retries===0?1200:3000);
   }
  });};connect();
  return()=>{active=false;clearTimeout(timer);stop();renderer.current?.clear();};
 },[loaded,visible,powered,entry?.device.id]);
 const message=failed?'Не удалось загрузить лампу':!entry?'Выберите ленту через ПКМ':entry.error?'Нет связи с лентой':!entry.snapshot?'Подключаем лампу…':!powered?'Свет выключен':labels[status];
 return <div className="lamp-mode-content" data-status={powered?status:'off'}>
  <canvas ref={canvas} className="lamp-widget-canvas" role="img" aria-label={`RGB-лампа: ${entry?.device.name||'лента не выбрана'}`} tabIndex={0}/>
  <div className="lamp-mode-caption"><span>{entry?.device.name||'WLED DESK'}</span><small role="status">{message}</small></div>
  <button className="lamp-controls-return" onClick={onControls}>Управление лампами</button>
 </div>;
}
