// Render the real interface against isolated local WLED fixtures, never personal devices.
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fixtureLamp} from '../tests/fixtures/peek-lamp.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const temp=await mkdtemp(join(tmpdir(),'wled-release-media-'));
const effects=['Solid','Blink','Breathe','Wipe','Wipe Random','Sweep','Dynamic','Colorloop','Rainbow','Scan','Fade','Theater','Running','Twinkle','Dissolve','Sparkle','Strobe','Android','Chase','Aurora','Stream','Scanner','Lighthouse','Fireworks','Rain','Gradient','Fairy','Lightning','Palette','Fire 2012','Colorwaves','Bpm','Lake','Meteor','Ripple','Candle','Sunrise','Flow','Washing Machine','TV Simulator','Soap','Pixels','Wavesins','Slow Transition'];
const pixels=Array.from({length:96},(_,i)=>{const h=i*6/96,x=1-Math.abs(h%2-1);return (h<1?[1,x,0]:h<2?[x,1,0]:h<3?[0,1,x]:h<4?[0,x,1]:h<5?[x,0,1]:[1,0,x]).map(v=>Math.round(v*255));});
const lamps=[await fixtureLamp('Лампа 1',pixels,{effects,presets:{7:{n:'Тёплый вечер'},8:{n:'Мягкий свет'}}}),await fixtureLamp('Лампа 2',[...pixels].reverse(),{effects,presets:{7:{n:'Тёплый вечер'},8:{n:'Мягкий свет'}}})];
let browser,server;
try{
 for(const lamp of lamps)await fetch('http://'+lamp.address+'/json/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({on:true,bri:191,seg:[{id:0,fx:8,col:[[0,187,255]],sx:128,ix:128}]})});
 server=spawn(process.execPath,['scripts/server.mjs'],{cwd:process.cwd(),env:{...process.env,WIDGET_PORT:'1427',WIDGET_PROFILE_FILE:join(temp,'devices.json')},stdio:['ignore','pipe','pipe']});
 let output='';server.stdout.on('data',x=>output+=x);server.stderr.on('data',x=>output+=x);
 for(let i=0;i<100&&!output.includes('loopback only');i++)await new Promise(r=>setTimeout(r,50));
 if(!output.includes('loopback only'))throw Error(output);
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:332,height:470},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:1427');await page.getByRole('button',{name:'Настройки ламп',exact:true}).click();
 for(const lamp of lamps){await page.getByLabel('Адрес лампы',{exact:true}).fill(lamp.address);await page.locator('form').getByRole('button',{name:'＋ Добавить лампу',exact:true}).click();await page.locator('.device-record').filter({hasText:'Лампа '+(lamps.indexOf(lamp)+1)}).waitFor();}
 await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.power-toggle')?.disabled===false);await page.waitForFunction(()=>document.querySelector('.effect-select button')?.textContent.includes('Rainbow'));
 await mkdir('docs/screenshots',{recursive:true});
 const panel=page.locator('.widget');
 await panel.screenshot({path:resolve('docs/screenshots/prototype-compact.png')});
 await panel.screenshot({path:resolve('docs/screenshots/prototype-demo.png')});
 await page.locator('.peek-edge[data-status="live"]').nth(1).waitFor();
 await panel.screenshot({path:resolve('docs/screenshots/prototype-peek.png')});
 await panel.screenshot({path:resolve('docs/screenshots/widget-full.png')});
 await page.getByRole('button',{name:'Компактный режим',exact:true}).click();
 await panel.screenshot({path:resolve('docs/screenshots/compact-controls.png')});
 await panel.screenshot({path:resolve('docs/screenshots/widget-mini.png')});
 await page.getByRole('button',{name:'Развернуть виджет',exact:true}).click();
 await page.getByRole('combobox',{name:'Эффект',exact:true}).click();
 await page.getByRole('listbox',{name:'Эффект: список',exact:true}).waitFor();
 await page.screenshot({path:resolve('docs/screenshots/effect-picker.png')});
 await page.getByRole('listbox',{name:'Эффект: список',exact:true}).press('Escape');
 await page.getByRole('button',{name:'Настроить Вечер',exact:true}).click();
 await page.getByRole('dialog',{name:'Настройка сценария Вечер',exact:true}).waitFor();
 await page.screenshot({path:resolve('docs/screenshots/scene-editor.png')});
 await page.getByRole('button',{name:'Закрыть сценарий',exact:true}).click();
 await page.evaluate(()=>{document.body.style.background='#f4f4f4';});
 await panel.screenshot({path:resolve('docs/screenshots/widget-light-background.png')});
 console.log('Captured six current UI images with two isolated WLED fixtures.');
}finally{await browser?.close();server?.kill();for(const lamp of lamps)await lamp.close();await rm(temp,{recursive:true,force:true});}
