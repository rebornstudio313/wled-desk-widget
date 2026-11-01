import http from 'node:http';
import {checkUpdates} from './updates.mjs';
import {discoverWled} from './discovery.mjs';
import {createStateHub} from './state-hub.mjs';
import {loadScenes,saveScenes,validateScene} from './scenes.mjs';
import {backendRevision} from './preview-version.mjs';
import {createPeekHub} from './peek.mjs';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {normalizeAddress,snapshot,request,validatePatch,createQueue} from './wled.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.WIDGET_PORT||1421);
const profileFile=process.env.WIDGET_PROFILE_FILE||resolve(root,'.local','preview-devices.json');
const buildInfo=JSON.parse(await readFile(resolve(root,'apps/desktop/src/build-info.json'),'utf8'));
let devices=[];try{const saved=JSON.parse(await readFile(profileFile,'utf8'));if(saved.schemaVersion!==1||!Array.isArray(saved.devices))throw Error('Неверная версия профиля');devices=saved.devices;for(const d of devices)normalizeAddress(d.address);}catch(e){if(e.code!=='ENOENT')throw e;}
async function save(){await mkdir(dirname(profileFile),{recursive:true});await writeFile(profileFile+'.tmp',JSON.stringify({schemaVersion:1,devices},null,2));await rename(profileFile+'.tmp',profileFile);}
const sceneFile=resolve(dirname(profileFile),'scenes.json');
let scenes=await loadScenes(sceneFile);
const syncFile=resolve(dirname(profileFile),'sync-targets.json');
let syncTargets={};try{syncTargets=JSON.parse(await readFile(syncFile,'utf8'));if(!syncTargets||Array.isArray(syncTargets)||typeof syncTargets!=='object')throw Error('Неверные настройки синхронизации');}catch(e){if(e.code!=='ENOENT')throw e;}
async function pruneReferences(){const ids=new Set(devices.map(d=>d.id));const next=scenes.map(scene=>({...scene,targets:scene.targets.filter(t=>ids.has(t.deviceId))}));if(JSON.stringify(next)!==JSON.stringify(scenes)){await saveScenes(sceneFile,next);scenes=next;}const groups=Object.fromEntries(Object.entries(syncTargets).filter(([source])=>ids.has(source)).map(([source,targets])=>[source,targets.filter(id=>ids.has(id))]));if(JSON.stringify(groups)!==JSON.stringify(syncTargets)){await writeFile(syncFile+'.tmp',JSON.stringify(groups,null,2));await rename(syncFile+'.tmp',syncFile);syncTargets=groups;}}
await pruneReferences();
const queue=createQueue();
const peek=createPeekHub();
let discovery=null;
const stateHub=createStateHub();
const revision=await backendRevision();
const server=http.createServer(async(req,res)=>{const path=new URL(req.url,'http://127.0.0.1').pathname;res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value??null));};
 try{
 if(path==='/api/health'&&req.method==='GET')return json({app:'widget-led-rgb',version:buildInfo.version,buildId:buildInfo.buildId,backendRevision:revision,capabilities:['peek','scenes']});
 if(path.startsWith('/api/')){
  const allowed=new Set(['http://127.0.0.1:1420','http://localhost:1420','http://127.0.0.1:'+port]);
  if(req.method!=='GET'&&(!allowed.has(req.headers.origin)||req.headers['content-type']!=='application/json'))return json({error:'Запрос из недоверенного источника'},403);
  let body={};if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>65536)throw Error('Слишком большой запрос')}body=JSON.parse(raw||'{}');}
  if(path==='/api/sync-targets'&&req.method==='GET')return json(syncTargets);
  if(path==='/api/sync-targets'&&req.method==='POST')return await queue('profile',async()=>{
   const {source,targets}=body;if(typeof source!=='string'||!devices.some(d=>d.id===source)||!Array.isArray(targets)||new Set(targets).size!==targets.length||targets.some(id=>typeof id!=='string'||id===source||!devices.some(d=>d.id===id)))throw Error('Неверный выбор ламп');
   const next={...syncTargets,[source]:targets};await mkdir(dirname(syncFile),{recursive:true});await writeFile(syncFile+'.tmp',JSON.stringify(next,null,2));try{await writeFile(syncFile+'.bak',await readFile(syncFile));}catch(e){if(e.code!=='ENOENT')throw e;}await rename(syncFile+'.tmp',syncFile);syncTargets=next;return json({source,targets});
  });
  if(path==='/api/scenes'&&req.method==='GET')return json(scenes);
  if(path==='/api/scenes'&&req.method==='POST')return await queue('profile',async()=>{const scene=validateScene(body,devices);const next=[...scenes.filter(s=>s.slot!==scene.slot),scene];await saveScenes(sceneFile,next);scenes=next;json(scene);});
  if(path==='/api/updates'&&req.method==='POST')return json(await checkUpdates(buildInfo.version));
  if(path==='/api/discovery'&&req.method==='POST'){if(!discovery)discovery=discoverWled([...devices]).finally(()=>{discovery=null});return json(await discovery);}
  if(path==='/api/devices'&&req.method==='GET')return json(devices);
  if(path==='/api/devices'&&req.method==='POST')return await queue('profile',async()=>{const address=normalizeAddress(body.address);const data=await snapshot(address);if(devices.some(d=>d.address===address||data.info.mac&&d.identity===data.info.mac))throw Error('Эта лампа уже добавлена');const device={id:randomUUID(),name:data.info.name||'WLED',address,identity:data.info.mac};devices.push(device);try{await save()}catch(e){devices.pop();throw e}json(device);});
  const nameMatch=path.match(/^\/api\/devices\/([\w-]+)\/name$/);
  if(nameMatch&&req.method==='POST')return await queue('profile',async()=>{
   const name=typeof body.name==='string'?body.name.trim():'';if(!name||[...name].length>48||/[\x00-\x1f\x7f-\x9f]/.test(name))throw Error('Название должно содержать от 1 до 48 символов');
   const device=devices.find(d=>d.id===nameMatch[1]);if(!device)return json({error:'Лампа не найдена'},404);
   const before=devices,renamed={...device,name};devices=devices.map(d=>d.id===device.id?renamed:d);try{await save()}catch(e){devices=before;throw e}json(renamed);
  });
  const paletteMatch=path.match(/^\/api\/devices\/([\w-]+)\/palettes$/);if(paletteMatch&&req.method==='GET'){const d=devices.find(v=>v.id===paletteMatch[1]);if(!d)return json({error:'Лампа не найдена'},404);const previews={};for(let page=0;page<64;page++){const v=await request(d.address,'/json/palx?page='+page);if(!v.p||typeof v.p!=='object')break;for(const [id,colors]of Object.entries(v.p))if(/^\d+$/.test(id)&&+id<=255)previews[id]=colors;if(page>=Math.min(Number(v.m)||0,63))break;}return json(previews);}
  const stateMatch=path.match(/^\/api\/devices\/([\w-]+)\/events$/);
  if(stateMatch&&req.method==='GET'){
   if(!allowed.has(req.headers.origin)&&req.headers['sec-fetch-site']!=='same-origin')return json({error:'Недоверенный источник'},403);
   const device=devices.find(d=>d.id===stateMatch[1]);if(!device)return json({error:'Лампа не найдена'},404);
   res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8'});res.flushHeaders();
   const stop=stateHub.subscribe(device,(type,value)=>{if(!res.destroyed&&res.writableLength<524288)res.write(`event: ${type}\ndata: ${JSON.stringify(value)}\n\n`);});
   const timer=setInterval(()=>{if(!devices.some(d=>d.id===device.id))res.end();else if(!res.destroyed)res.write(': keepalive\n\n');},15000);
   res.on('close',()=>{clearInterval(timer);stop();});return;
  }
  const peekMatch=path.match(/^\/api\/devices\/([\w-]+)\/peek$/);
  if(peekMatch&&req.method==='GET'){
   if(!allowed.has(req.headers.origin)&&req.headers['sec-fetch-site']!=='same-origin')return json({error:'Недоверенный источник Peek'},403);
   const device=devices.find(d=>d.id===peekMatch[1]);if(!device)return json({error:'Лампа не найдена'},404);
   res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','X-Accel-Buffering':'no'});res.flushHeaders();
   const send=(type,value)=>{if(!res.destroyed&&res.writableLength<131072)res.write(`event: ${type}\ndata: ${JSON.stringify(value)}\n\n`);};
   const release=peek.subscribe(device,send);
   const heartbeat=setInterval(()=>{if(!devices.some(d=>d.id===device.id)){res.end();return;}if(!res.destroyed)res.write(': keepalive\n\n');},15000);
   res.on('close',()=>{clearInterval(heartbeat);release();});return;
  }
  const match=path.match(/^\/api\/devices\/([\w-]+)(\/state)?$/);if(!match)return json({error:'Не найдено'},404);const device=devices.find(d=>d.id===match[1]);if(!device)return json({error:'Лампа не найдена'},404);
  if(req.method==='GET'&&!match[2])return json(await snapshot(device.address));
  if(req.method==='DELETE'&&!match[2])return await queue('profile',async()=>{const before=devices;devices=devices.filter(d=>d.id!==device.id);try{await save()}catch(e){devices=before;throw e}await pruneReferences();json(null);});
  if(req.method==='POST'&&match[2]){const patch=validatePatch(body);return await queue(device.id,async()=>{const ack=await request(device.address,'/json/state',patch);if(ack.success===false||ack.error)throw Error('WLED отклонил команду');json(await snapshot(device.address));});}
  return json({error:'Метод не поддерживается'},405);
 }
 if(req.method!=='GET')return json({error:'Метод не поддерживается'},405);
 const relative=path==='/'?'index.html':decodeURIComponent(path).replace(/^\//,'');const file=resolve(root,'dist',relative);if(!file.startsWith(resolve(root,'dist')+sep))return json({error:'Not found'},404);
 const data=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"});res.end(data);
 }catch(e){json({error:e.code==='ENOENT'?'Сначала выполните pnpm build':e.message},e.code==='ENOENT'?404:400);}
});server.listen(port,'127.0.0.1',()=>console.log(`Widget LED RGB preview: http://127.0.0.1:${port} (loopback only)`));
