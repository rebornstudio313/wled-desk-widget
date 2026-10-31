import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm,mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {fixtureLamp} from '../fixtures/peek-lamp.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const temp=await mkdtemp(join(tmpdir(),'widget-compact-')),lamp=await fixtureLamp('Lamp A',[[255,0,0],[0,255,0]]);let browser,server;
const until=async(f)=>{for(let i=0;i<100;i++){if(f())return;await new Promise(r=>setTimeout(r,40));}assert.ok(f());};
try{
 server=spawn(process.execPath,['scripts/server.mjs'],{cwd:process.cwd(),env:{...process.env,WIDGET_PORT:'1426',WIDGET_PROFILE_FILE:join(temp,'devices.json')},stdio:['ignore','pipe','pipe']});let output='';server.stdout.on('data',v=>output+=v);server.stderr.on('data',v=>output+=v);await until(()=>output.includes('loopback only'));
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:332,height:470}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:1426');await page.getByRole('button',{name:'Настройки ламп',exact:true}).click();await page.getByRole('button',{name:'Мои лампы',exact:true}).click();await page.getByLabel('Адрес лампы',{exact:true}).fill(lamp.address);await page.locator('form').getByRole('button',{name:'＋ Добавить лампу',exact:true}).click();await page.locator('.devices .dot').waitFor();await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
 await page.getByRole('button',{name:'Предпросмотр ленты Peek'}).click();await page.locator('.peek-edge[data-status="live"]').nth(1).waitFor();
 const full=await page.locator('.widget').boundingBox();await page.getByRole('button',{name:'Компактный режим',exact:true}).click();
 await until(()=>lamp.sockets.size===0);
 assert.ok(await page.locator('.devices').isHidden());assert.ok(await page.locator('.hue-wheel').isVisible());const ringBox=await page.locator('.hue-wheel').boundingBox(),brightnessBox=await page.locator('.brightness').boundingBox();assert.ok(ringBox.width<=55&&ringBox.x+ringBox.width<brightnessBox.x);assert.ok(await page.locator('.scenes').isHidden());assert.equal(await page.locator('.peek-edge').count(),0);
 for(const name of ['Яркость','HEX цвет','Эффект','Скорость эффекта','Интенсивность эффекта'])assert.ok(await page.getByLabel(name,{exact:true}).isVisible());
 assert.ok(await page.getByRole('button',{name:'Питание выбранных ламп'}).isVisible());assert.ok(await page.getByRole('button',{name:'Настройки ламп',exact:true}).isVisible());
 await page.getByLabel('HEX цвет',{exact:true}).fill('#224466');await page.getByLabel('HEX цвет',{exact:true}).press('Tab');await page.locator('.compact-target').filter({hasText:'Настройки применены'}).waitFor({state:'attached'});assert.deepEqual(lamp.patches.at(-1).seg[0].col,[[34,68,102]]);
 const miniRing=await page.locator('.hue-wheel').boundingBox();const beforeWheel=lamp.patches.length;
 await page.mouse.click(miniRing.x+miniRing.width-6.5,miniRing.y+miniRing.height/2);
 await until(()=>lamp.patches.length>beforeWheel);assert.deepEqual(lamp.patches.at(-1).seg[0].col,[[0,255,255]],'Small wheel sends its selected color');
 await page.getByLabel('Эффект',{exact:true}).selectOption('Rainbow');await page.locator('.compact-target').filter({hasText:'Настройки применены'}).waitFor({state:'attached'});assert.equal(lamp.patches.at(-1).seg[0].fx,1);
 const small=await page.locator('.widget').boundingBox();assert.ok(small.width<=321&&small.height<210&&full.height-small.height>100);
 await mkdir(resolve('docs/screenshots'),{recursive:true});await page.mouse.click(330,465);await page.screenshot({path:resolve('docs/screenshots/compact-controls.png'),fullPage:true});
 await page.getByRole('button',{name:'Развернуть виджет',exact:true}).click();await page.locator('.peek-edge[data-status="live"]').nth(1).waitFor();assert.ok(await page.locator('.devices').isVisible());
 await page.getByRole('button',{name:'Компактный режим',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Развернуть виджет',exact:true}).waitFor();assert.ok(await page.locator('.devices').isHidden());assert.ok(await page.getByRole('button',{name:'Скрыть виджет в трей'}).isDisabled(),'Browser must not claim an operational native tray');
 assert.deepEqual(errors,[]);console.log('Compact UI passed: hidden sections, working controls, Peek suspension/resume, dimensions, preference persistence and truthful browser tray state.');
}finally{await browser?.close();server?.kill();await lamp.close();await rm(temp,{recursive:true,force:true});}
