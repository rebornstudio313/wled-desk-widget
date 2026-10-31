import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {validateScene,loadScenes,saveScenes} from '../../scripts/scenes.mjs';
const custom={kind:'custom',on:true,bri:128,color:'#11aaFF',effect:'Rainbow',speed:100,intensity:50};
test('Scene validation isolates per-device presets and allows custom settings; rejects unsafe fields',()=>{
 const scene={slot:'work',targets:[{deviceId:'a',action:custom},{deviceId:'b',action:{kind:'preset',presetId:7}}]};
 assert.deepEqual(validateScene(scene,[{id:'a'},{id:'b'}]),scene);
 for(const bad of [{...scene,slot:'unknown'},{...scene,targets:[scene.targets[0],scene.targets[0]]},{...scene,targets:[{deviceId:'a',action:{...custom,bri:0}}]},{...scene,targets:[{deviceId:'a',action:{...custom,cfg:{}}}]},{...scene,targets:[{deviceId:'a',action:{kind:'preset',presetId:251}}]}])assert.throws(()=>validateScene(bad));
 assert.throws(()=>validateScene(scene,[{id:'a'}]));
});
test('Scenes survive reload and retain the previous file as backup',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'widget-scenes-')),file=join(folder,'scenes.json');
 try{assert.deepEqual(await loadScenes(file),[]);const first={slot:'evening',targets:[{deviceId:'a',action:custom}]};await saveScenes(file,[first]);assert.deepEqual(await loadScenes(file),[first]);await saveScenes(file,[]);assert.deepEqual(JSON.parse(await readFile(file+'.bak','utf8')).scenes,[first]);assert.deepEqual(await loadScenes(file),[]);}finally{await rm(folder,{recursive:true,force:true});}
});
