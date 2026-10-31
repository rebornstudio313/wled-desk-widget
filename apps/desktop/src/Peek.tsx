import {useEffect,useRef,useState} from 'react';
import type {Entry} from './model';
import {Icon} from './Icon';
import {DeviceStatus} from './DeviceStatus';
import type {PeekFrame} from '../../../packages/domain/src/peek.mjs';
import {watchPeek,type PeekStatus} from './peek-transport';
type View={frame?:PeekFrame;status:PeekStatus};
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
export function Peek({entries,selection,notice,busy,suspended=false}:{suspended?:boolean;entries:Entry[];selection:string;notice:string;busy:boolean}){
 const [enabled,setEnabled]=useState(false),[sources,setSources]=useState({left:'',right:''}),[views,setViews]=useState<Record<string,View>>({});
 const [visible,setVisible]=useState(!document.hidden);
 useEffect(()=>{const update=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',update);return ()=>document.removeEventListener('visibilitychange',update);},[]);
 const candidates=entries.filter(e=>selection==='all'||e.device.id===selection);
 const fallback=candidates.length?candidates:entries;
 const left=entries.find(e=>e.device.id===sources.left)||fallback[0];
 const right=entries.find(e=>e.device.id===sources.right)||fallback[1]||left;
 const ids=[...new Set([left?.device.id,right?.device.id].filter((id):id is string=>!!id))].sort().join(',');
 useEffect(()=>{setSources({left:'',right:''});},[selection]);
 useEffect(()=>{
  setViews({});if(!enabled||!visible||suspended||!ids)return;
  const targets=ids.split(',');let active=true;
  const stops=targets.map(id=>watchPeek(id,event=>{if(active)setViews(previous=>({...previous,[id]:event.type==='frame'?{status:'live',frame:event.frame}:{status:event.status,frame:event.status==='live'?previous[id]?.frame:undefined}}));}));
  return ()=>{active=false;stops.forEach(stop=>stop());};
 },[enabled,visible,suspended,ids]);
 const waiting=enabled&&!!ids&&ids.split(',').some(id=>views[id]?.status!=='live');
 const offline=enabled&&ids.split(',').some(id=>views[id]?.status==='offline');
 const stalled=enabled&&ids.split(',').some(id=>views[id]?.status==='stalled');
 const statusMessage=busy?'Применяем…':notice&&notice!=='Настройки применены'?notice:'';
 if(suspended)return null;
 return <>
  {enabled&&<><Edge side="left" entry={left} view={left?views[left.device.id]:undefined}/><Edge side="right" entry={right} view={right?views[right.device.id]:undefined}/></>}

  <div className="peek-footer">
   <div className={'widget-status'+(enabled?' sr-only':'')} role="status">{statusMessage?<><span className={busy?'status-pending':''}>●</span>{statusMessage}</>:<DeviceStatus entries={candidates}/>}<span className="sr-only">{notice==='Настройки применены'?notice:''}</span></div>
   {enabled&&<div className="peek-sources"><label title="Левый край">‹<select aria-label="Лампа на левом краю Peek" value={left?.device.id||''} onChange={e=>setSources(s=>({...s,left:e.target.value}))}>{entries.map(e=><option key={e.device.id} value={e.device.id}>{e.device.name}</option>)}</select></label><label title="Правый край"><select aria-label="Лампа на правом краю Peek" value={right?.device.id||''} onChange={e=>setSources(s=>({...s,right:e.target.value}))}>{entries.map(e=><option key={e.device.id} value={e.device.id}>{e.device.name}</option>)}</select>›</label></div>}
   <button className="peek-toggle" aria-label="Предпросмотр ленты Peek" aria-pressed={enabled} disabled={!entries.length&&!enabled} title="Показать цвета светодиодов по краям виджета" onClick={()=>setEnabled(!enabled)}><Icon kind="peek"/>Peek</button>
  </div>
  {enabled&&notice&&notice!=='Настройки применены'&&<p className="peek-note" role="status">{notice}</p>}
  {waiting&&<p className="peek-note" role="status">{stalled?'Peek: нет кадров. Возможно, поток открыт в другом окне.':offline?'Peek: лампа недоступна. Повторяем подключение…':'Peek: подключение к потоку…'}</p>}
 </>;
}
