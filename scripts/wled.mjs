import {isIP} from 'node:net';
export function normalizeAddress(value){
 if(typeof value!=='string'||!value.trim())throw Error('Введите адрес лампы');
 const url=new URL(value.includes('://')?value.trim():'http://'+value.trim());
 const host=url.hostname.toLowerCase();
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!['','/'].includes(url.pathname)||url.search||url.hash)throw Error('Нужен адрес http/https без пути, пароля и параметров');
 const parts=host.split('.').map(Number);
 const local=isIP(host)===4&&(parts[0]===10||parts[0]===127||parts[0]===192&&parts[1]===168||parts[0]===172&&parts[1]>=16&&parts[1]<=31);
 if(!local&&host!=='localhost'&&!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.local$/.test(host))throw Error('Укажите локальный IPv4-адрес или имя .local');
 return url.origin;
}
export async function request(address,path,body){
 const response=await fetch(address+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000),redirect:'error'});
 if(!response.ok)throw Error('WLED: HTTP '+response.status);return response.json();
}
export async function snapshot(address){
 const [info,state,effects]=await Promise.all(['/json/info','/json/state','/json/eff'].map(p=>request(address,p)));
 if(typeof info.ver!=='string'||!Number.isInteger(info.leds?.count)||!Array.isArray(state.seg)||!state.seg.length||typeof state.on!=='boolean'||!Array.isArray(effects)||!effects.every(e=>typeof e==='string')||!Array.isArray(state.seg[0]?.col?.[0])||state.seg[0].col[0].length<3)throw Error('Адрес не вернул совместимые сведения WLED');
 let presets={};try{presets=await request(address,'/presets.json')}catch{}let palettes=[];try{const value=await request(address,'/json/pal');if(Array.isArray(value)&&value.every(v=>typeof v==='string'))palettes=value;}catch{}return {info,state,effects,presets,palettes};
}
export function validatePatch(patch){
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Неверная команда');
 const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 if(Object.keys(patch).some(k=>!['on','bri','ps','seg'].includes(k)))throw Error('Неподдерживаемое поле команды');
 if(patch.on!==undefined&&typeof patch.on!=='boolean')throw Error('Неверное питание');
 if(patch.bri!==undefined&&!integer(patch.bri,1,255))throw Error('Неверная яркость');
 if(patch.ps!==undefined&&!integer(patch.ps,1,250))throw Error('Неверный пресет');
 if(patch.seg!==undefined){if(!Array.isArray(patch.seg)||patch.seg.length!==1)throw Error('Неверный сегмент');for(const segment of patch.seg){if(!integer(segment.id,0,255)||Object.keys(segment).some(k=>!['id','col','fx','sx','ix','pal'].includes(k)))throw Error('Неверные поля сегмента');for(const k of ['fx','sx','ix','pal'])if(segment[k]!==undefined&&!integer(segment[k],0,255))throw Error('Неверный параметр эффекта');if(segment.col!==undefined&&(!Array.isArray(segment.col)||segment.col.length!==1||!Array.isArray(segment.col[0])||segment.col[0].length!==3||!segment.col[0].every(v=>integer(v,0,255))))throw Error('Неверный RGB');}}
 return patch;
}
export function createQueue(){const tails=new Map();return (id,action)=>{const next=(tails.get(id)||Promise.resolve()).catch(()=>{}).then(action);tails.set(id,next);next.finally(()=>{if(tails.get(id)===next)tails.delete(id)}).catch(()=>{});return next;};}
