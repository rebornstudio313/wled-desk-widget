import {readFile,writeFile,mkdir,rename,copyFile} from 'node:fs/promises';
import {dirname} from 'node:path';
const slots=new Set(['work','evening','cinema']);
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>allowed.includes(k));
export function validateScene(scene,devices){
 if(!keys(scene,['slot','targets'])||!slots.has(scene.slot)||!Array.isArray(scene.targets)||scene.targets.length>64)throw Error('Неверный сценарий');
 const seen=new Set();
 for(const target of scene.targets){
  if(!keys(target,['deviceId','action'])||typeof target.deviceId!=='string'||!target.deviceId||target.deviceId.length>100||seen.has(target.deviceId))throw Error('Неверный список ламп');
  if(devices&&!devices.some(d=>d.id===target.deviceId))throw Error('Лампа удалена. Уберите её из сценария');
  seen.add(target.deviceId);const a=target.action;
  if(a?.kind==='preset'){
   if(!keys(a,['kind','presetId'])||!integer(a.presetId,1,250))throw Error('Неверный пресет');
  }else if(a?.kind==='custom'){
   if(!keys(a,['kind','on','bri','color','effect','speed','intensity'])||typeof a.on!=='boolean'||!integer(a.bri,1,255)||!/^#[0-9a-f]{6}$/i.test(a.color)||typeof a.effect!=='string'||!a.effect.trim()||a.effect.length>100||!integer(a.speed,0,255)||!integer(a.intensity,0,255))throw Error('Проверьте параметры сценария');
  }else throw Error('Выберите пресет или свои параметры');
 }
 return structuredClone(scene);
}
export async function loadScenes(file){
 try{const data=JSON.parse(await readFile(file,'utf8'));if(data.schemaVersion!==1||!Array.isArray(data.scenes)||data.scenes.length>3)throw Error('Неверный файл сценариев');const scenes=data.scenes.map(s=>validateScene(s));if(new Set(scenes.map(s=>s.slot)).size!==scenes.length)throw Error('Повтор сценария');return scenes;}catch(e){if(e.code==='ENOENT')return [];throw e;}
}
export async function saveScenes(file,scenes){
 await mkdir(dirname(file),{recursive:true});
 await writeFile(file+'.tmp',JSON.stringify({schemaVersion:1,scenes},null,2));
 try{await copyFile(file,file+'.bak')}catch(e){if(e.code!=='ENOENT')throw e;}
 await rename(file+'.tmp',file);
}
