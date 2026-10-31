import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {bridge} from './bridge';
import {Peek} from './Peek';
import {Scenes} from './Scenes';
import {Icon} from './Icon';
import {EffectPicker} from './EffectPicker';
import {nativeShell,dragWidget,pinWidget,savedPinned,storePinned,hideWidget,observeWindowSize,savedCompact,storeCompact} from './window-shell';
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
 const [compact,setCompact]=useState(savedCompact);
 useEffect(()=>{storeCompact(compact);},[compact]);
 useEffect(()=>{const element=document.querySelector<HTMLElement>('.widget');if(element)return observeWindowSize(element);},[]);

 const [mode,setMode]=useState<'loading'|'live'>('loading'),[loading,setLoading]=useState(true),[entries,setEntries]=useState<Entry[]>([]),[selection,setSelection]=useState('all'),[tab,setTab]=useState('color'),[settings,setSettings]=useState(false),[address,setAddress]=useState(''),[adding,setAdding]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[color,setColor]=useState('#00bbff'),[brightness,setBrightness]=useState(75),[speed,setSpeed]=useState(128),[intensity,setIntensity]=useState(128);
 const [pinned,setPinned]=useState(savedPinned);
 useEffect(()=>{void pinWidget(pinned).catch(e=>setNotice(message(e)));},[]);
 async function togglePinned(){try{await pinWidget(!pinned);setPinned(!pinned);storePinned(!pinned);}catch(e){setNotice(message(e));}}

 // Always restore the user's real registry; an empty registry opens onboarding.
 useEffect(()=>{let active=true;void bridge.list().then(()=>{if(active)setMode('live');}).catch(()=>{if(active)setMode('live');});return()=>{active=false;};},[]);
 useEffect(()=>{if(!settings)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setSettings(false)};window.addEventListener('keydown',key);const timer=setTimeout(()=>document.querySelector<HTMLButtonElement>('.settings-heading button')?.focus(),0);return()=>{clearTimeout(timer);window.removeEventListener('keydown',key)}},[settings]);
 const operation=useRef(0);const ring=useRef<HTMLDivElement>(null);const lastWheel=useRef(color);
 const drag=useRef<{pointer:number;start:string}|null>(null), rememberedHue=useRef(0);
 const hue=colorHue(color)??rememberedHue.current, radians=(hue-180)*Math.PI/180;
 const markerInset=compact?6.5:10.5;
 const markerStyle={background:color,left:`calc(${50+50*Math.cos(radians)}% - ${markerInset*Math.cos(radians)}px)`,top:`calc(${50+50*Math.sin(radians)}% - ${markerInset*Math.sin(radians)}px)`};
 useEffect(()=>{const next=colorHue(color);if(next!==null)rememberedHue.current=next;if(!drag.current)lastWheel.current=color;},[color]);
 const selected=entries.filter(e=>selection==='all'||e.device.id===selection), ready=selected.filter(e=>e.snapshot&&!e.error), first=ready[0]?.snapshot, segment=first?.state.seg[0];
 const mixed=ready.length>1&&ready.some(e=>e.snapshot!.state.bri!==first?.state.bri);
 const effects=first?.effects.filter(name=>name&&name!=='RSVD'&&name!=='-'&&ready.every(e=>e.snapshot!.effects.includes(name)))||[];
 const effect=segment?first?.effects[segment.fx]||'Solid':'Solid';

 async function refresh(){
  if(mode!=='live')return;const epoch=operation.current;
  try{
   const records=await bridge.list();if(epoch!==operation.current)return;
   // Show saved devices immediately while their individual network reads finish.
   setEntries(previous=>{
    if(previous.length===records.length&&previous.every((entry,index)=>entry.device.id===records[index].id&&entry.device.address===records[index].address&&entry.device.name===records[index].name))return previous;
    return records.map(device=>{const existing=previous.find(entry=>entry.device.id===device.id);return existing?{...existing,device}:{device};});
   });
   const next=await Promise.all(records.map(async device=>{try{return {device,snapshot:await bridge.refresh(device.id)}}catch(e){return {device,error:message(e)}}}));
   if(epoch===operation.current)setEntries(next);
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
 useEffect(()=>{if(!first)return;setBrightness(Math.round(first.state.bri/255*100));const seg=first.state.seg[0];if(seg){setColor(hex(seg.col[0].slice(0,3)));setSpeed(seg.sx);setIntensity(seg.ix);}},[entries,selection]);

 async function apply(make:(entry:Entry)=>Patch,targets:Entry[]=[...selected]){
  if(busy||!targets.length)return;setBusy(true);setNotice('');
  const results=await Promise.all(targets.map(async entry=>{if(!entry.snapshot||entry.error)return {id:entry.device.id,error:'Лампа недоступна'};try{const patch=make(entry);const updated={device:entry.device,snapshot:await bridge.patch(entry.device.id,patch)};return {id:entry.device.id,updated}}catch(e){return {id:entry.device.id,error:message(e)}}}));
  setEntries(previous=>previous.map(entry=>results.find(r=>r.id===entry.device.id)?.updated||entry));
  const errors=results.filter(r=>r.error);setNotice(errors.length?errors.map(e=>`${targets.find(x=>x.device.id===e.id)?.device.name||'Лампа'}: ${e.error}`).join(' · '):'Настройки применены');setBusy(false);
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


 return <main className="workspace">
 <div className="layout"><section className="widget" data-compact={compact} data-tab={tab} aria-label="Управление лампами">
 <div className="widget-chrome" onMouseDown={e=>{if(nativeShell&&e.button===0&&!(e.target as Element).closest('button')){e.preventDefault();void dragWidget().catch(error=>setNotice(message(error)));}}}><span title="Перетащить окно"><img src="/icon.svg" alt=""/>WLED Desk | Widget</span><button aria-label={compact?'Развернуть виджет':'Компактный режим'} aria-pressed={compact} title={compact?'Вернуть выбор ламп, палитру, сцены и Peek':'Оставить только основные настройки света'} onClick={()=>setCompact(!compact)}><Icon kind={compact?'expand':'collapse'}/>{compact?'Развернуть':'Компактно'}</button><button aria-label="Поверх окон" aria-pressed={pinned} title={nativeShell?(pinned?'Отключить закрепление поверх окон':'Закрепить поверх других окон'):'Доступно в настольной версии'} disabled={!nativeShell} onClick={()=>void togglePinned()}><Icon kind="pin"/></button><button aria-label="Скрыть виджет в трей" disabled={!nativeShell} title={nativeShell?'Скрыть окно. Вернуть — щелчком по значку возле часов':'Скрытие в трей доступно в настольной версии; здесь окно открыто в браузере'} onClick={()=>void hideWidget().catch(e=>setNotice(message(e)))}><Icon kind="hide"/>Скрыть</button></div>
 <div className="compact-caption">Управление светом</div>
 <div className="widget-heading"><div className="widget-title"><Icon kind="lamp"/><h1>Мои лампы</h1></div><div className="heading-actions"><button className="power settings-power" disabled={mode==='loading'} title="Настройки ламп" aria-label="Настройки ламп" aria-expanded={settings} aria-controls="widget-settings" onClick={()=>setSettings(!settings)}><Icon kind="settings"/></button><button className="power" aria-label="Питание выбранных ламп" disabled={!ready.length||busy} onClick={()=>void apply(()=>({on:!ready.every(e=>e.snapshot!.state.on)}))}><Icon kind="power"/></button></div></div>
 <div className="tabs" role="tablist"><button role="tab" aria-selected={tab==='color'} className={tab==='color'?'active':''} onClick={()=>setTab('color')}><Icon kind="color"/><span>Цвет</span></button><button role="tab" aria-selected={tab==='effects'} className={tab==='effects'?'active':''} onClick={()=>setTab('effects')}><Icon kind="effects"/><span>Эффекты</span></button></div>
 <nav className="devices" aria-label="Выбор лампы"><button className={selection==='all'?'selected':''} onClick={()=>setSelection('all')}><Icon kind="link"/>Все лампы</button>{entries.map(e=><button key={e.device.id} className={selection===e.device.id?'selected':''} onClick={()=>setSelection(e.device.id)}><Icon kind="lamp"/><i className={e.error?'dot offline':'dot'}/>{e.device.name}</button>)}</nav>
 {loading&&!entries.length?<div className="empty" role="status"><Icon kind="lamp"/><h2>Подключаем лампы…</h2><p>Загружаем сохранённые адреса<br/>и проверяем соединение.</p></div>:!entries.length?<div className="empty"><Icon kind="lamp"/><h2>Добавьте первую лампу</h2><p>Введите её адрес в настройках.<br/>Нужен только WLED и локальная сеть.</p><button className="primary" onClick={()=>setSettings(true)}>＋ Добавить лампу</button></div>:<>
 {selected.some(e=>e.snapshot?.info.live)&&<div className="warning">На лампе активен внешний поток. Встроенные эффекты WLED могут быть перекрыты.</div>}
 <fieldset disabled={!ready.length||busy} className="controls"><div className="color-area"><div className="hue-wheel" ref={ring} onPointerDown={startWheel} onPointerMove={e=>{if(drag.current?.pointer===e.pointerId)wheel(e)}} onPointerUp={e=>finishWheel(e)} onPointerCancel={e=>finishWheel(e,true)} onLostPointerCapture={e=>{if(drag.current?.pointer===e.pointerId)finishWheel(e,true)}}><div className="wheel-inner"><label className="color-center" style={{background:color}} title="Выбрать цвет"><input aria-label="Цвет ламп" type="color" value={color} onChange={e=>{setColor(e.target.value);void apply(segmentPatch({fx:0,col:[rgb(e.target.value)]}))}}/></label></div><span className="wheel-marker" style={markerStyle}/></div><div className="brightness"><div className="slider-label"><label htmlFor="brightness">Яркость</label><span>{mixed?'Разная':`${brightness}%`}</span></div><input id="brightness" aria-label="Яркость" type="range" min="0" max="100" value={brightness} onChange={e=>setBrightness(+e.target.value)} onPointerUp={()=>void apply(()=>brightness===0?{on:false}:{on:true,bri:Math.round(brightness*255/100)})} onKeyUp={()=>void apply(()=>brightness===0?{on:false}:{on:true,bri:Math.round(brightness*255/100)})}/><div className="brightness-hints"><span>Тихое свечение</span><span>Ярко</span></div><div className="hex-field"><span>HEX</span><input aria-label="HEX цвет" value={color.toUpperCase()} maxLength={7} onChange={e=>{const value=e.target.value;if(/^#[0-9a-f]{0,6}$/i.test(value))setColor(value)}} onBlur={()=>{if(/^#[0-9a-f]{6}$/i.test(color))void apply(segmentPatch({fx:0,col:[rgb(color)]}));else if(segment)setColor(hex(segment.col[0].slice(0,3)))}}/></div></div></div>
 {tab==='color'?<div className="swatches" aria-label="Быстрые цвета">{['#00bbff','#7155ff','#ee58b6','#ff9e52','#ffdc71','#60e2a0'].map(c=><button key={c} aria-label={`Цвет ${c}`} style={{background:c}} onClick={()=>void apply(segmentPatch({fx:0,col:[rgb(c)]}))}/>)}</div>:<div className="effect-tip">Каталог загружен с выбранных WLED-устройств. Для группы показаны общие эффекты.</div>}
 <div className="effect-panel"><label className="effect-select">Эффект<EffectPicker label="Эффект" value={effect} options={effects} disabled={!ready.length||busy} onChange={name=>{void apply(entry=>({seg:[{id:entry.snapshot!.state.seg[0].id,fx:entry.snapshot!.effects.indexOf(name)}]}))}}/></label><label>Скорость<input aria-label="Скорость эффекта" disabled={effect==='Solid'} type="range" min="0" max="255" value={speed} onChange={e=>setSpeed(+e.target.value)} onPointerUp={()=>void apply(segmentPatch({sx:speed}))} onKeyUp={()=>void apply(segmentPatch({sx:speed}))}/></label><label>Интенсивность<input aria-label="Интенсивность эффекта" disabled={effect==='Solid'} type="range" min="0" max="255" value={intensity} onChange={e=>setIntensity(+e.target.value)} onPointerUp={()=>void apply(segmentPatch({ix:intensity}))} onKeyUp={()=>void apply(segmentPatch({ix:intensity}))}/></label></div>

 {tab==='effects'&&selection!=='all'&&first&&<div className="presets"><span>Пресеты на лампе</span>{Object.entries(first.presets).filter(([id])=>+id>0).map(([id,preset])=><button key={id} onClick={()=>void apply(()=>({ps:+id}))}>{preset.n||`Пресет ${id}`}</button>)}</div>}
 </fieldset><Scenes entries={entries} busy={busy} onApply={apply}/></>}
 <Peek suspended={compact} entries={entries} selection={selection} notice={loading?'Подключаем лампы…':notice} busy={busy}/>
 {compact&&<p className={loading||notice&&notice!=='Настройки применены'?'compact-target':'compact-target sr-only'} role="status">{loading?'Подключаем лампы…':notice||`${selection==='all'?`${selected.length} лампы`:selected[0]?.device.name||'Нет выбранной лампы'}`}</p>}
 </section>
 <aside id="widget-settings" className="side" role="dialog" aria-modal="true" aria-label="Настройки виджета" hidden={!settings}><div className="settings-heading"><h2>Настройки</h2><button aria-label="Закрыть настройки" onClick={()=>setSettings(false)}>×</button></div>
 <section className="settings"><div className="eyebrow">ПОДКЛЮЧЕНИЕ</div><h2>Ваш свет — ваши адреса</h2><p>Укажите IP-адрес или имя WLED в локальной сети.</p><form onSubmit={add}><label htmlFor="address">Адрес лампы</label><input id="address" placeholder="192.168.1.50 или lamp.local" value={address} onChange={e=>setAddress(e.target.value)} disabled={adding}/><button className="primary" disabled={adding||!address.trim()}>{adding?'Проверяем WLED…':'＋ Добавить лампу'}</button></form>{entries.map(e=><div className="device-record" key={e.device.id}><div><b>{e.device.name}</b><small>{e.error||`${e.snapshot?.info.leds.count??'…'} LED · WLED ${e.snapshot?.info.ver??'…'}`}</small></div><button aria-label={`Удалить ${e.device.name}`} onClick={()=>void remove(e.device.id)}>×</button></div>)}</section>
 <p className="privacy"><span>◎</span> Только ваша локальная сеть.<br/>Адреса не публикуются и не отправляются в облако.</p></aside></div>
 </main>
}
document.documentElement.dataset.shell=(window as unknown as {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__?'native':'preview';
createRoot(document.getElementById('root')!).render(<App/>);
