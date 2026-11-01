import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd(), temp=await mkdtemp(join(tmpdir(),'widget-led-rgb-'));
const state={on:true,bri:191,seg:[{id:0,col:[[0,187,255]],fx:0,sx:128,ix:128}]};
const lamp=http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');
 const info={name:'Test lamp',mac:'test-fixture-only',ver:'16.0.1',leds:{count:60}};
 if(req.method==='POST'){
  let body='';for await(const chunk of req)body+=chunk;
  const patch=JSON.parse(body);if(patch.on!==undefined)state.on=patch.on;
  if(patch.bri!==undefined)state.bri=patch.bri;if(patch.seg)Object.assign(state.seg[0],patch.seg[0]);
  res.end('{"success":true}');return;
 }
 const values={'/json/info':info,'/json/state':state,'/json/eff':['Solid','Breathe','Rainbow',...Array.from({length:50},(_,i)=>`Fixture effect ${i+1}`)],'/presets.json':{'2':{n:'Fixture preset'}}};
 res.end(JSON.stringify(values[req.url]||{}));
});
await new Promise(r=>lamp.listen(0,'127.0.0.1',r));
let browser,server;
try{
 server=spawn(process.execPath,['scripts/server.mjs'],{cwd:root,env:{...process.env,WIDGET_PORT:'1423',WIDGET_PROFILE_FILE:join(temp,'devices.json')},stdio:['ignore','pipe','pipe']});
 let output='';server.stdout.on('data',x=>output+=x);server.stderr.on('data',x=>output+=x);
 for(let n=0;n<100&&!output.includes('loopback only');n++)await new Promise(r=>setTimeout(r,100));
 assert.match(output,/loopback only/);
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:1423');
 await page.getByLabel('Управление лампами',{exact:true}).waitFor();
 await page.getByRole('heading',{name:'Добавьте первую лампу'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Демо',exact:true}).count(),0,'No demonstration mode in the application');
 assert.equal(await page.locator('.no-devices-status').evaluate(e=>getComputedStyle(e).fontSize),'13px','Readable empty-state status');
 await page.getByRole('button',{name:'Настройки ламп',exact:true}).click();
 
 await page.getByRole('heading',{name:'Добавьте первую лампу'}).waitFor();
 await page.getByLabel('Адрес лампы',{exact:true}).fill(`127.0.0.1:${lamp.address().port}`);
 await page.locator('form').getByRole('button',{name:'＋ Добавить лампу',exact:true}).click();
 await page.locator('.devices').getByRole('button',{name:'Test lamp',exact:true}).waitFor();
 assert.equal(JSON.parse(await readFile(join(temp,'devices.json'),'utf8')).devices.length,1);
 await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
 await page.locator('.devices .connection-dot.online').waitFor();
 assert.match(await page.locator('.devices').innerText(),/Test lamp/);
 // HEX and dragging must place the marker at the actual selected hue.
 const ring=page.locator('.hue-wheel'),marker=page.locator('.wheel-marker');
 async function verifyMarker(expectedHue,expectedColor){
  const box=await ring.boundingBox(),dot=await marker.boundingBox();
  const a=(expectedHue-180)*Math.PI/180,r=box.width/2-10.5;
  assert.ok(Math.abs(dot.x+dot.width/2-(box.x+box.width/2+Math.cos(a)*r))<1,'Marker horizontal position');
  assert.ok(Math.abs(dot.y+dot.height/2-(box.y+box.height/2+Math.sin(a)*r))<1,'Marker vertical position');
  assert.equal(await marker.evaluate(e=>getComputedStyle(e).backgroundColor),expectedColor);
 }
 for(const [color,hue,css] of [['#ff0000',0,'rgb(255, 0, 0)'],['#00ff00',120,'rgb(0, 255, 0)'],['#0000ff',240,'rgb(0, 0, 255)']]){
  await page.getByLabel('HEX цвет',{exact:true}).fill(color);
  await page.getByLabel('HEX цвет',{exact:true}).press('Tab');
  await page.getByRole('status').filter({hasText:'Настройки применены'}).waitFor();
  await verifyMarker(hue,css);
 }
 const wheelBox=await ring.boundingBox(),cx=wheelBox.x+wheelBox.width/2,cy=wheelBox.y+wheelBox.height/2,r=wheelBox.width/2-10.5;
 await page.mouse.move(cx-r,cy);await page.mouse.down();
 await page.mouse.move(cx,cy+r,{steps:8});
 await verifyMarker(270,'rgb(128, 0, 255)');
 await page.mouse.up();
 await page.getByRole('status').filter({hasText:'Настройки применены'}).waitFor();
 // Captured dragging continues beyond the ring and finishes on the final hue.
 await page.mouse.move(cx+r,cy);await page.mouse.down();await page.mouse.move(cx+r+40,cy);await page.mouse.up();
 await page.getByRole('status').filter({hasText:'Настройки применены'}).waitFor();
 await verifyMarker(180,'rgb(0, 255, 255)');
 assert.equal(await page.locator('.widget-chrome button').count(),2);
 assert.equal(await page.locator('.power-section [role="switch"]').count(),1);
 assert.equal(await page.getByRole('tablist').count(),0);
 await page.getByLabel('HEX цвет',{exact:true}).fill('#ff9e52');
 await page.getByLabel('HEX цвет',{exact:true}).press('Tab');
 await page.getByRole('status').filter({hasText:'Настройки применены'}).waitFor();
 await page.getByLabel('HEX цвет',{exact:true}).fill('#00bbff');
 await page.getByLabel('HEX цвет',{exact:true}).press('Tab');
 await page.getByRole('status').filter({hasText:'Настройки применены'}).waitFor();
 await mkdir(resolve(root,'docs/screenshots'),{recursive:true});
 await page.mouse.click(3,3);
 await page.screenshot({path:resolve(root,'docs/screenshots/prototype-demo.png'),fullPage:true});
 const bounds=await page.getByLabel('Управление лампами',{exact:true}).boundingBox();
 assert.ok(bounds.width<=321 && bounds.height<=490,`Compact panel: ${JSON.stringify(bounds)}`);
 await page.setViewportSize({width:332,height:470});
 await page.mouse.click(330,465);
 await page.screenshot({path:resolve(root,'docs/screenshots/prototype-compact.png'),fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No horizontal viewport overflow');
 await page.setViewportSize({width:1280,height:1000});
 // A fresh application load must restore saved lamps without opening Settings.
 const beforeReload=structuredClone(state);
 await page.reload();
 await page.locator('.devices').getByRole('button',{name:'Test lamp',exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Питание выбранных ламп"]').disabled);
 assert.ok(await page.getByRole('dialog',{name:'Настройки виджета'}).isHidden());
 assert.equal(await page.locator('.devices').getByRole('button',{name:'Лампа 1',exact:true}).count(),0,'No demo lamps on saved profile startup');
 assert.deepEqual(state,beforeReload,'Startup only reads device state');
 // Offline saved lamps also stay visible and must not fall back to demo.
 await page.route('**/api/devices/*',route=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Fixture offline'})}));
 await page.reload();
 await page.locator('.devices .connection-dot.offline').waitFor();
 await page.locator('.devices .connection-dot.offline').waitFor();
 assert.ok(await page.getByRole('dialog',{name:'Настройки виджета'}).isHidden());
 assert.equal(await page.locator('.devices').getByRole('button',{name:'Test lamp',exact:true}).count(),1);
 assert.ok(await page.getByRole('switch',{name:'Питание выбранных ламп'}).isDisabled());
 await page.unroute('**/api/devices/*');
 await page.reload();await page.waitForFunction(()=>!document.querySelector('[aria-label="Питание выбранных ламп"]').disabled);
 await page.getByRole('switch',{name:'Питание выбранных ламп'}).click();
 await page.getByRole('status').filter({hasText:'Настройки применены'}).waitFor();
 assert.equal(state.on,false);
 assert.equal(await page.getByRole('switch',{name:'Питание выбранных ламп'}).getAttribute('aria-checked'),'false');
 await page.getByLabel('HEX цвет',{exact:true}).fill('#00bbff');
 await page.getByLabel('HEX цвет',{exact:true}).press('Tab');
 await page.getByRole('status').filter({hasText:'Настройки применены'}).waitFor();
 assert.deepEqual(state.seg[0].col[0],[0,187,255]);
 const liveRing=await ring.boundingBox();
 await page.mouse.move(liveRing.x+10.5,liveRing.y+liveRing.height/2);await page.mouse.down();
 await page.mouse.move(liveRing.x+liveRing.width/2,liveRing.y+10.5,{steps:6});
 assert.deepEqual(state.seg[0].col[0],[0,187,255],'Drag previews locally until release');
 await page.mouse.up();
 await page.getByRole('status').filter({hasText:'Настройки применены'}).waitFor();
 assert.deepEqual(state.seg[0].col[0],[128,255,0],'Release sends final selected hue');
 await page.getByRole('combobox',{name:'Эффект',exact:true}).press('ArrowDown');
 const effectList=page.getByRole('listbox',{name:'Эффект: список',exact:true});await effectList.waitFor();
 await effectList.press('End');await page.getByRole('option',{name:'Fixture effect 50',exact:true}).waitFor();
 assert.ok(await effectList.evaluate(e=>e.scrollTop>0),'Long effect list scrolls to the keyboard selection');
 assert.equal(await effectList.evaluate(e=>getComputedStyle(e,'::-webkit-scrollbar').width),'6px','Themed narrow scrollbar');
 await page.screenshot({path:resolve(root,'docs/screenshots/effect-picker.png'),fullPage:true});
 await effectList.press('Escape');assert.equal(await effectList.count(),0,'Escape closes the picker');
 await page.getByRole('combobox',{name:'Эффект',exact:true}).click();await page.getByRole('option',{name:'Breathe',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Настройки применены'}).waitFor();
 assert.equal(state.seg[0].fx,1);
 const forbidden=await fetch('http://127.0.0.1:1423/api/devices',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});
 assert.equal(forbidden.status,403);
 await page.getByRole('button',{name:'Настройки ламп',exact:true}).click();
 await page.getByRole('button',{name:'Удалить Test lamp',exact:true}).click();
 await page.getByRole('heading',{name:'Добавьте первую лампу'}).waitFor();
 assert.equal(JSON.parse(await readFile(join(temp,'devices.json'),'utf8')).devices.length,0);
 assert.deepEqual(errors,[]);
 console.log('UI smoke passed: real-device onboarding and status, moving color marker, header settings, compact layout, live add/persistence, automatic startup/reload, offline saved lamps, power, RGB, effects, origin restriction, remove.');
}finally{
 await browser?.close();server?.kill();await new Promise(r=>lamp.close(r));await rm(temp,{recursive:true,force:true});
}



