import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {fixtureLamp} from '../fixtures/peek-lamp.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');const temp=await mkdtemp(join(tmpdir(),'wled-alpha-')),lamp=await fixtureLamp('Lamp A',[[255,120,0],[128,64,0],[0,0,0],[0,190,255]],{dropFirstPeek:true,rearmAfterPower:true});let browser,server;
try{
 await writeFile(join(temp,'devices.json'),JSON.stringify({schemaVersion:1,devices:[{id:'a',name:'Lamp A',address:'http://'+lamp.address}]}));server=spawn(process.execPath,['scripts/server.mjs'],{env:{...process.env,WIDGET_PORT:'1447',WIDGET_PROFILE_FILE:join(temp,'devices.json')},stdio:['ignore','pipe','pipe']});let output='';server.stdout.on('data',v=>output+=v);for(let i=0;i<100&&!output.includes('loopback only');i++)await new Promise(r=>setTimeout(r,40));assert.match(output,/loopback only/);
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:1447');await page.locator('.peek-edge[data-status="live"]').nth(1).waitFor({timeout:15000});
 assert.equal(lamp.commands.filter(c=>c.lv===true).length,2,'Startup stall recovers without changing selection');
 assert.equal(await page.locator('.peek-note').count(),0,'No technical Peek messages on the widget');
 const pixels=()=>page.locator('.peek-left').evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,1,c.height).data));
 let values=await pixels();assert.equal(values[3],255);assert.ok(Math.abs(values[7]-128)<=1,'Dim LED has partial alpha');assert.deepEqual(values.slice(8,12),[0,0,0,0],'Black LED is transparent');assert.equal(values[15],255);
 lamp.setColors([[0,0,0],[0,0,0],[0,0,0],[0,0,0]]);await page.waitForFunction(()=>Array.from(document.querySelector('.peek-left').getContext('2d').getImageData(0,0,1,4).data).every(v=>v===0));
 assert.equal(await page.locator('.peek-left').evaluate(e=>getComputedStyle(e).boxShadow),'none','No shadow marks an unlit strip');
 lamp.setColors([[255,120,0],[128,64,0],[0,0,0],[0,190,255]]);await page.waitForFunction(()=>document.querySelector('.peek-left').getContext('2d').getImageData(0,0,1,1).data[3]===255);
 lamp.external({on:false});await page.waitForFunction(()=>Array.from(document.querySelector('.peek-left').getContext('2d').getImageData(0,0,1,document.querySelector('.peek-left').height).data).every(v=>v===0));
 await page.waitForTimeout(100);const beforePower=lamp.commands.length;lamp.external({on:true});await page.waitForFunction(()=>document.querySelector('.peek-left').getContext('2d').getImageData(0,0,1,1).data[3]===255);
 assert.ok(lamp.commands.length>beforePower,'Power-on renews the Peek subscription');
 lamp.pause(true);await page.locator('.peek-left[data-status="stalled"]').waitFor({timeout:9000});assert.ok((await pixels()).every(v=>v===0),'Stale frames clear instead of retaining color');
 await page.waitForTimeout(20500);const attempts=lamp.commands.length;await page.waitForTimeout(7000);assert.equal(lamp.commands.length,attempts,'Retries stop instead of repeatedly reclaiming another client stream');
 assert.equal(await page.locator('.peek-note').count(),0);
 assert.equal(lamp.patches.length,0,'Rendering never changes lighting');console.log('Peek recovery passed: startup retry, power-on rearm, bounded retries, silent status; vivid/dim/black pixels, previous-frame clearing, off/on, transparent stale data and no lamp writes.');
}finally{await browser?.close();server?.kill();await lamp.close();await rm(temp,{recursive:true,force:true});}
