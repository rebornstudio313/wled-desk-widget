import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const sources=['server.mjs','updates.mjs','../packages/domain/src/updates.mjs','discovery.mjs','scenes.mjs','state-hub.mjs','wled.mjs','peek.mjs','preview-version.mjs','../packages/domain/src/peek.mjs'];
export async function backendRevision(){
 const chunks=await Promise.all(sources.map(path=>readFile(fileURLToPath(new URL(path,import.meta.url)))));
 const hash=createHash('sha256');chunks.forEach((chunk,i)=>hash.update(sources[i]).update('\0').update(chunk).update('\0'));
 return hash.digest('hex');
}
