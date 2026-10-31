import {useEffect,useRef,useState} from 'react';
import type {Entry} from './model';
import {Icon} from './Icon';
import type {PeekFrame} from '../../../packages/domain/src/peek.mjs';
import {watchPeek,type PeekStatus} from './peek-transport';
type View={frame?:PeekFrame;status:PeekStatus};
const rgb=(c:number[])=>'#'+c.slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');
function demoFrame(entry:Entry):PeekFrame{
 const state=entry.snapshot!.state,segment=state.seg[0],effect=entry.snapshot!.effects[segment.fx];
 const time=Date.now()/1000;
 return {colors:Array.from({length:96},(_,i)=>{
  if(!state.on)return '#000000';
  if(effect==='Rainbow'){
   const h=(i/96*360+time*45)%360,x=1-Math.abs(h/60%2-1);
   const c=h<60?[1,x,0]:h<120?[x,1,0]:h<180?[0,1,x]:h<240?[0,x,1]:h<300?[x,0,1]:[1,0,x];
   return rgb(c.map(v=>Math.round(v*255)));
  }
  const scale=effect==='Breathe'?.3+.7*(Math.sin(time*2)+1)/2:1;
  return rgb(segment.col[0].map(v=>Math.round(v*scale)));
 })};
}
function Edge({side,entry,view}:{side:'left'|'right';entry?:Entry;view?:View}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const element=canvas.current,colors=view?.status==='live'?view.frame?.colors:undefined;if(!element)return;
  const context=element.getContext('2d');if(!context)return;
  const count=Math.min(colors?.length||1,160);element.width=1;element.height=count;
  for(let i=0;i<count;i++){context.fillStyle=colors?.[count===1?0:Math.round(i*(colors.length-1)/(count-1))]||'#071323';context.fillRect(0,i,1,1);}
 },[view]);
 return <canvas ref={canvas} className={'peek-edge peek-'+side} data-status={view?.status||'connecting'} role="img" aria-label={`${side==='left'?'Левый':'Правый'} край Peek: ${entry?.device.name||'нет лампы'}`} title={entry?`${entry.device.name} · от начала ленты сверху к концу снизу`:undefined}/>;
}
export function Peek({entries,selection,demo,notice,busy,suspended=false}:{suspended?:boolean;entries:Entry[];selection:string;demo:boolean;notice:string;busy:boolean}){
 const [enabled,setEnabled]=useState(false),[sources,setSources]=useState({left:'',right:''}),[views,setViews]=useState<Record<string,View>>({});
 const latest=useRef(entries);latest.current=entries;
 const [visible,setVisible]=useState(!document.hidden);
 useEffect(()=>{const update=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',update);return ()=>document.removeEventListener('visibilitychange',update);},[]);
 const candidates=entries.filter(e=>selection==='all'||e.device.id===selection);
 const fallback=candidates.length?candidates:entries;
 const left=entries.find(e=>e.device.id===sources.left)||fallback[0];
 const right=entries.find(e=>e.device.id===sources.right)||fallback[1]||left;
 const ids=[...new Set([left?.device.id,right?.device.id].filter((id):id is string=>!!id))].sort().join(',');
 useEffect(()=>{setSources({left:'',right:''});},[selection,demo]);
 useEffect(()=>{
  setViews({});if(!enabled||!visible||suspended||!ids)return;
  const targets=ids.split(',');let active=true;
  if(demo){
   const update=()=>{const next:Record<string,View>={};for(const id of targets){const entry=latest.current.find(e=>e.device.id===id);if(entry?.snapshot)next[id]={status:'live',frame:demoFrame(entry)};}setViews(next);};
   update();const interval=setInterval(update,80);return ()=>clearInterval(interval);
  }
  const stops=targets.map(id=>watchPeek(id,event=>{if(active)setViews(previous=>({...previous,[id]:event.type==='frame'?{status:'live',frame:event.frame}:{status:event.status,frame:event.status==='live'?previous[id]?.frame:undefined}}));}));
  return ()=>{active=false;stops.forEach(stop=>stop());};
 },[enabled,visible,suspended,ids,demo]);
 const waiting=enabled&&!demo&&!!ids&&ids.split(',').some(id=>views[id]?.status!=='live');
 const offline=enabled&&!demo&&ids.split(',').some(id=>views[id]?.status==='offline');
 const stalled=enabled&&!demo&&ids.split(',').some(id=>views[id]?.status==='stalled');
 const ready=entries.filter(e=>(selection==='all'||e.device.id===selection)&&e.snapshot&&!e.error).length;
 if(suspended)return null;
 return <>
  {enabled&&<><Edge side="left" entry={left} view={left?views[left.device.id]:undefined}/><Edge side="right" entry={right} view={right?views[right.device.id]:undefined}/></>}

  <div className="peek-footer">
   <div className={'widget-status'+(enabled?' sr-only':'')} role="status"><span className={busy?'status-pending':''}>●</span>{busy?'Применяем…':notice||`${demo?'Демо · ':''}${ready} устройств доступны`}</div>
   {enabled&&<div className="peek-sources">{demo&&<span className="peek-demo">Демо</span>}<label title="Левый край">‹<select aria-label="Лампа на левом краю Peek" value={left?.device.id||''} onChange={e=>setSources(s=>({...s,left:e.target.value}))}>{entries.map(e=><option key={e.device.id} value={e.device.id}>{e.device.name}</option>)}</select></label><label title="Правый край"><select aria-label="Лампа на правом краю Peek" value={right?.device.id||''} onChange={e=>setSources(s=>({...s,right:e.target.value}))}>{entries.map(e=><option key={e.device.id} value={e.device.id}>{e.device.name}</option>)}</select>›</label></div>}
   <button className="peek-toggle" aria-label="Предпросмотр ленты Peek" aria-pressed={enabled} disabled={!entries.length&&!enabled} title="Показать цвета светодиодов по краям виджета" onClick={()=>setEnabled(!enabled)}><Icon kind="peek"/>Peek</button>
  </div>
  {enabled&&notice&&notice!=='Настройки применены'&&<p className="peek-note" role="status">{notice}</p>}
  {waiting&&<p className="peek-note" role="status">{stalled?'Peek: нет кадров. Возможно, поток открыт в другом окне.':offline?'Peek: лампа недоступна. Повторяем подключение…':'Peek: подключение к потоку…'}</p>}
 </>;
}
