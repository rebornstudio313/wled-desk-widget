import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {bridge} from './bridge';
import {Peek} from './Peek';
import {LampWidget} from './LampWidget';
import './lamp-mode.css';
import {Scenes} from './Scenes';
import {Icon} from './Icon';
import {WidgetMenu} from './WidgetMenu';
import {LampPicker} from './LampPicker';
import {LampName} from './LampName';
import {Discovery} from './Discovery';
import {About} from './About';
import {StartupSettings} from './StartupSettings';
import {paletteGradient} from './palette-preview';
import {useTransparency,AppearanceSettings,TransparencyPreview} from './AppearanceSettings';
import {useHotkeys,HotkeySettings} from './hotkeys';
import {SyncTargets} from './SyncTargets';
import {EffectPicker} from './EffectPicker';
import {lightPatch} from './copy-light';
import {watchState} from './state-transport';
import {nativeShell,dragWidget,pinWidget,savedPinned,storePinned,closeWidget,observeWindowSize,savedCompact,storeCompact} from './window-shell';
import type {Entry,Patch} from './model';
import './styles.css';


const hex=(rgb:number[])=>'#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
const rgb=(color:string)=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
// Hue runs clockwise from red on the left, matching the visible ring.
function colorHue(color:string):number|null{
 if(!/^#[0-9a-f]{6}$/i.test(color))return null;
 const [r,g,b]=rgb(color),max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
 if(!delta)return null;
 return ((max===r?(g-b)/delta:max===g?(b-r)/delta+2:(r-g)/delta+4)*60+360)%360;
}
function hueColor(hue:number):string{
 const x=1-Math.abs((hue/60)%2-1);
 const values=hue<60?[1,x,0]:hue<120?[x,1,0]:hue<180?[0,1,x]:hue<240?[0,x,1]:hue<300?[x,0,1]:[1,0,x];
 return hex(values.map(v=>v*255));
}
const message=(e:unknown)=>e instanceof Error?e.message:'Не удалось выполнить команду';

function App(){
 const appearance=useTransparency();
 const [transparencyPreview,setTransparencyPreview]=useState(false);

 const [peekEnabled,setPeekEnabled]=useState(()=>{try{return localStorage.getItem('wled-desk.peek.v1')!=='false';}catch{return true;}});
 useEffect(()=>{try{localStorage.setItem('wled-desk.peek.v1',String(peekEnabled));}catch{}},[peekEnabled]);
 const [syncSource,setSyncSource]=useState<string|null>(null);
 const [compact,setCompact]=useState(savedCompact);
 const [lampMode,setLampMode]=useState(()=>{try{return localStorage.getItem('wled-desk.lamp-mode.v1')==='true';}catch{return false;}});
 const [lampSource,setLampSource]=useState(()=>{try{return localStorage.getItem('wled-desk.lamp-source.v1')||'';}catch{return '';}});
 useEffect(()=>{try{localStorage.setItem('wled-desk.lamp-mode.v1',String(lampMode));localStorage.setItem('wled-desk.lamp-source.v1',lampSource);}catch{}},[lampMode,lampSource]);
 const [contextMenu,setContextMenu]=useState<{x:number;y:number}|null>(null);
 useEffect(()=>{storeCompact(compact);},[compact]);
 useEffect(()=>{const element=document.querySelector<HTMLElement>('.layout');if(element)return observeWindowSize(element);},[]);

 const [mode,setMode]=useState<'loading'|'live'>('loading'),[loading,setLoading]=useState(true),[entries,setEntries]=useState<Entry[]>([]),[selection,setSelection]=useState('all'),[settings,setSettings]=useState(false),[address,setAddress]=useState(''),[adding,setAdding]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[color,setColor]=useState('#00bbff'),[brightness,setBrightness]=useState(75),[speed,setSpeed]=useState(128),[intensity,setIntensity]=useState(128);
 useEffect(()=>{if(settings)setTransparencyPreview(false);},[settings]);
 const [pinned,setPinned]=useState(savedPinned);
 useEffect(()=>{void pinWidget(pinned).catch(e=>setNotice(message(e)));},[]);
 async function togglePinned(){try{await pinWidget(!pinned);setPinned(!pinned);storePinned(!pinned);}catch(e){setNotice(message(e));}}

 // Always restore the user's real registry; an empty registry opens onboarding.
 useEffect(()=>{let active=true;void bridge.list().then(()=>{if(active)setMode('live');}).catch(()=>{if(active)setMode('live');});return()=>{active=false;};},[]);
 useEffect(()=>{if(!settings)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setSettings(false)};window.addEventListener('keydown',key);const timer=setTimeout(()=>document.querySelector<HTMLButtonElement>('.settings-heading button')?.focus(),0);return()=>{clearTimeout(timer);window.removeEventListener('keydown',key)}},[settings]);
 const editingControl=useRef(false),hexDirty=useRef(false);
 const operation=useRef(0);const ring=useRef<HTMLDivElement>(null);const lastWheel=useRef(color);
 const drag=useRef<{pointer:number;start:string}|null>(null), rememberedHue=useRef(0);
 const hue=colorHue(color)??rememberedHue.current, radians=(hue-180)*Math.PI/180;
 const markerInset=compact?6.5:10.5;
 const markerStyle={background:color,left:`calc(${50+50*Math.cos(radians)}% - ${markerInset*Math.cos(radians)}px)`,top:`calc(${50+50*Math.sin(radians)}% - ${markerInset*Math.sin(radians)}px)`};
 useEffect(()=>{const next=colorHue(color);if(next!==null)rememberedHue.current=next;if(!drag.current)lastWheel.current=color;},[color]);
 const selected=entries.filter(e=>selection==='all'||e.device.id===selection), ready=selected.filter(e=>e.snapshot&&!e.error), first=ready[0]?.snapshot, segment=first?.state.seg[0];
 const mixedColor=ready.length>1&&ready.some(e=>JSON.stringify(e.snapshot!.state.seg[0]?.col[0])!==JSON.stringify(segment?.col[0]));
 const mixedEffect=ready.length>1&&ready.some(e=>e.snapshot!.effects[e.snapshot!.state.seg[0]?.fx]!==first?.effects[segment?.fx??0]);
 const mixedSpeed=ready.length>1&&ready.some(e=>e.snapshot!.state.seg[0]?.sx!==segment?.sx);
 const mixedIntensity=ready.length>1&&ready.some(e=>e.snapshot!.state.seg[0]?.ix!==segment?.ix);
 const mixed=ready.length>1&&ready.some(e=>e.snapshot!.state.bri!==first?.state.bri);
 const effects=first?.effects.filter(name=>name&&name!=='RSVD'&&name!=='-'&&ready.every(e=>e.snapshot!.effects.includes(name)))||[];
 const [paletteSamples,setPaletteSamples]=useState<Record<string,Record<string,unknown[]>>>({});
 const previewId=ready[0]?.device.id;
 useEffect(()=>{if(!previewId||paletteSamples[previewId])return;let active=true;void bridge.palettePreviews(previewId).then(values=>{if(active)setPaletteSamples(previous=>({...previous,[previewId]:values}));}).catch(()=>{});return()=>{active=false};},[previewId]);
 const palettePreviews:Record<string,string>={};for(const [id,values]of Object.entries(previewId?paletteSamples[previewId]||{}:{})){const name=first?.palettes?.[Number(id)];const gradient=paletteGradient(values,segment?.col||[]);if(name&&gradient)palettePreviews[name]=gradient;}
 const palettes=(first?.palettes||[]).filter(name=>name&&name!=='-'&&ready.every(e=>e.snapshot!.palettes?.includes(name)));
 const paletteName=(entry:Entry)=>{const id=entry.snapshot?.state.seg[0]?.pal??0;return entry.snapshot?.palettes?.[id]||`Палитра ${id}`;};
 const palette=ready.length>1&&ready.some(e=>paletteName(e)!==paletteName(ready[0]))?'Разные цвета':ready.length?paletteName(ready[0]):'Default';
 const effect=mixedEffect?'Разные эффекты':segment?first?.effects[segment.fx]||'Solid':'Solid';
 const pushVersions=useRef<Record<string,number>>({}),working=useRef(false);working.current=busy||adding;
 const deviceKey=entries.map(e=>e.device.id).sort().join(',');
 useEffect(()=>{if(!deviceKey)return;return (()=>{const stops=deviceKey.split(',').map(id=>watchState(id,value=>{
  pushVersions.current[id]=(pushVersions.current[id]||0)+1;
  if(working.current)return;
  setEntries(previous=>previous.map(entry=>entry.device.id===id&&entry.snapshot?{...entry,error:undefined,snapshot:{...entry.snapshot,state:value.state,info:value.info||entry.snapshot.info}}:entry));
 },()=>{if(!working.current)void bridge.refresh(id).then(snapshot=>setEntries(previous=>previous.map(entry=>entry.device.id===id?{...entry,snapshot,error:undefined}:entry))).catch(()=>setEntries(previous=>previous.map(entry=>entry.device.id===id?{...entry,error:'Нет связи'}:entry)));}));return()=>stops.forEach(stop=>stop());})();},[deviceKey]);

 async function refresh(){
  if(mode!=='live')return;const epoch=operation.current;
  try{
   const records=await bridge.list();if(epoch!==operation.current)return;
   // Show saved devices immediately while their individual network reads finish.
   setEntries(previous=>{
    if(previous.length===records.length&&previous.every((entry,index)=>entry.device.id===records[index].id&&entry.device.address===records[index].address&&entry.device.name===records[index].name))return previous;
    return records.map(device=>{const existing=previous.find(entry=>entry.device.id===device.id);return existing?{...existing,device}:{device};});
   });
   const versions={...pushVersions.current};
   const next=await Promise.all(records.map(async device=>{try{return {device,snapshot:await bridge.refresh(device.id)}}catch(e){return {device,error:message(e)}}}));
   if(epoch===operation.current)setEntries(previous=>next.map(entry=>(pushVersions.current[entry.device.id]||0)!==(versions[entry.device.id]||0)?previous.find(old=>old.device.id===entry.device.id)||entry:entry));
  }catch(e){if(epoch===operation.current)setNotice(message(e));}
  finally{if(epoch===operation.current)setLoading(false);}
 }
 useEffect(()=>{
  if(mode==='loading')return;
  operation.current++;setSelection('all');setNotice('');
  setLoading(true);setEntries([]);void refresh();
  return ()=>{operation.current++;};
 },[mode]);
 useEffect(()=>{if(mode!=='live')return;const interval=setInterval(()=>{if(!busy&&!adding)void refresh();},5000);return()=>clearInterval(interval)},[mode,busy,adding]);
 useEffect(()=>{if(!first||drag.current||hexDirty.current||editingControl.current)return;setBrightness(Math.round(first.state.bri/255*100));const seg=first.state.seg[0];if(seg){setColor(hex(seg.col[0].slice(0,3)));setSpeed(seg.sx);setIntensity(seg.ix);}},[entries,selection]);

 async function apply(make:(entry:Entry)=>Patch,targets:Entry[]=[...selected]){
  if(busy||!targets.length)return;operation.current++;setBusy(true);setNotice('');
  const results=await Promise.all(targets.map(async entry=>{if(!entry.snapshot||entry.error)return {id:entry.device.id,error:'Лампа недоступна'};try{const patch=make(entry);const updated={device:entry.device,snapshot:await bridge.patch(entry.device.id,patch)};return {id:entry.device.id,updated}}catch(e){return {id:entry.device.id,error:message(e)}}}));
  setEntries(previous=>previous.map(entry=>results.find(r=>r.id===entry.device.id)?.updated||entry));
  const errors=results.filter(r=>r.error);setNotice(errors.length?errors.map(e=>`${targets.find(x=>x.device.id===e.id)?.device.name||'Лампа'}: ${e.error}`).join(' · '):'Настройки применены');setBusy(false);
 }
 async function combineLamps(sourceId=selection,targetIds?:string[]){
  if(busy||loading||adding)return;
  if(sourceId==='all')return;
  const source=entries.find(entry=>entry.device.id===sourceId);if(!source)return;
  setBusy(true);setNotice('');operation.current++;
  try{
   const snapshot=await bridge.refresh(source.device.id);
   const results=await Promise.all(entries.filter(entry=>entry.device.id!==source.device.id&&(!targetIds||targetIds.includes(entry.device.id))).map(async entry=>{
    try{const target=await bridge.refresh(entry.device.id);const updated=await bridge.patch(entry.device.id,lightPatch(snapshot,target));return {id:entry.device.id,updated};}
    catch(error){return {id:entry.device.id,error:message(error)};}
   }));
   setEntries(previous=>previous.map(entry=>entry.device.id===source.device.id?{...entry,snapshot,error:undefined}:results.find(result=>result.id===entry.device.id)?.updated?{...entry,snapshot:results.find(result=>result.id===entry.device.id)!.updated,error:undefined}:entry));
   if(!targetIds)setSelection('all');
   const errors=results.filter(result=>result.error);
   if(targetIds&&errors.length)throw Error(errors.map(result=>`${entries.find(entry=>entry.device.id===result.id)?.device.name}: ${result.error}`).join(' · '));
   setNotice(errors.length?errors.map(result=>`${entries.find(entry=>entry.device.id===result.id)?.device.name}: ${result.error}`).join(' · '):'Настройки применены');
  }catch(error){setNotice(`${source.device.name}: ${message(error)}`);if(targetIds)throw error;}
  finally{setBusy(false);}
 }
 const segmentPatch=(fields:object)=>(entry:Entry):Patch=>({seg:[{id:entry.snapshot!.state.seg[0].id,...fields}]});
 async function add(event:React.FormEvent){event.preventDefault();if(adding)return;setAdding(true);setNotice('');try{await bridge.add(address);setAddress('');await refresh();}catch(e){setNotice(message(e))}finally{setAdding(false)}}
 async function remove(id:string){try{await bridge.remove(id);setSelection('all');await refresh();}catch(e){setNotice(message(e))}}
 function wheel(event:React.PointerEvent){
  if(!ring.current)return;
  const box=ring.current.getBoundingClientRect();
  const next=(Math.atan2(event.clientY-box.top-box.height/2,event.clientX-box.left-box.width/2)*180/Math.PI+180)%360;
  rememberedHue.current=next;lastWheel.current=hueColor(next);setColor(lastWheel.current);
 }
 function startWheel(event:React.PointerEvent<HTMLDivElement>){
  if(!ready.length||busy||!event.isPrimary||event.button!==0||(event.target as Element).closest('.wheel-inner'))return;
  event.preventDefault();drag.current={pointer:event.pointerId,start:color};
  event.currentTarget.setPointerCapture(event.pointerId);wheel(event);
 }
 function finishWheel(event:React.PointerEvent<HTMLDivElement>,cancel=false){
  if(drag.current?.pointer!==event.pointerId)return;
  const original=drag.current.start;
  if(cancel){lastWheel.current=original;setColor(original);}else wheel(event);
  drag.current=null;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  if(!cancel)void apply(segmentPatch({fx:0,col:[rgb(lastWheel.current)]}));
 }


 const hotkeyBusy=useRef(false);
 const hotkeys=useHotkeys(action=>{
  if(action==='compact'){setCompact(value=>!value);return;}
  if(action==='settings'){setSettings(true);return;}
  if(busy||loading||adding||hotkeyBusy.current||!ready.length)return;
  if(['work','evening','cinema'].includes(action)){
   if(document.querySelector('[role="dialog"]:not([hidden])')||settings)return;
   const button=document.querySelector<HTMLButtonElement>('.scene-tile--'+action+' .scene-activate');if(button?.title==='Настроить сценарий')setCompact(false);button?.click();return;
  }
  if(!['power','brighter','dimmer'].includes(action))return;
  hotkeyBusy.current=true;
  const value=Math.max(0,Math.min(100,Math.round((first?.state.bri??0)*100/255)+(action==='brighter'?5:-5)));
  void apply(()=>action==='power'?{on:!ready.every(e=>e.snapshot!.state.on)}:value===0?{on:false}:{on:true,bri:Math.round(value*255/100)}).finally(()=>{hotkeyBusy.current=false;});
 });

 return <main className="workspace" onMouseDown={e=>{
  if(!nativeShell||e.button!==0||!(e.target instanceof Element))return;
  const target=e.target;
  if(!target.closest('.widget,.side')||target.closest('button,a,input,select,textarea,label,summary,[role="button"],[role="switch"],[role="slider"],[role="combobox"],[contenteditable="true"],.hue-wheel,[data-no-drag]'))return;
  e.preventDefault();void dragWidget().catch(error=>setNotice(message(error)));
 }}>
 <div className="layout"><section className="widget" tabIndex={-1} onContextMenu={e=>{e.preventDefault();setContextMenu({x:e.clientX,y:e.clientY});}} onKeyDown={e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();const box=e.currentTarget.getBoundingClientRect();setContextMenu({x:box.left+12,y:box.top+34});}}} data-compact={lampMode?false:compact} data-lamp-mode={lampMode} aria-label="Управление лампами">
 {lampMode?<LampWidget entry={entries.find(e=>e.device.id===lampSource)||entries.find(e=>e.device.id===selection)||entries[0]} onControls={()=>setLampMode(false)}/>:<>
 <div className="widget-chrome"><span title="Перетащить окно"><img src="/icon.svg" alt=""/>WLED Desk | Widget</span><button aria-label={compact?'Развернуть виджет':'Компактный режим'} aria-pressed={compact} title={compact?'Развернуть виджет':'Свернуть в мини-виджет'} onClick={()=>setCompact(!compact)}><Icon kind={compact?'expand':'collapse'}/></button><button aria-label="Закрыть виджет" disabled={!nativeShell} title={nativeShell?'Закрыть окно в трей. Вернуть — значком возле часов':'Доступно в настольной версии'} onClick={()=>void closeWidget().catch(e=>setNotice(message(e)))}><Icon kind="close"/></button></div>
 <div className="power-section">
  <div className="power-summary"><span className="power-title"><i className={'connection-dot '+(selected.some(e=>e.error)?'offline':ready.length?'online':'connecting')}/>{selection==='all'?'Все лампы':selected[0]?.device.name||'Питание'}</span><span className="power-description" role="status">{selected.some(e=>e.error)?selected.filter(e=>e.error).map(e=>`${e.device.name}: нет связи`).join(' · '):!ready.length?'Нет соединения':ready.every(e=>e.snapshot!.state.on)?'Свет включён':ready.every(e=>!e.snapshot!.state.on)?'Свет выключен':'Часть ламп выключена'}</span></div>
  <button className="power-toggle" title={ready.length?(ready.every(e=>e.snapshot!.state.on)?'Выключить свет':'Включить свет'):'Нет соединения с лампами'} role="switch" aria-label="Питание выбранных ламп" aria-checked={!!ready.length&&ready.every(e=>e.snapshot!.state.on)} disabled={!ready.length||busy} onClick={()=>void apply(()=>({on:!ready.every(e=>e.snapshot!.state.on)}))}><span className="mini-power-icon"><Icon kind="power"/></span><span className="switch-track"><span><Icon kind="power"/></span></span></button>
  <button className="body-settings" title="Настройки ламп" aria-label="Настройки ламп" aria-expanded={settings} aria-controls="widget-settings" onClick={()=>setSettings(!settings)}><Icon kind="settings"/></button>
 </div>
 <nav className="devices" aria-label="Выбор лампы"><button className={selection==='all'?'selected':''} disabled={busy||loading||adding} title="Объединить: передать свет выбранной лампы остальным" onClick={()=>void combineLamps()}><Icon kind="link"/>Все лампы</button><LampPicker entries={entries} selection={selection} disabled={busy||loading||adding} onSelect={setSelection} onPower={entry=>apply(()=>({on:!entry.snapshot!.state.on}),[entry])}/></nav>
 {selection!=='all'&&!compact&&<button className="sync-lamp-button" onClick={()=>setSyncSource(selection)}><Icon kind="link"/>Синхронизировать с…</button>}

 {loading&&!entries.length?<div className="empty" role="status"><Icon kind="lamp"/><h2>Подключаем лампы…</h2><p>Загружаем сохранённые адреса<br/>и проверяем соединение.</p></div>:!entries.length?<div className="empty"><Icon kind="lamp"/><h2>Добавьте первую лампу</h2><p>Введите её адрес в настройках.<br/>Нужен только WLED и локальная сеть.</p><button className="primary" onClick={()=>setSettings(true)}>＋ Добавить лампу</button></div>:<>
 {selected.some(e=>e.snapshot?.info.live)&&<div className="warning">На лампе активен внешний поток. Встроенные эффекты WLED могут быть перекрыты.</div>}
 <fieldset disabled={!ready.length||busy} className="controls" onPointerDownCapture={()=>{editingControl.current=true;}} onPointerUpCapture={()=>{editingControl.current=false;}} onPointerCancelCapture={()=>{editingControl.current=false;}}><div className="color-area"><div className="hue-wheel" ref={ring} onPointerDown={startWheel} onPointerMove={e=>{if(drag.current?.pointer===e.pointerId)wheel(e)}} onPointerUp={e=>finishWheel(e)} onPointerCancel={e=>finishWheel(e,true)} onLostPointerCapture={e=>{if(drag.current?.pointer===e.pointerId)finishWheel(e,true)}}><div className="wheel-inner"><label className="color-center" style={{background:mixedColor?'conic-gradient(#12c5ed,#a174ed,#f6bd69,#12c5ed)':color}} title={mixedColor?'Разные цвета ламп':'Выбрать цвет'}><input aria-label="Цвет ламп" type="color" value={color} onChange={e=>{setColor(e.target.value);void apply(segmentPatch({fx:0,col:[rgb(e.target.value)]}))}}/></label></div><span className="wheel-marker" style={markerStyle}/></div><div className="brightness"><div className="slider-label"><label htmlFor="brightness">Яркость</label><span>{mixed?'Разная':`${brightness}%`}</span></div><input id="brightness" aria-label="Яркость" type="range" min="0" max="100" value={brightness} onChange={e=>setBrightness(+e.target.value)} onPointerUp={()=>void apply(()=>brightness===0?{on:false}:{on:true,bri:Math.round(brightness*255/100)})} onKeyUp={e=>{if(e.ctrlKey||e.altKey||e.shiftKey||e.metaKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key))return;void apply(()=>brightness===0?{on:false}:{on:true,bri:Math.round(brightness*255/100)});}}/><div className="brightness-hints"><span>Тихое свечение</span><span>Ярко</span></div><div className="hex-field"><span>HEX</span><input aria-label="HEX цвет" placeholder={mixedColor?'Разные цвета':undefined} value={mixedColor&&document.activeElement?.getAttribute('aria-label')!=='HEX цвет'?'':color.toUpperCase()} maxLength={7} onChange={e=>{const value=e.target.value;if(/^#[0-9a-f]{0,6}$/i.test(value)){hexDirty.current=true;setColor(value);}}} onBlur={()=>{if(!hexDirty.current)return;hexDirty.current=false;if(/^#[0-9a-f]{6}$/i.test(color))void apply(segmentPatch({fx:0,col:[rgb(color)]}));else if(segment)setColor(hex(segment.col[0].slice(0,3)))}}/></div></div></div>
 <div className="effect-panel"><label className="effect-select">Эффект<EffectPicker label="Эффект" value={effect} options={effects} disabled={!ready.length||busy} onChange={name=>{void apply(entry=>({seg:[{id:entry.snapshot!.state.seg[0].id,fx:entry.snapshot!.effects.indexOf(name)}]}))}}/></label><label className="palette-select">Цвет<EffectPicker label="Цвет эффекта" previews={palettePreviews} value={palette} options={palettes} disabled={!ready.length||busy||!palettes.length} onChange={name=>void apply(entry=>({seg:[{id:entry.snapshot!.state.seg[0].id,pal:entry.snapshot!.palettes!.indexOf(name)}]}))}/></label><label>Скорость{mixedSpeed&&<span className="mixed-value">Разная</span>}<input aria-label="Скорость эффекта" disabled={effect==='Solid'} type="range" min="0" max="255" value={speed} onChange={e=>setSpeed(+e.target.value)} onPointerUp={()=>void apply(segmentPatch({sx:speed}))} onKeyUp={e=>{if(e.ctrlKey||e.altKey||e.shiftKey||e.metaKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key))return;void apply(segmentPatch({sx:speed}));}}/></label><label>Интенсивность{mixedIntensity&&<span className="mixed-value">Разная</span>}<input aria-label="Интенсивность эффекта" disabled={effect==='Solid'} type="range" min="0" max="255" value={intensity} onChange={e=>setIntensity(+e.target.value)} onPointerUp={()=>void apply(segmentPatch({ix:intensity}))} onKeyUp={e=>{if(e.ctrlKey||e.altKey||e.shiftKey||e.metaKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key))return;void apply(segmentPatch({ix:intensity}));}}/></label></div>

 {selection!=='all'&&first&&Object.keys(first.presets).some(id=>+id>0)&&<div className="presets"><span>Пресеты на лампе</span>{Object.entries(first.presets).filter(([id])=>+id>0).map(([id,preset])=><button key={id} onClick={()=>void apply(()=>({ps:+id}))}>{preset.n||`Пресет ${id}`}</button>)}</div>}
 </fieldset><Scenes entries={entries} busy={busy} onApply={apply}/></>}
 <Peek enabled={peekEnabled} suspended={compact} entries={entries} selection={selection} notice={loading?'Подключаем лампы…':notice} busy={busy}/>
 {compact&&<p className={loading||notice&&notice!=='Настройки применены'?'compact-target':'compact-target sr-only'} role="status">{loading?'Подключаем лампы…':notice||`${selection==='all'?`${selected.length} лампы`:selected[0]?.device.name||'Нет выбранной лампы'}`}</p>}
 </>}
 </section>
 {transparencyPreview&&<TransparencyPreview value={appearance} onDone={()=>setTransparencyPreview(false)} onBack={()=>{setTransparencyPreview(false);setSettings(true);}}/>}
 <aside id="widget-settings" className="side" role="dialog" aria-modal="true" aria-label="Настройки виджета" hidden={!settings}><div className="settings-heading"><h2>Настройки</h2><button aria-label="Закрыть настройки" onClick={()=>{hotkeys.setRecording(null);setSettings(false);}}>×</button></div>
 <section className="settings"><div className="eyebrow">ПОДКЛЮЧЕНИЕ</div><h2>Ваш свет — ваши адреса</h2><p>Укажите IP-адрес или имя WLED в локальной сети.</p><Discovery active={settings} entries={entries} busy={busy||adding||loading} onAdd={async address=>{setAdding(true);try{await bridge.add(address);await refresh();}finally{setAdding(false);}}}/><form onSubmit={add}><label htmlFor="address">Адрес лампы</label><input id="address" placeholder="192.168.1.50 или lamp.local" value={address} onChange={e=>setAddress(e.target.value)} disabled={adding}/><button className="primary" disabled={adding||!address.trim()}>{adding?'Проверяем WLED…':'＋ Добавить лампу'}</button></form>{entries.map(e=><div className="device-record" key={e.device.id}><div><LampName name={e.device.name} disabled={busy} onSave={async name=>{operation.current++;setBusy(true);try{const device=await bridge.rename(e.device.id,name);setEntries(previous=>previous.map(entry=>entry.device.id===device.id?{...entry,device}:entry));}finally{setBusy(false);}}}/><small>{e.error||`${e.snapshot?.info.leds.count??'…'} LED · WLED ${e.snapshot?.info.ver??'…'}`}</small></div><button className="device-sync-button" aria-label={`Синхронизация ${e.device.name}`} title="Настроить синхронизацию" onClick={()=>{setSettings(false);setSyncSource(e.device.id);}}><Icon kind="link"/></button><button aria-label={`Удалить ${e.device.name}`} onClick={()=>void remove(e.device.id)}>×</button></div>)}</section>
 <p className="privacy"><span>◎</span> Управление лампами — в локальной сети.<br/>Адреса не публикуются и не отправляются в облако.</p><label className="peek-setting"><span><Icon kind="peek"/><b>Предпросмотр ленты Peek</b><small>Цвета ленты по краям</small></span><input type="checkbox" role="switch" aria-label="Предпросмотр ленты Peek" checked={peekEnabled} onChange={e=>setPeekEnabled(e.target.checked)}/></label><AppearanceSettings value={appearance} onEdit={()=>{hotkeys.setRecording(null);setSettings(false);setTransparencyPreview(true);}}/><StartupSettings/><HotkeySettings value={hotkeys} active={settings}/><About/></aside></div>
 {syncSource&&entries.find(e=>e.device.id===syncSource)&&<SyncTargets key={syncSource} source={entries.find(e=>e.device.id===syncSource)!} entries={entries} busy={busy} onSync={combineLamps} onClose={()=>setSyncSource(null)}/>}
 {contextMenu&&<WidgetMenu point={contextMenu} lampMode={lampMode} onLampMode={()=>{setLampMode(value=>!value);setSettings(false);}} lampSources={entries.map(e=>({id:e.device.id,name:e.device.name}))} lampSource={(entries.find(e=>e.device.id===lampSource)||entries.find(e=>e.device.id===selection)||entries[0])?.device.id} onLampSource={id=>{setLampSource(id);setLampMode(true);setSettings(false);}} compact={compact} pinned={pinned} native={nativeShell} onCompact={()=>setCompact(value=>!value)} onPinned={()=>void togglePinned()} onClose={()=>setContextMenu(null)}/>}
 </main>
}
document.documentElement.dataset.shell=(window as unknown as {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__?'native':'preview';
createRoot(document.getElementById('root')!).render(<App/>);
