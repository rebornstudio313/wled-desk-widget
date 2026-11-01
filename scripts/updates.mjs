import {selectUpdate} from '../packages/domain/src/updates.mjs';
const endpoint='https://api.github.com/repos/rebornstudio313/wled-desk-widget/releases?per_page=100';
export async function checkUpdates(version,{request=fetch}={}){
 let response;try{response=await request(endpoint,{headers:{Accept:'application/vnd.github+json','User-Agent':'WLED-Desk-Widget/'+version},signal:AbortSignal.timeout(8000),redirect:'error'});}catch{throw Error('Не удалось связаться с GitHub. Проверьте интернет и повторите попытку.');}
 if(response.status===403||response.status===429)throw Error('GitHub временно ограничил проверки. Попробуйте позже.');if(!response.ok)throw Error('Не удалось получить список выпусков GitHub. Попробуйте позже.');
 const reader=response.body.getReader();let size=0,chunks=[];try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2097152)throw Error('Ответ GitHub слишком большой');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 try{return selectUpdate(JSON.parse(Buffer.concat(chunks).toString()),version);}catch{throw Error('GitHub вернул неподходящий ответ. Попробуйте позже.');}
}
