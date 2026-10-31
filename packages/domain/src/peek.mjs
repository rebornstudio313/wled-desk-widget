// WLED Peek wire format. No network or state-changing commands here.
const LIMIT=16384;
export function decodePeekFrame(input){
 if(typeof input==='string'){
  let data;try{data=JSON.parse(input)}catch{return null}
  if(!Array.isArray(data?.leds)||!data.leds.length||data.leds.length>LIMIT)return null;
  if(!data.leds.every(c=>typeof c==='string'&&/^(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c)))return null;
  return {colors:data.leds.map(c=>'#'+c.slice(-6))};
 }
 const bytes=input instanceof Uint8Array?input:input instanceof ArrayBuffer?new Uint8Array(input):null;
 if(!bytes||bytes[0]!==76||![1,2].includes(bytes[1]))return null;
 const offset=bytes[1]===2?4:2;
 if(bytes.length<=offset||(bytes.length-offset)%3!==0)return null;
 const available=(bytes.length-offset)/3;
 const count=bytes[1]===2?bytes[2]*bytes[3]:available;
 if(!count||count>LIMIT||count>available)return null;
 const colors=Array.from({length:count},(_,i)=>'#'+Array.from(bytes.subarray(offset+i*3,offset+i*3+3),v=>v.toString(16).padStart(2,'0')).join(''));
 return bytes[1]===2?{colors,width:bytes[2],height:bytes[3]}:{colors};
}
