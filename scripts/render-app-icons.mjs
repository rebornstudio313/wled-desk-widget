// Render code-native vector masters into Windows icon sizes. No raster editing.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const directory='apps/desktop/src-tauri/icons';await mkdir(directory,{recursive:true});
const app=await readFile('assets/design/app-icon-spectrum.svg','utf8'),tray=await readFile('assets/design/tray-spectrum.svg','utf8');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const pngs=[];
 for(const size of [16,24,32,48,64,128,256]){
  const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${app}`);
  const data=await page.screenshot({omitBackground:true});await writeFile(`${directory}/app-${size}.png`,data);pngs.push({size,data});await page.close();
 }
 for(const size of [16,32]){
  const page=await browser.newPage({viewport:{width:size,height:size}});await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${tray}`);
  await page.screenshot({path:`${directory}/tray-${size}.png`,omitBackground:true});await page.close();
 }
 // ICO directory, embedding independently rendered PNG images at each exact size.
 const header=Buffer.alloc(6+16*pngs.length);header.writeUInt16LE(1,2);header.writeUInt16LE(pngs.length,4);let offset=header.length;
 pngs.forEach(({size,data},i)=>{const n=6+i*16;header[n]=header[n+1]=size===256?0:size;header.writeUInt16LE(1,n+4);header.writeUInt16LE(32,n+6);header.writeUInt32LE(data.length,n+8);header.writeUInt32LE(offset,n+12);offset+=data.length;});
 await writeFile(`${directory}/app.ico`,Buffer.concat([header,...pngs.map(p=>p.data)]));console.log('Rendered spectrum app/tray PNGs and multi-size ICO.');
}finally{await browser.close();}
