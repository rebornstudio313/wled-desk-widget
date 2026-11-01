import {useEffect,useId,useRef,useState} from 'react';
export function LampName({name,disabled,onSave}:{name:string;disabled:boolean;onSave:(name:string)=>Promise<void>}){
 const hintId=useId();
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(name),[saving,setSaving]=useState(false),[error,setError]=useState('');const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(editing){input.current?.focus();input.current?.select();}},[editing]);
 async function save(event:React.FormEvent){event.preventDefault();const value=draft.trim();if(!value||[...value].length>48||/[\x00-\x1f\x7f-\x9f]/.test(value)){setError('Введите название: от 1 до 48 символов');return;}if(value===name){setEditing(false);return;}setSaving(true);setError('');try{await onSave(value);setEditing(false);}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить название');}finally{setSaving(false);}}
 if(!editing)return <span className="lamp-name-wrap"><button className="lamp-name" type="button" disabled={disabled} aria-describedby={hintId} aria-label={`Переименовать ${name}`} onClick={()=>{setDraft(name);setError('');setEditing(true);}}>{name}</button><span id={hintId} className="lamp-name-hint" role="tooltip">Нажмите, чтобы изменить имя</span></span>;
 return <form className="lamp-name-form" onSubmit={save} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();if(!saving)setEditing(false);}}}>
 <input ref={input} aria-label="Название лампы" value={draft} disabled={saving} onChange={e=>{setDraft(e.target.value);setError('');}} placeholder="Например, Лампа на столе"/>
 <div><button type="submit" disabled={saving}>{saving?'Сохраняем…':'Сохранить'}</button><button type="button" disabled={saving} onClick={()=>setEditing(false)}>Отмена</button></div>
 {error&&<span role="alert">{error}</span>}
 </form>;
}
