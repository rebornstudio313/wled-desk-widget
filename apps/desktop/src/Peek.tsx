import {useEffect,useRef,useState} from 'react';
import type {Entry} from './model';
import type {PeekFrame} from '../../../packages/domain/src/peek.mjs';
import {watchPeek,type PeekStatus} from './peek-transport';
type View={frame?:PeekFrame;status:PeekStatus};
function Edge({side,entry,view}:{side:'left'|'right';entry?:Entry;view?:View}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const element=canvas.current,colors=view?.status==='live'&&entry?.snapshot?.state.on!==false?view.frame?.colors:undefined;if(!element)return;
  const context=element.getContext('2d');if(!context)return;
  const count=Math.min(colors?.length||1,160);element.width=1;element.height=count;
  context.clearRect(0,0,element.width,element.height);
  for(let i=0;i<count;i++){
   const color=colors?.[count===1?0:Math.round(i*(colors.length-1)/(count-1))];if(!color)continue;
   const values=[1,3,5].map(offset=>parseInt(color.slice(offset,offset+2),16));
   const alpha=Math.max(...values)/255;if(!alpha)continue;
   context.fillStyle=`rgba(${values.join(',')},${alpha})`;context.fillRect(0,i,1,1);
  }
 },[view,entry?.snapshot?.state.on]);
 return <canvas ref={canvas} className={'peek-edge peek-'+side} data-status={view?.status||'connecting'} role="img" aria-label={`${side==='left'?'Левый':'Правый'} край Peek: ${entry?.device.name||'нет лампы'}`} title={entry?`${entry.device.name} · от начала ленты сверху к концу снизу`:undefined}/>;
}
export function Peek({entries,selection,notice,busy,enabled,suspended=false}:{enabled:boolean;suspended?:boolean;entries:Entry[];selection:string;notice:string;busy:boolean}){
 const [views,setViews]=useState<Record<string,View>>({});
 const [visible,setVisible]=useState(!document.hidden);
 useEffect(()=>{const update=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',update);return ()=>document.removeEventListener('visibilitychange',update);},[]);
 const candidates=entries.filter(e=>selection==='all'||e.device.id===selection);
 const fallback=candidates.length?candidates:entries;
 const left=fallback[0];
 const right=fallback[1]||left;
 const poweredIds=new Set(fallback.filter(e=>e.snapshot?.state.on!==false).map(e=>e.device.id));
 const ids=[...new Set([left?.device.id,right?.device.id].filter((id):id is string=>!!id&&poweredIds.has(id)))].sort().join(',');
 useEffect(()=>{
  setViews({});if(!enabled||!visible||suspended||!ids)return;
  const targets=ids.split(',');let active=true;
  const stops=targets.map(id=>{
   let stop=()=>{},timer:ReturnType<typeof setTimeout>|undefined,retries=0;
   const connect=()=>{if(!active)return;stop=watchPeek(id,event=>{
    if(!active)return;
    setViews(previous=>({...previous,[id]:event.type==='frame'?{status:'live',frame:event.frame}:{status:event.status,frame:event.status==='live'?previous[id]?.frame:undefined}}));
    if(event.type==='frame'){clearTimeout(timer);timer=undefined;}
    // A controller can keep the socket open but lose its live-view subscription.
    // Retry twice per viewing/power session, never continuously reclaim another client's Peek.
    if(event.type==='status'&&event.status==='stalled'&&!timer&&retries<2){
     timer=setTimeout(()=>{timer=undefined;stop();retries++;
      timer=setTimeout(()=>{timer=undefined;connect();},400);
     },retries===0?1200:3000);
    }
   });};
   connect();return ()=>{clearTimeout(timer);stop();};
  });
  return ()=>{active=false;stops.forEach(stop=>stop());};
 },[enabled,visible,suspended,ids]);
 const statusMessage=busy?'Применяем…':notice&&notice!=='Настройки применены'?notice:'';
 if(suspended)return null;
 return <>
  {enabled&&<><Edge side="left" entry={left} view={left?views[left.device.id]:undefined}/><Edge side="right" entry={right} view={right?views[right.device.id]:undefined}/></>}

  <div className={'widget-status'+(!statusMessage?' sr-only':'')} role="status">{statusMessage?<><span className={busy?'status-pending':''}>●</span>{statusMessage}</>:null}<span className="sr-only">{notice==='Настройки применены'?notice:''}</span></div>
 </>;
}
