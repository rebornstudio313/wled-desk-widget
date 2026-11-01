import {CanvasLamp} from './lamp-canvas.mjs';

// One pending frame, at most 20 paints per second; no demo animation or network code.
export function createLampWidget(canvas,{maxFps=20}={}){
  const lamp=new CanvasLamp(canvas);lamp.setPower(false);
  const interval=1000/Math.max(1,Math.min(60,Number(maxFps)||20));
  let pending=null,timer=0,raf=0,last=-Infinity,disposed=false;
  function schedule(){
    if(disposed||timer||raf)return;
    timer=setTimeout(()=>{timer=0;raf=requestAnimationFrame(()=>{
      raf=0;if(disposed||!pending)return;
      const next=pending;pending=null;last=performance.now();
      lamp.on=next.on;lamp.brightness=1; // Peek already contains the controller's brightness.
      if(next.colors)lamp.setColors(next.colors);else lamp.draw();
      if(pending)schedule();
    });},Math.max(0,interval-(performance.now()-last)));
  }
  return {
    update({colors,on=true}={}){
      if(disposed)return false;
      if(colors!==undefined&&(!Array.isArray(colors)||!colors.length||colors.length>16384||!colors.every(c=>typeof c==='string'&&/^#[a-f\d]{6}$/i.test(c)||Array.isArray(c)&&c.length===3&&c.every(v=>Number.isFinite(v)&&v>=0&&v<=255))))return false;
      pending={colors:colors?.map(c=>Array.isArray(c)?[...c]:c),on:!!on};schedule();return true;
    },
    clear(){if(disposed)return;pending={on:false};schedule();},
    destroy(){disposed=true;pending=null;clearTimeout(timer);cancelAnimationFrame(raf);lamp.destroy();},
  };
}
