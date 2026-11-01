async function imageData(name){
  const image=new Image();image.src=new URL(name,import.meta.url).href;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
  return {image,data:ctx.getImageData(0,0,canvas.width,canvas.height).data};
}
const [material,uv,base,neutral,back,calibration]=await Promise.all([
  imageData('lamp-ribbon-material.png'),imageData('lamp-ribbon-uv.png'),imageData('lamp-base-material.png'),
  imageData('lamp-base-neutral.png'),
  imageData('lamp-ribbon-uv-back.png'),
  fetch(new URL('lamp-calibration.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Lamp material is unavailable');return r.json();}),
]);
export const REFERENCE_PALETTE=calibration.palette;
export const BASE_MATERIAL=base.image;
export const BASE_NEUTRAL=neutral.image;
export const REFERENCE_MATERIAL=material.data;
const {width,height}=calibration,size=width*height;
const positions=new Float32Array(size),backPositions=new Float32Array(size),frontWeights=new Float32Array(size),coverage=new Uint8Array(size),gains=new Float32Array(size),whites=new Float32Array(size),active=[];
for(let i=0;i<size;i++){
  positions[i]=(uv.data[i*4]*256+uv.data[i*4+1])/65535;
  backPositions[i]=(back.data[i*4]*256+back.data[i*4+1])/65535;frontWeights[i]=uv.data[i*4+2]/255;
  coverage[i]=material.data[i*4+3];if(!coverage[i])continue;
  const offset=i*4,c=[material.data[offset],material.data[offset+1],material.data[offset+2]],t=(frontWeights[i]>.5?positions[i]:backPositions[i])*255;
  const lo=Math.floor(t),hi=Math.min(255,lo+1),f=t-lo;
  const ref=[0,1,2].map(k=>REFERENCE_PALETTE[lo][k]+(REFERENCE_PALETTE[hi][k]-REFERENCE_PALETTE[lo][k])*f);
  const light=rgb=>Math.max(...rgb)*.55+(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])*.45;
  gains[i]=Math.min(1.12,Math.max(.42,light(c)/Math.max(1,light(ref))));
  whites[i]=Math.min(...c)/255*.035;active.push(i);
}
export const MATERIAL_MAP={positions,backPositions,frontWeights,coverage,gains,whites,active:Uint32Array.from(active),blends:[]};
