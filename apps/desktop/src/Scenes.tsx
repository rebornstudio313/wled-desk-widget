import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {bridge} from './bridge';
import {Icon} from './Icon';
import type {Entry,Patch,Scene,SceneAction,SceneSlot} from './model';
const definitions=[{slot:'work',name:'Работа',color:'#c9eaff',bri:230},{slot:'evening',name:'Вечер',color:'#ff9e52',bri:115},{slot:'cinema',name:'Кино',color:'#7155ff',bri:64}] as const;
const errorText=(e:unknown)=>e instanceof Error?e.message:'Не удалось сохранить сценарий';
function defaults(slot:SceneSlot):SceneAction{const d=definitions.find(d=>d.slot===slot)!;return {kind:'custom',on:true,bri:d.bri,color:d.color,effect:'Solid',speed:128,intensity:128};}
function current(entry:Entry,slot:SceneSlot):SceneAction{
 const snapshot=entry.snapshot,seg=snapshot?.state.seg[0];if(!snapshot||!seg)return defaults(slot);
 return {kind:'custom',on:snapshot.state.on,bri:Math.max(1,snapshot.state.bri),color:'#'+seg.col[0].slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join(''),effect:snapshot.effects[seg.fx]||'Solid',speed:seg.sx??128,intensity:seg.ix??128};
}
export function scenePatch(action:SceneAction,entry:Entry):Patch{
 if(action.kind==='preset'){
  if(!entry.snapshot?.presets[String(action.presetId)])throw Error(`Пресет ${action.presetId} отсутствует на лампе`);
  return {ps:action.presetId};
 }
 const snapshot=entry.snapshot!,fx=snapshot.effects.indexOf(action.effect);if(fx<0)throw Error(`Эффект «${action.effect}» недоступен`);
 return {on:action.on,bri:action.bri,seg:[{id:snapshot.state.seg[0].id,fx,col:[[1,3,5].map(i=>parseInt(action.color.slice(i,i+2),16))],sx:action.speed,ix:action.intensity}]};
}
type Row={deviceId:string;enabled:boolean;action:SceneAction};
function Editor({slot,scene,entries,onSave,onClose}:{slot:SceneSlot;scene?:Scene;entries:Entry[];onSave:(scene:Scene)=>Promise<void>;onClose:()=>void}){
 const definition=definitions.find(d=>d.slot===slot)!;
 const [rows,setRows]=useState<Row[]>(()=>{
  const ids=[...new Set([...entries.map(e=>e.device.id),...(scene?.targets.map(t=>t.deviceId)||[])])];
  return ids.map(deviceId=>({deviceId,enabled:scene?scene.targets.some(t=>t.deviceId===deviceId):true,action:structuredClone(scene?.targets.find(t=>t.deviceId===deviceId)?.action||defaults(slot))}));
 });
 const [saving,setSaving]=useState(false),[error,setError]=useState('');const close=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!saving)onClose();};window.addEventListener('keydown',key);return ()=>{window.removeEventListener('keydown',key);previous?.focus();};},[saving]);
 const update=(id:string,change:Partial<Row>)=>setRows(rows=>rows.map(r=>r.deviceId===id?{...r,...change}:r));
 const action=(id:string,fields:object)=>setRows(rows=>rows.map(r=>r.deviceId===id?{...r,action:{...r.action,...fields} as SceneAction}:r));
 async function save(event:React.FormEvent){
  event.preventDefault();setError('');
  const targets=rows.filter(r=>r.enabled).map(({deviceId,action})=>({deviceId,action}));
  if(!targets.length){setError('Выберите хотя бы одну лампу');return;}
  for(const target of targets){const entry=entries.find(e=>e.device.id===target.deviceId);if(!entry){setError('Уберите удалённую лампу из сценария');return;}if(target.action.kind==='custom'&&!/^#[0-9a-f]{6}$/i.test(target.action.color)){setError('Укажите цвет в формате #RRGGBB');return;}if(entry.snapshot){try{scenePatch(target.action,entry)}catch(e){setError(`${entry.device.name}: ${errorText(e)}`);return;}}}
  setSaving(true);try{await onSave({slot,targets});onClose();}catch(e){setError(errorText(e));}finally{setSaving(false);}
 }
 function trap(event:React.KeyboardEvent){if(event.key!=='Tab')return;const elements=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')).filter(e=>e.offsetParent!==null);const first=elements[0],last=elements.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
 return createPortal(<div className="scene-backdrop"><section className="scene-editor" role="dialog" aria-modal="true" aria-label={`Настройка сценария ${definition.name}`} onKeyDown={trap}>
 <div className="settings-heading"><h2><Icon kind={slot}/>{definition.name}</h2><button ref={close} aria-label="Закрыть сценарий" disabled={saving} onClick={onClose}>×</button></div>
 <p className="scene-help">Выберите лампы и задайте действие для каждой. Сохранение не меняет свет.</p>
 <form onSubmit={save}><fieldset disabled={saving} className="scene-form">
 {rows.map(row=>{const entry=entries.find(e=>e.device.id===row.deviceId),a=row.action,snapshot=entry?.snapshot;const presets=Object.entries(snapshot?.presets||{}).filter(([id])=>+id>0&&+id<=250);return <section className="scene-device" key={row.deviceId}>
 <label className="scene-device-label"><input type="checkbox" checked={row.enabled} onChange={e=>update(row.deviceId,{enabled:e.target.checked})}/><Icon kind="lamp"/>{entry?.device.name||'Удалённая лампа'}</label>
 {entry&&<small>{entry.device.address}{entry.error?' · недоступна':''}</small>}
 {row.enabled&&entry&&<><label>Источник<select aria-label={`Источник ${entry.device.name}`} value={a.kind} onChange={e=>update(row.deviceId,{action:e.target.value==='preset'?{kind:'preset',presetId:presets[0]?+presets[0][0]:1}:defaults(slot)})}><option value="custom">Свои параметры</option><option value="preset" disabled={!presets.length&&a.kind!=='preset'}>Пресет WLED{!presets.length?' — нет доступных':''}</option></select></label>
 {a.kind==='preset'?<label>Пресет<select aria-label={`Пресет ${entry.device.name}`} value={a.presetId} onChange={e=>action(row.deviceId,{presetId:+e.target.value})}>{!presets.some(([id])=>+id===a.presetId)&&<option value={a.presetId}>№{a.presetId} — отсутствует / не загружен</option>}{presets.map(([id,p])=><option key={id} value={id}>{p.n||'Пресет'} · №{id}</option>)}</select></label>:<>
 <button type="button" className="scene-current" disabled={!snapshot} onClick={()=>update(row.deviceId,{action:current(entry,slot)})}>Взять текущее состояние</button>
 <label className="scene-check"><input type="checkbox" checked={a.on} onChange={e=>action(row.deviceId,{on:e.target.checked})}/>Включить лампу</label>
 <div className="scene-color"><input type="color" aria-label={`Цвет сценария ${entry.device.name}`} value={/^#[0-9a-f]{6}$/i.test(a.color)?a.color:'#000000'} onChange={e=>action(row.deviceId,{color:e.target.value})}/><label>HEX<input aria-label={`HEX сценария ${entry.device.name}`} value={a.color.toUpperCase()} maxLength={7} onChange={e=>action(row.deviceId,{color:e.target.value})}/></label></div>
 <label>Яркость · {Math.round(a.bri/255*100)}%<input aria-label={`Яркость сценария ${entry.device.name}`} type="range" min="1" max="255" value={a.bri} onChange={e=>action(row.deviceId,{bri:+e.target.value})}/></label>
 <label>Эффект<select aria-label={`Эффект сценария ${entry.device.name}`} value={a.effect} onChange={e=>action(row.deviceId,{effect:e.target.value})}>{!snapshot?.effects.includes(a.effect)&&<option>{a.effect}</option>}{snapshot?.effects.filter(n=>n&&n!=='RSVD'&&n!=='-').map(n=><option key={n}>{n}</option>)}</select></label>
 <div className="scene-sliders"><label>Скорость · {a.speed}<input aria-label={`Скорость сценария ${entry.device.name}`} type="range" min="0" max="255" value={a.speed} disabled={a.effect==='Solid'} onChange={e=>action(row.deviceId,{speed:+e.target.value})}/></label><label>Интенсивность · {a.intensity}<input aria-label={`Интенсивность сценария ${entry.device.name}`} type="range" min="0" max="255" value={a.intensity} disabled={a.effect==='Solid'} onChange={e=>action(row.deviceId,{intensity:+e.target.value})}/></label></div>
 </> }</>}
 </section>;})}
 {error&&<p role="alert" className="scene-error">{error}</p>}
 <div className="scene-save"><button type="button" onClick={onClose}>Отмена</button><button className="primary" type="submit">{saving?'Сохраняем…':'Сохранить'}</button></div>
 </fieldset></form></section></div>,document.body);
}
export function Scenes({entries,busy,onApply}:{entries:Entry[];busy:boolean;onApply:(make:(entry:Entry)=>Patch,targets:Entry[])=>Promise<void>}){
 const [scenes,setScenes]=useState<Scene[]>([]),[editing,setEditing]=useState<SceneSlot|null>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{let active=true;setLoaded(false);setError('');setEditing(null);void bridge.scenes().then(value=>{if(active){setScenes(value);setLoaded(true);}}).catch(e=>{if(active)setError(errorText(e));});return ()=>{active=false;};},[reload]);
 async function save(scene:Scene){const saved=await bridge.saveScene(scene);setScenes(previous=>[...previous.filter(s=>s.slot!==scene.slot),saved]);}
 async function activate(slot:SceneSlot){const scene=scenes.find(s=>s.slot===slot);if(!scene?.targets.length){setEditing(slot);return;}const targets=scene.targets.map(t=>entries.find(e=>e.device.id===t.deviceId)||{device:{id:t.deviceId,name:'Удалённая лампа',address:''},error:'Лампа удалена'});await onApply(entry=>scenePatch(scene.targets.find(t=>t.deviceId===entry.device.id)!.action,entry),targets);}
 return <><div className="scenes">{definitions.map(d=>{const configured=!!scenes.find(s=>s.slot===d.slot)?.targets.length;return <div className="scene-tile" key={d.slot}><button className="scene-activate" disabled={!loaded||busy} title={configured?'Применить сохранённый сценарий':'Настроить сценарий'} onClick={()=>void activate(d.slot)}><Icon kind={d.slot}/><span>{d.name}</span></button><button className="scene-edit" disabled={!loaded||busy} aria-label={`Настроить ${d.name}`} title={`Настроить ${d.name}`} onClick={()=>setEditing(d.slot)}><Icon kind="settings"/></button></div>;})}</div>
 {error&&<p className="scene-error" role="alert">{error} <button onClick={()=>setReload(n=>n+1)}>Повторить загрузку</button></p>}
 {editing&&<Editor key={editing} slot={editing} scene={scenes.find(s=>s.slot===editing)} entries={entries} onSave={save} onClose={()=>setEditing(null)}/>}</>;
}
