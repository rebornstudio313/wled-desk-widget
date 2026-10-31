import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodePeekFrame} from '../../packages/domain/src/peek.mjs';
import {createPeekHub} from '../../scripts/peek.mjs';
test('Peek decodes strips, matrix extents and legacy colors; rejects malformed frames',()=>{
 assert.deepEqual(decodePeekFrame(new Uint8Array([76,1,255,0,4,0,128,255])),{colors:['#ff0004','#0080ff']});
 assert.deepEqual(decodePeekFrame(new Uint8Array([76,2,1,1,1,2,3,4,5,6])),{colors:['#010203'],width:1,height:1});
 assert.deepEqual(decodePeekFrame('{"leds":["FF0000","aa112233"]}'),{colors:['#FF0000','#112233']});
 for(const data of [null,'pong','{}','{"leds":["oops"]}',[76,1],new Uint8Array([76,3,1,2,3]),new Uint8Array([76,1,1,2]),new Uint8Array([76,2,2,2,1,2,3])])assert.equal(decodePeekFrame(data),null);
});
class Socket extends EventTarget{
 static instances=[];
 constructor(url){super();this.url=url;this.readyState=0;this.sent=[];Socket.instances.push(this);}
 open(){this.readyState=1;this.dispatchEvent(new Event('open'));}
 message(data){this.dispatchEvent(new MessageEvent('message',{data}));}
 send(value){this.sent.push(value);}
 close(){this.readyState=3;this.dispatchEvent(new Event('close'));}
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('Peek shares sockets, never writes lighting state and releases the last subscriber',()=>{
 Socket.instances=[];const hub=createPeekHub({Socket}),events=[];
 const stop1=hub.subscribe({id:'a',address:'192.168.1.50'},(type,value)=>events.push([type,value]));
 const stop2=hub.subscribe({id:'a',address:'192.168.1.50'},()=>{});
 assert.equal(Socket.instances.length,1);const socket=Socket.instances[0];assert.equal(socket.url,'ws://192.168.1.50/ws');socket.open();
 socket.message(new Uint8Array([76,1,7,8,9]).buffer);
 assert.ok(events.some(([type,value])=>type==='frame'&&value.colors[0]==='#070809'));
 stop1();assert.equal(socket.readyState,1);stop2();assert.equal(socket.readyState,3);
 assert.deepEqual(socket.sent,['{"lv":true}']);stop2();
 assert.throws(()=>hub.subscribe({id:'unsafe',address:'8.8.8.8'},()=>{}));
});
test('Peek clears stale frames without stealing the stream; reconnects only after socket loss',async()=>{
 Socket.instances=[];const hub=createPeekHub({Socket,staleMs:15,retryMs:5,tickMs:5}),events=[];
 const stop=hub.subscribe({id:'b',address:'lamp.local'},(type,value)=>events.push([type,value]));
 try{
  const first=Socket.instances[0];first.open();first.message(new Uint8Array([76,1,1,2,3]).buffer);
  await sleep(40);assert.ok(events.some(([type,value])=>type==='status'&&value.status==='stalled'));
  assert.deepEqual(first.sent,['{"lv":true}']);assert.equal(Socket.instances.length,1);
  first.close();await sleep(15);assert.equal(Socket.instances.length,2);
 }finally{stop();}
});
