import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import {resolve} from 'node:path';import {mkdir,copyFile,readdir,writeFile,readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
function run(file,args,cwd=root){const result=spawnSync(file,args,{cwd,stdio:'inherit',windowsHide:true});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
run(process.execPath,[resolve(root,'scripts/build-frontend.mjs')]);
run(process.execPath,[resolve(root,'node_modules/@tauri-apps/cli/tauri.js'),'build','--bundles','nsis','--','--locked'],resolve(root,'apps/desktop'));
const metadata=JSON.parse(await readFile(resolve(root,'apps/desktop/src/build-info.json'),'utf8'));
const dest=resolve(root,'release-local');await mkdir(dest,{recursive:true});
const source=resolve(root,'apps/desktop/src-tauri/target/release');
const installers=(await readdir(resolve(source,'bundle/nsis'))).filter(n=>n.endsWith('_'+metadata.version+'_x64-setup.exe'));
if(!installers.length)throw Error('Installer not produced');
for(const name of installers)await copyFile(resolve(source,'bundle/nsis',name),resolve(dest,name));
await copyFile(resolve(source,'wled-desk-widget.exe'),resolve(dest,'wled-desk-widget.exe'));
const canonical='wled-desk-widget-'+metadata.version+'-x64-setup.exe';await copyFile(resolve(dest,installers[0]),resolve(dest,canonical));
await copyFile(resolve(root,'apps/desktop/src/build-info.json'),resolve(dest,'build-info.json'));
const sums=[];for(const name of [...installers,canonical,'wled-desk-widget.exe','build-info.json'])sums.push(createHash('sha256').update(await readFile(resolve(dest,name))).digest('hex')+'  '+name);
await writeFile(resolve(dest,'SHA256SUMS.txt'),sums.join('\n')+'\n');console.log('Windows artifacts: '+dest);
