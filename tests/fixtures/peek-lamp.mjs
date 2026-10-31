// Minimal local test-only RFC6455 endpoint; production uses Node's WebSocket client.
import http from 'node:http';
import {createHash} from 'node:crypto';
function frame(payload,opcode=2){
 const data=Buffer.from(payload),header=data.length<126?Buffer.from([128|opcode,data.length]):Buffer.from([128|opcode,126,data.length>>8,data.length&255]);
 return Buffer.concat([header,data]);
}
export async function fixtureLamp(name,colors,options={}){
 const sockets=new Set(),commands=[],patches=[];let paused=false;
 const state={on:true,bri:191,seg:[{id:0,col:[[0,187,255]],fx:0,sx:128,ix:128}]};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.method==='POST'){let raw='';for await(const chunk of req)raw+=chunk;const patch=JSON.parse(raw);patches.push(patch);if(patch.on!==undefined)state.on=patch.on;if(patch.bri!==undefined)state.bri=patch.bri;if(patch.seg)Object.assign(state.seg[0],patch.seg[0]);return res.end('{"success":true}');}
  const values={'/json/info':{name,mac:name,ver:'16.0.1',leds:{count:colors.length}},'/json/state':state,'/json/eff':options.effects||['Solid','Rainbow'],'/presets.json':options.presets||{}};
  res.end(JSON.stringify(values[req.url]||{}));
 });
 server.on('upgrade',(req,socket,head)=>{
  if(req.url!=='/ws')return socket.destroy();
  const accept=createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  sockets.add(socket);let pending=Buffer.from(head),timer;
  const send=()=>{if(!paused&&!socket.destroyed)socket.write(frame([76,1,...colors.flat()]));};
  function read(chunk){
   pending=Buffer.concat([pending,chunk]);
   while(pending.length>=2){
    const opcode=pending[0]&15,masked=Boolean(pending[1]&128);let length=pending[1]&127,offset=2;
    if(length===127){socket.destroy();return;}
    if(length===126){if(pending.length<4)return;length=pending.readUInt16BE(2);offset=4;}
    const maskOffset=offset;if(masked)offset+=4;if(pending.length<offset+length)return;
    const data=Buffer.from(pending.subarray(offset,offset+length));
    if(masked)for(let i=0;i<data.length;i++)data[i]^=pending[maskOffset+i%4];
    pending=pending.subarray(offset+length);
    if(opcode===8){socket.end(frame(data,8));return;}
    if(opcode===9){socket.write(frame(data,10));continue;}
    if(opcode===1){let command;try{command=JSON.parse(data.toString())}catch{continue;}commands.push(command);if(command.lv===true){clearInterval(timer);send();timer=setInterval(send,40);}}
   }
  }
  socket.on('data',read);socket.on('error',()=>{});socket.on('close',()=>{sockets.delete(socket);clearInterval(timer);});read(Buffer.alloc(0));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {address:'127.0.0.1:'+server.address().port,sockets,commands,patches,setColors(next){colors=next;},pause(value){paused=value;},async close(){for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r));}};
}
