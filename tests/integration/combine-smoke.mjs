import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {fixtureLamp} from '../fixtures/peek-lamp.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const temp=await mkdtemp(join(tmpdir(),'wled-combine-'));
const a=await fixtureLamp('Lamp A',[[1,2,3]],{effects:['Solid','Rainbow','Breathe'],presets:{7:{n:'Only A'}}});
const b=await fixtureLamp('Lamp B',[[4,5,6]],{effects:['Solid','Breathe','Rainbow'],presets:{9:{n:'Only B'}}});
let browser,server;
try{
 await writeFile(join(temp,'devices.json'),JSON.stringify({schemaVersion:1,devices:[{id:'a',name:'Lamp A',address:'http://'+a.address},{id:'b',name:'Lamp B',address:'http://'+b.address}]}));
 server=spawn(process.execPath,['scripts/server.mjs'],{env:{...process.env,WIDGET_PORT:'1428',WIDGET_PROFILE_FILE:join(temp,'devices.json')},stdio:['ignore','pipe','pipe']});let output='';server.stdout.on('data',v=>output+=v);server.stderr.on('data',v=>output+=v);
 for(let i=0;i<100&&!output.includes('loopback only');i++)await new Promise(r=>setTimeout(r,40));assert.match(output,/loopback only/);
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:1428');
 await page.waitForFunction(()=>document.querySelectorAll('.devices .connection-dot.online').length===2);
 assert.equal(a.patches.length+b.patches.length,0,'Startup does not copy');
 async function seed(lamp,state){await fetch('http://'+lamp.address+'/json/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});lamp.patches.length=0;}
 await seed(a,{on:true,bri:77,seg:[{id:0,fx:1,sx:23,ix:45,col:[[12,34,56]]}]});
 await page.locator('.devices').getByRole('button',{name:'Lamp A',exact:true}).click();await page.getByRole('button',{name:'Only A',exact:true}).waitFor();
 await page.locator('.devices').getByRole('button',{name:'Все лампы',exact:true}).click();await page.getByRole('status').filter({hasText:'Настройки применены'}).waitFor();
 assert.deepEqual(b.patches.at(-1),{on:true,bri:77,seg:[{id:0,col:[[12,34,56]],fx:2,sx:23,ix:45}]});assert.equal(a.patches.length,0,'Source not changed');assert.ok(!('ps' in b.patches.at(-1)),'No foreign preset number');
 const writes=b.patches.length;await page.locator('.devices').getByRole('button',{name:'Все лампы',exact:true}).click();assert.equal(b.patches.length,writes,'Repeated group selection is read-only');
 await seed(b,{on:false,bri:130,seg:[{id:0,fx:1,sx:88,ix:99,col:[[80,70,60]]}]});
 await page.locator('.devices').getByRole('button',{name:'Lamp B',exact:true}).click();await page.getByRole('button',{name:'Only B',exact:true}).waitFor();
 await page.locator('.devices').getByRole('button',{name:'Все лампы',exact:true}).click();await page.getByRole('status').filter({hasText:'Настройки применены'}).waitFor();
 assert.deepEqual(a.patches.at(-1),{on:false,bri:130,seg:[{id:0,col:[[80,70,60]],fx:2,sx:88,ix:99}]});assert.equal(b.patches.length,0);
 await page.locator('.devices').getByRole('button',{name:'Lamp A',exact:true}).click();const before=b.patches.length;
 await page.route('**/api/devices/a',route=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Source offline'})}));
 await page.locator('.devices').getByRole('button',{name:'Все лампы',exact:true}).click();await page.getByRole('status').filter({hasText:'Source offline'}).waitFor();assert.equal(b.patches.length,before,'Offline source never writes targets');
 console.log('Combine passed: fresh source state, both directions, different effect IDs, absent target preset, no source writes, no startup/repeated writes, offline source.');
}finally{await browser?.close();server?.kill();await a.close();await b.close();await rm(temp,{recursive:true,force:true});}
