import type { Entry, Patch } from './model';
export const initialDemo=():Entry[]=>[282,288].map((count,index)=>({device:{id:'demo-'+index,name:'Лампа '+(index+1),address:'Демонстрация'},snapshot:{info:{name:'Лампа '+(index+1),ver:'demo',leds:{count}},state:{on:true,bri:191,seg:[{id:0,col:[[0,187,255]],fx:0,sx:128,ix:128}]},effects:index?['Solid','Breathe','Rainbow']:['Solid','Rainbow','Breathe'],presets:{'1':{n:'Мой вечер'},'3':{n:'Спокойный свет'}}}}));
export function demoPatch(entry:Entry,patch:Patch):Entry{
 const copy=structuredClone(entry); const state=copy.snapshot!.state;
 if(patch.on!==undefined)state.on=patch.on;if(patch.bri!==undefined)state.bri=patch.bri;
 if(patch.seg)Object.assign(state.seg[0],patch.seg[0]);
 if(patch.ps){state.seg[0].fx=0;state.seg[0].col=[[255,155,65]];state.bri=90;}
 return copy;
}
