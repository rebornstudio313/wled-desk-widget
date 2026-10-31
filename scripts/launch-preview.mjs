import {spawn,spawnSync} from 'node:child_process';
import {backendRevision} from './preview-version.mjs';
import {existsSync, mkdirSync, openSync, closeSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const base='http://127.0.0.1:1421';
const expectedRevision=await backendRevision();
if(!existsSync(resolve(root,'dist/index.html')))throw Error('Сначала выполните pnpm install и pnpm build.');
async function health(){
 try { const response=await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)}); const value=await response.json();if(value.app!=='widget-led-rgb')throw Error('Порт 1421 занят другим приложением');return {current:value.backendRevision===expectedRevision}; }
 catch(error){if(error.message.includes('Порт'))throw error;if(error.cause?.code==='ECONNREFUSED'||error.name==='TimeoutError')return false;throw error;}
}

function stopOutdatedPreview(){
 if(process.platform!=='win32')throw Error('Перезапустите локальный preview backend после обновления исходников.');
 // Kill only our exact Node executable + absolute server script on our loopback port.
 // Paths are environment values, never interpolated into PowerShell source.
 const script=String.raw`
$ErrorActionPreference='Stop'
$listener=Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 1421 -State Listen -ErrorAction Stop
$owned=Get-CimInstance Win32_Process -Filter ('ProcessId='+$listener.OwningProcess)
$expectedScript=[IO.Path]::GetFullPath($env:WIDGET_SERVER_PATH)
$expectedNode=[IO.Path]::GetFullPath($env:WIDGET_NODE_PATH)
$unquoted=$expectedNode+' "'+$expectedScript+'"'
$quoted='"'+$expectedNode+'" "'+$expectedScript+'"'
if($owned.ExecutablePath -ine $expectedNode -or ($owned.CommandLine.Trim() -ine $unquoted -and $owned.CommandLine.Trim() -ine $quoted)){throw 'Процесс на порту 1421 не подтверждён как сервер этого проекта; остановка отменена.'}
Stop-Process -Id $owned.ProcessId -ErrorAction Stop
`;
 const stopped=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,encoding:'utf8',env:{...process.env,WIDGET_SERVER_PATH:resolve(root,'scripts/server.mjs'),WIDGET_NODE_PATH:process.execPath}});
 if(stopped.error||stopped.status!==0)throw Error('Не удалось безопасно перезапустить preview. '+(stopped.error?.message||stopped.stderr));
 console.log('Restarted outdated Widget LED RGB backend.');
}
const running=await health();
if(running&&!running.current)stopOutdatedPreview();
if(!running||!running.current){
 mkdirSync(resolve(root,'.local'),{recursive:true});
 const out=openSync(resolve(root,'.local/preview.log'),'a');
 const err=openSync(resolve(root,'.local/preview-error.log'),'a');
 const server=spawn(process.execPath,[resolve(root,'scripts/server.mjs')],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',out,err]});server.unref();closeSync(out);closeSync(err);
 let ready=false;for(let i=0;i<25;i++){await new Promise(r=>setTimeout(r,200));if((await health())?.current){ready=true;break;}}
 if(!ready)throw Error('Не удалось запустить preview; проверьте .local/preview-error.log');
}
const browsers=[resolve(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),resolve(process.env.ProgramFiles||'C:/Program Files','Microsoft/Edge/Application/msedge.exe')];
const edge=browsers.find(existsSync);
const browser=edge?spawn(edge,['--app='+base,'--window-size=350,470'],{detached:true,stdio:'ignore'}):spawn('explorer.exe',[base],{detached:true,stdio:'ignore'});
browser.unref();console.log('Widget LED RGB preview: '+base);
