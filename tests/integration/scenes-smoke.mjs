import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {fixtureLamp} from '../fixtures/peek-lamp.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const temp=await mkdtemp(join(tmpdir(),'widget-scenes-ui-')),root=process.cwd();
const lamp1=await fixtureLamp('Lamp A',[[0,0,0]],{effects:['Solid','Rainbow','Breathe'],presets:{'3':{n:'Warm'}}});
const lamp2=await fixtureLamp('Lamp B',[[0,0,0]],{effects:['Solid','Breathe','Rainbow'],presets:{'7':{n:'Evening B'}}});
let browser,server;
async function start(){server=spawn(process.execPath,['scripts/server.mjs'],{cwd:root,env:{...process.env,WIDGET_PORT:'1425',WIDGET_PROFILE_FILE:join(temp,'devices.json')},stdio:['ignore','pipe','pipe']});let out='';server.stdout.on('data',v=>out+=v);server.stderr.on('data',v=>out+=v);for(let i=0;i<100&&!out.includes('loopback only');i++)await new Promise(r=>setTimeout(r,50));assert.match(out,/loopback only/);}
try{
 await start();browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:332,height:470}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:1425');await page.getByRole('button',{name:'Настройки ламп',exact:true}).click();await page.getByRole('button',{name:'Мои лампы',exact:true}).click();
 for(const lamp of [lamp1,lamp2]){await page.getByLabel('Адрес лампы',{exact:true}).fill(lamp.address);await page.locator('form').getByRole('button',{name:'＋ Добавить лампу',exact:true}).click();await page.waitForFunction(count=>document.querySelectorAll('.devices .dot').length===count,lamp===lamp1?1:2);}
 await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
 await page.getByRole('button',{name:'Настроить Работа',exact:true}).click();
 await page.getByLabel('HEX сценария Lamp A').fill('#112233');await page.getByLabel('Эффект сценария Lamp A').selectOption('Rainbow');
 await page.getByLabel('Яркость сценария Lamp A').press('End');await page.getByLabel('Скорость сценария Lamp A').press('End');await page.getByLabel('Интенсивность сценария Lamp A').press('Home');
 await page.getByLabel('Источник Lamp B').selectOption('preset');await page.getByLabel('Пресет Lamp B').selectOption('7');
 await mkdir(resolve(root,'docs/screenshots'),{recursive:true});await page.locator('.scene-editor').evaluate(e=>e.scrollTop=0);await page.evaluate(()=>document.activeElement?.blur());await page.screenshot({path:resolve(root,'docs/screenshots/scene-editor.png'),fullPage:true});
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.getByRole('dialog',{name:'Настройка сценария Работа'}).waitFor({state:'hidden'});
 assert.equal(lamp1.patches.length+lamp2.patches.length,0,'Saving must not change lights');
 const data=JSON.parse(await readFile(join(temp,'scenes.json'),'utf8'));assert.equal(data.scenes[0].targets.length,2);
 // Restart the backend as well as the page: assignments must come back from disk.
 await new Promise(resolve=>{server.once('exit',resolve);server.kill();});await start();await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.devices .dot').length===2);
 await page.getByRole('button',{name:'Работа',exact:true}).click();await page.locator('.widget-status').filter({hasText:'Настройки применены'}).waitFor();
 assert.deepEqual(lamp1.patches[0],{on:true,bri:255,seg:[{id:0,fx:1,col:[[17,34,51]],sx:255,ix:0}]});assert.deepEqual(lamp2.patches[0],{ps:7});
 await page.getByRole('button',{name:'Настроить Вечер',exact:true}).click();for(const name of ['Lamp A','Lamp B'])await page.getByLabel('Эффект сценария '+name).selectOption('Rainbow');
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.getByRole('dialog',{name:'Настройка сценария Вечер'}).waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Вечер',exact:true}).click();await page.locator('.widget-status').filter({hasText:'Настройки применены'}).waitFor();
 assert.equal(lamp1.patches.at(-1).seg[0].fx,1);assert.equal(lamp2.patches.at(-1).seg[0].fx,2,'Resolve effect by name for each firmware');
 const devices=JSON.parse(await readFile(join(temp,'devices.json'),'utf8')).devices;const b=devices.find(d=>d.name==='Lamp B');
 await page.route('**/api/devices/'+b.id+'/state',route=>route.fulfill({status:400,contentType:'application/json',body:'{"error":"Fixture offline"}'}));
 const count=lamp1.patches.length;await page.getByRole('button',{name:'Работа',exact:true}).click();await page.locator('.widget-status').filter({hasText:'Lamp B'}).waitFor();assert.equal(lamp1.patches.length,count+1,'One failed target does not stop the other');
 await page.getByRole('button',{name:'Настроить Кино',exact:true}).click();await page.getByRole('button',{name:'Закрыть сценарий'}).click();assert.equal(JSON.parse(await readFile(join(temp,'scenes.json'),'utf8')).scenes.length,2,'Cancel does not save');
 const invalid=await fetch('http://127.0.0.1:1425/api/scenes',{method:'POST',headers:{Origin:'http://127.0.0.1:1425','Content-Type':'application/json'},body:JSON.stringify({slot:'work',targets:[{deviceId:b.id,action:{kind:'preset',presetId:251}}]})});assert.equal(invalid.status,400);
 assert.deepEqual(errors,[]);console.log('Scene UI passed: mixed preset/custom, no writes on save, restart persistence, per-device effect IDs, partial errors, cancel and validation.');
}finally{await browser?.close();server?.kill();await lamp1.close();await lamp2.close();await rm(temp,{recursive:true,force:true});}
