import type {Patch,Snapshot} from './model';

// Copy light settings, never device-specific preset IDs or strip geometry.
export function lightPatch(source:Snapshot,target:Snapshot):Patch{
 const segment=source.state.seg[0],destination=target.state.seg[0];
 if(!segment||!destination)throw Error('Нет доступного сегмента');
 const name=source.effects[segment.fx],fx=target.effects.indexOf(name);
 if(!name||fx<0)throw Error(`Эффект «${name||segment.fx}» недоступен на этой лампе`);
 const sourcePalette=segment.pal;let pal:number|undefined;
 if(sourcePalette!==undefined){const paletteName=source.palettes?.[sourcePalette];pal=paletteName?target.palettes?.indexOf(paletteName):sourcePalette===0?0:undefined;if(pal===undefined||pal<0)throw Error('Палитра недоступна на этой лампе');}
 return {on:source.state.on,bri:Math.max(1,source.state.bri),seg:[{id:destination.id,col:[segment.col[0].slice(0,3)],fx,...(pal===undefined?{}:{pal}),sx:segment.sx,ix:segment.ix}]};
}
