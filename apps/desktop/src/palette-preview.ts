export function paletteGradient(values:unknown[],colors:number[][]):string|undefined{
 const stops:string[]=[];const rgb=(v:number[])=>'rgb('+v.slice(0,3).map(n=>Math.max(0,Math.min(255,Math.round(n)))).join(',')+')';
 for(let i=0;i<values.length;i++){const value=values[i];let color:string|undefined,pos=i/Math.max(1,values.length-1)*100;
 if(Array.isArray(value)&&value.length>=4&&value.slice(0,4).every(n=>typeof n==='number'&&Number.isFinite(n))){pos=Math.max(0,Math.min(255,value[0]))/255*100;color=rgb(value.slice(1,4));}
 else if(typeof value==='string'&&/^c[123]$/.test(value))color=rgb(colors[Number(value[1])-1]||[0,0,0]);
 else if(value==='r')color=['#ffc454','#4ed5af','#5164db','#bc5bdb'][i%4];
 if(color)stops.push(color+' '+pos.toFixed(2)+'%');
 }return stops.length?'linear-gradient(90deg,'+(stops.length===1?[stops[0],stops[0]].join(','):stops.join(','))+')':undefined;
}
