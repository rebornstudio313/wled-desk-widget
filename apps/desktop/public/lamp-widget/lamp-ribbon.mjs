import {REFERENCE_PALETTE,BASE_MATERIAL,BASE_NEUTRAL,REFERENCE_MATERIAL,MATERIAL_MAP} from './lamp-material.mjs';
// Canvas 2D lamp with a photo-calibrated silhouette, light/shadow material and a live UV color map.
const TAU = Math.PI * 2;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (v, alpha = 1) => `rgba(${v.map(x => Math.round(clamp(x, 0, 255))).join(',')},${alpha})`;
const W=640,H=960;
const BASE_CENTER_Y=417,BASE_RADIUS=99,BASE_RY=12,BASE_HEIGHT=39;
// Custom angular lettering derived from the selected bold WD concept.
const WORD_GLYPHS = {
  W:[94,'M0 0H18L31 43L40 25L32 0H50L65 43L77 0H94L74 70H55L44 48L32 70H13Z'],
  L:[57,'M0 0H18V52H57L49 70H0Z'],
  E:[61,'M0 0H61L52 17H18V27H49L42 43H18V53H61L51 70H0Z'],
  D:[72,'M0 0H31C58 0 72 14 72 35S58 70 31 70H0ZM18 17V53H30C45 53 53 47 53 35S45 17 30 17Z'],
  S:[62,'M62 0H20L0 20V35L17 44H42V53H0V70H43L62 51V35L45 26H19V17H53Z'],
  K:[67,'M0 0H18V27L44 0H66L36 35L67 70H44L18 43V70H0Z'],
};
const WORDMARK=[];let wordWidth=0;
for(const letter of 'WLED DESK'){
  if(letter===' '){wordWidth+=22;continue;}
  const [width,path]=WORD_GLYPHS[letter];WORDMARK.push({x:wordWidth,path:new Path2D(path)});wordWidth+=width+10;
}
wordWidth-=10;
let cachedWordmark;
function cylinderWordmark(){
  if(cachedWordmark)return cachedWordmark;
  const flat=document.createElement('canvas');flat.width=wordWidth*2;flat.height=152;
  const paint=flat.getContext('2d');paint.scale(2,2);
  const mask=document.createElement('canvas');mask.width=flat.width;mask.height=flat.height;
  const m=mask.getContext('2d');m.scale(2,2);m.fillStyle='#fff';
  for(const glyph of WORDMARK){m.save();m.translate(glyph.x,0);m.fill(glyph.path,'evenodd');m.restore();}
  function edge(offset,color){
    const layer=document.createElement('canvas');layer.width=flat.width;layer.height=flat.height;
    const ctx=layer.getContext('2d');ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='destination-out';ctx.drawImage(mask,0,offset);
    ctx.globalCompositeOperation='source-in';ctx.fillStyle=color;ctx.fillRect(0,0,layer.width,layer.height);
    return layer;
  }
  // A recessed metal cavity: upper inner shadow and lower bevel, rather than raised silver paint.
  const cavity=paint.createLinearGradient(0,0,0,70);
  cavity.addColorStop(0,'#263d4a');cavity.addColorStop(.26,'#648d9f');cavity.addColorStop(.65,'#99c3d4');cavity.addColorStop(1,'#c5e5ef');
  for(const glyph of WORDMARK){paint.save();paint.translate(glyph.x,0);paint.fillStyle=cavity;paint.fill(glyph.path,'evenodd');paint.restore();}
  paint.drawImage(edge(8,'#030b12db'),0,0,wordWidth,76);
  paint.drawImage(edge(-4,'#d5f5ffce'),0,0,wordWidth,76);
  const rim=document.createElement('canvas');rim.width=flat.width;rim.height=flat.height;
  const r=rim.getContext('2d');r.drawImage(mask,0,3);r.globalCompositeOperation='destination-out';r.drawImage(mask,0,0);
  r.globalCompositeOperation='source-in';r.fillStyle='#cad5df60';r.fillRect(0,0,rim.width,rim.height);
  paint.drawImage(rim,0,0,wordWidth,76);
  const source=paint.getImageData(0,0,flat.width,flat.height).data;
  const left=106,top=436,width=120,height=22,resolution=4;
  const decal=document.createElement('canvas');decal.width=width*resolution;decal.height=height*resolution;
  const ctx=decal.getContext('2d'),image=ctx.createImageData(decal.width,decal.height);
  const radius=BASE_RADIUS,halfAngle=Math.asin(46/radius);
  // Inverse cylinder projection: constant arc-length lettering narrows toward the sides.
  // Its vertical centre follows the same ellipse as the top and bottom of the sidewall.
  for(let y=0;y<decal.height;y++)for(let x=0;x<decal.width;x++){
    const worldX=left+(x+.5)/resolution,worldY=top+(y+.5)/resolution;
    const angle=Math.asin(clamp((worldX-166)/radius,-1,1));
    const u=(angle+halfAngle)/(2*halfAngle);
    const centre=BASE_CENTER_Y+BASE_HEIGHT/2+BASE_RY*Math.cos(angle);
    const sx=u*flat.width-.5,sy=((worldY-centre)/.12+35)*2-.5;
    if(u<0||u>1||sy< -1||sy>=flat.height)continue;
    const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
    let alpha=0,r=0,g=0,b=0;
    for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++){
      const px=ix+dx,py=iy+dy;if(px<0||px>=flat.width||py<0||py>=flat.height)continue;
      const offset=(py*flat.width+px)*4,weight=(dx?fx:1-fx)*(dy?fy:1-fy)*source[offset+3]/255;
      alpha+=weight;r+=source[offset]*weight;g+=source[offset+1]*weight;b+=source[offset+2]*weight;
    }
    if(!alpha)continue;
    const offset=(y*decal.width+x)*4;
    image.data[offset]=r/alpha;image.data[offset+1]=g/alpha;image.data[offset+2]=b/alpha;image.data[offset+3]=alpha*255;
  }
  ctx.putImageData(image,0,0);
  return cachedWordmark={canvas:decal,left,top,width,height};
}
const ENTRY_SEAMS=[
  {a:[147.1,425.1],b:[85.45,418.8],position:0},
  {a:[213.25,425.1],b:[249.7,417.9],position:1},
];
export const LAMP_PALETTE=REFERENCE_PALETTE;
function buildMesh(){return MATERIAL_MAP;}
export class CanvasLamp {
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');
    this.surface=document.createElement('canvas');this.surface.width=W;this.surface.height=H;
    this.light=this.surface.getContext('2d');this.pixels=this.light.createImageData(W,H);this.mesh=buildMesh();
    this.emitter=document.createElement('canvas');this.emitter.width=W;this.emitter.height=H;
    this.emission=this.emitter.getContext('2d');this.emissionPixels=this.emission.createImageData(W,H);
    this.colors=LAMP_PALETTE;this.referenceColors=true;
    this.on=true;this.brightness=1;this.glow=.75;
    this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(canvas);this.draw();
  }
  setColors(colors){
    if(!Array.isArray(colors)||!colors.length||colors.length>16384)return false;
    const parsed=colors.map(c=>typeof c==='string'&&/^#[a-f\d]{6}$/i.test(c)?[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)):
      Array.isArray(c)&&c.length===3&&c.every(v=>Number.isFinite(v)&&v>=0&&v<=255)?[...c]:null);
    if(parsed.some(c=>!c))return false;
    this.colors=parsed;this.referenceColors=parsed.length===LAMP_PALETTE.length&&parsed.every((c,i)=>c.every((v,k)=>Math.abs(v-LAMP_PALETTE[i][k])<.001));this.draw();return true;
  }
  setPower(on){this.on=!!on;this.draw();}
  setBrightness(value){if(Number.isFinite(value))this.brightness=clamp(value);this.draw();}
  setGlow(value){if(Number.isFinite(value))this.glow=clamp(value);this.draw();}
  colorAt(t){const f=clamp(t)*(this.colors.length-1),i=Math.floor(f);return mix(this.colors[i],this.colors[Math.min(i+1,this.colors.length-1)],f-i);}
  updateRibbon(){
    const {positions,backPositions,frontWeights,gains,whites,coverage,active}=this.mesh,data=this.pixels.data,colors=this.colors,last=colors.length-1;
    for(const index of active){
      const o=index*4;
      if(this.on&&this.referenceColors){
        data[o]=REFERENCE_MATERIAL[o]*this.brightness;
        data[o+1]=REFERENCE_MATERIAL[o+1]*this.brightness;
        data[o+2]=REFERENCE_MATERIAL[o+2]*this.brightness;
      }else{
        const f=clamp(positions[index])*last,lo=Math.floor(f),hi=Math.min(lo+1,last),t=f-lo;
        const rear=clamp(backPositions[index])*last,bl=Math.floor(rear),bh=Math.min(bl+1,last),bt=rear-bl,front=frontWeights[index];
        // Blend branch radiance at the subpixel overlap; never interpolate across the two UV ranges.
        const channel=k=>((colors[lo][k]+(colors[hi][k]-colors[lo][k])*t)*front+(colors[bl][k]+(colors[bh][k]-colors[bl][k])*bt)*(1-front))*this.brightness;
        const r=this.on?channel(0):12,g=this.on?channel(1):18,b=this.on?channel(2):25;
        const emission=Math.max(r,g,b)/255,shade=gains[index],white=whites[index]*emission;
        data[o]=r*shade+(255-r)*white;data[o+1]=g*shade+(255-g)*white;data[o+2]=b*shade+(255-b)*white;
      }
      data[o+3]=coverage[index];
    }
    this.light.putImageData(this.pixels,0,0);
    // Black Peek pixels emit no light. Keep radiance separate from the opaque material.
    const emitted=this.emissionPixels.data;
    for(const index of active){
      const o=index*4;emitted[o]=data[o];emitted[o+1]=data[o+1];emitted[o+2]=data[o+2];
      emitted[o+3]=Math.round(data[o+3]*Math.max(data[o],data[o+1],data[o+2])/255);
    }
    this.emission.putImageData(this.emissionPixels,0,0);
  }
  ellipse(ctx,x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=fill;ctx.fill();}
  base(ctx){
    ctx.drawImage(BASE_NEUTRAL,0,0,320,480);
    if(this.on&&this.referenceColors){
      ctx.save();ctx.globalAlpha=this.brightness;ctx.drawImage(BASE_MATERIAL,0,0,320,480);ctx.restore();return;
    }
    if(!this.on||!this.brightness)return;
    ctx.save();ctx.beginPath();ctx.ellipse(166,417,98,12,0,0,TAU);ctx.clip();ctx.globalCompositeOperation='screen';
    for(const {a,b,position}of ENTRY_SEAMS){
      const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;
      ctx.save();ctx.translate(x,y);ctx.scale(1,.27);
      const wash=ctx.createRadialGradient(0,0,0,0,0,65),color=this.colorAt(position);
      wash.addColorStop(0,rgb(color,.4*this.brightness));wash.addColorStop(1,rgb(color,0));
      ctx.fillStyle=wash;ctx.fillRect(-65,-65,130,130);ctx.restore();
    }
    ctx.restore();
  }
  baseRim(){}
  logo(ctx){
    const mark=cylinderWordmark();
    ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.23;
    ctx.filter=`blur(${.7*ctx.getTransform().a}px)`;
    ctx.drawImage(mark.canvas,mark.left,mark.top,mark.width,mark.height);ctx.restore();
    ctx.drawImage(mark.canvas,mark.left,mark.top,mark.width,mark.height);
  }
  radiance(ctx){
    if(!this.on||this.brightness===0||this.glow===0)return;
    ctx.save();ctx.globalCompositeOperation='screen';
    // Broad indirect light, mid-distance halo and close bloom follow the same Peek frame.
    for(const [radius,strength]of [[34,.48],[15,.4],[3,.58]]){
      ctx.filter=`blur(${radius*ctx.getTransform().a}px)`;ctx.globalAlpha=strength*this.glow;
      ctx.drawImage(this.emitter,0,0,320,480);
    }
    ctx.restore();
    for(const [x,start,end]of [[112,0,.5],[217,.5,1]]){
      const color=[0,0,0];
      for(let i=0;i<12;i++){const sample=this.colorAt(start+(end-start)*i/11);for(let c=0;c<3;c++)color[c]+=sample[c]/12;}
      const intensity=Math.max(...color)/255*this.brightness*this.glow;
      ctx.save();ctx.translate(x,469);ctx.scale(1,.09);
      const pool=ctx.createRadialGradient(0,0,0,0,0,103);
      pool.addColorStop(0,rgb(color,.48*intensity));pool.addColorStop(.4,rgb(color,.19*intensity));pool.addColorStop(1,rgb(color,0));
      ctx.fillStyle=pool;ctx.fillRect(-104,-104,208,208);ctx.restore();
    }
  }
  draw(){
    if(!this.ctx)return;
    const bounds=this.canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,3);
    const w=Math.max(1,Math.round(bounds.width*ratio)),h=Math.max(1,Math.round(bounds.height*ratio));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    const ctx=this.ctx;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    const scale=Math.min(w/320,h/480);ctx.setTransform(scale,0,0,scale,(w-320*scale)/2,(h-480*scale)/2);
    this.updateRibbon();
    this.radiance(ctx);
    this.base(ctx);ctx.drawImage(this.surface,0,0,320,480);

    this.baseRim(ctx);this.logo(ctx);
  }
  destroy(){this.observer.disconnect();}
}
