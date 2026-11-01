import assert from 'node:assert/strict';import {test} from 'node:test';import {dnsQuestion,dnsRecords,discoverWled} from '../../scripts/discovery.mjs';import {fixtureLamp} from '../fixtures/peek-lamp.mjs';
test('mDNS decodes records and rejects truncated packets and compression loops',()=>{
 const q=dnsQuestion('_wled._tcp.local.');assert.equal(q.readUInt16BE(4),1);assert.equal(q.readUInt16BE(q.length-2),0x8001);
 const name=Buffer.from([4,...Buffer.from('lamp'),5,...Buffer.from('local'),0]);const record=Buffer.concat([name,Buffer.from([0,1,0,1,0,0,0,120,0,4,192,168,1,9])]);const header=Buffer.from([0,0,132,0,0,0,0,1,0,0,0,0]);assert.deepEqual(dnsRecords(Buffer.concat([header,record])),[{name:'lamp.local.',type:1,ip:'192.168.1.9'}]);assert.deepEqual(dnsRecords(Buffer.concat([header,Buffer.from([192,12])])),[]);assert.deepEqual(dnsRecords(Buffer.concat([header,record]).subarray(0,18)),[]);
});
test('search verifies WLED, preserves custom names, deduplicates addresses and never writes light',async()=>{
 const a=await fixtureLamp('Original',[[0,0,0]]),b=await fixtureLamp('Second',[[0,0,0]]);
 try{const found=await discoverWled([{id:'a',name:'Custom name',address:'http://'+a.address,identity:'Original'}],{browse:async()=>['http://'+b.address,'http://'+b.address,'https://public.example/path']});assert.equal(found.length,2);assert.ok(found.some(v=>v.name==='Custom name'));assert.ok(found.some(v=>v.name==='Second'));assert.equal(a.patches.length+b.patches.length,0);}finally{await a.close();await b.close();}
});
