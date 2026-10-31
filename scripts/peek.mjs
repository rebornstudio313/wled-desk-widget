import {normalizeAddress} from './wled.mjs';
import {decodePeekFrame} from '../packages/domain/src/peek.mjs';

// One read-only WLED socket per registered lamp, shared by preview consumers.
export function createPeekHub({Socket=WebSocket,staleMs=5000,retryMs=1000,tickMs=1000}={}){
 const streams=new Map();
 function subscribe(device,listener){
  const address=normalizeAddress(device.address);
  let stream=streams.get(device.id);
  if(!stream){
   stream={listeners:new Set(),socket:null,closed:false,retry:null,watch:null,status:'connecting',frame:null,last:0,sent:0,attempt:0};
   streams.set(device.id,stream);
   const emit=(type,value)=>{for(const listen of stream.listeners){try{listen(type,value)}catch{}}};
   const status=value=>{if(stream.status!==value){stream.status=value;if(value!=='live')stream.frame=null;emit('status',{status:value});}};
   stream.connect=()=>{
    if(stream.closed)return;
    status('connecting');stream.frame=null;
    const url=new URL(address);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/ws';
    const socket=new Socket(url.href);stream.socket=socket;socket.binaryType='arraybuffer';
    stream.last=Date.now();
    socket.addEventListener('open',()=>{if(stream.closed||socket!==stream.socket){socket.close();return;}stream.last=Date.now();socket.send('{"lv":true}');});
    socket.addEventListener('message',event=>{
     if(stream.closed||socket!==stream.socket)return;
     const frame=decodePeekFrame(event.data);if(!frame)return;
     stream.last=Date.now();stream.attempt=0;stream.frame=frame;status('live');
     if(stream.last-stream.sent>=80){stream.sent=stream.last;emit('frame',frame);}
    });
    socket.addEventListener('error',()=>{if(!stream.closed&&socket===stream.socket){status('offline');socket.close();}});
    socket.addEventListener('close',()=>{
     if(stream.closed||socket!==stream.socket)return;
     status('offline');clearTimeout(stream.retry);
     stream.retry=setTimeout(stream.connect,Math.min(retryMs*2**Math.min(stream.attempt++,4),10000));
    });
   };
   stream.watch=setInterval(()=>{
    if(Date.now()-stream.last<=staleMs)return;
    if(stream.socket?.readyState===0){stream.socket.close();return;}
    if(stream.socket?.readyState===1)status('stalled');
   },tickMs);
  }
  stream.listeners.add(listener);listener('status',{status:stream.status});
  if(stream.frame)listener('frame',stream.frame);
  if(!stream.socket)stream.connect();
  let released=false;
  return ()=>{
   if(released)return;released=true;stream.listeners.delete(listener);
   if(stream.listeners.size)return;
   stream.closed=true;clearTimeout(stream.retry);clearInterval(stream.watch);
   // Do not send lv:false: on WLED that could turn off another client's Peek.
   stream.socket?.close();streams.delete(device.id);
  };
 }
 return {subscribe};
}
