import {readFile,readdir,writeFile} from 'node:fs/promises';import {resolve,relative} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));const manifest=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')),version=manifest.version;
const config=JSON.parse(await readFile(resolve(root,'apps/desktop/src-tauri/tauri.conf.json'),'utf8')),cargo=await readFile(resolve(root,'apps/desktop/src-tauri/Cargo.toml'),'utf8');
if(config.version!==version||cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1]!==version)throw Error('Version mismatch: package.json, Cargo.toml and tauri.conf.json must agree');
const paths=[];async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())await walk(path);else if(entry.isFile()&&entry.name!=='build-info.json')paths.push(path);}}
for(const folder of ['apps/desktop/src','apps/desktop/src-tauri/src','apps/desktop/src-tauri/installer','packages/domain/src','scripts'])await walk(resolve(root,folder));
for(const file of ['package.json','pnpm-lock.yaml','tsconfig.json','vite.config.ts','apps/desktop/src-tauri/Cargo.toml','apps/desktop/src-tauri/Cargo.lock','apps/desktop/src-tauri/tauri.conf.json','apps/desktop/src-tauri/build.rs'])paths.push(resolve(root,file));
const hash=createHash('sha256');for(const path of paths.sort()){hash.update(relative(root,path).replaceAll('\\','/')).update('\0').update(await readFile(path)).update('\0');}
const builtAt=new Date().toISOString(),sourceHash=hash.digest('hex'),buildId=builtAt.replace(/[-:.]/g,'')+'-'+sourceHash.slice(0,8);
await writeFile(resolve(root,'apps/desktop/src/build-info.json'),JSON.stringify({version,buildId,builtAt,sourceHash},null,2)+'\n');console.log('Build '+version+' · '+buildId);
