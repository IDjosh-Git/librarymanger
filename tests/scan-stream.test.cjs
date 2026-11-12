const {test}=require('node:test');
const assert=require('node:assert/strict');
const stream=require('../assets/scan-stream');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('scan begins during preparation, not after all photos are claimed',async()=>{
 const order=[],items=Array.from({length:117},(_,i)=>i),scanned=[];
 await stream.run({items,chunkSize:3,workers:2,bufferLimit:6,
  prepare:async chunk=>{order.push('prepare:'+chunk[0]);await tick();return {accepted:chunk,skipped:0}},
  claim:async chunk=>{order.push('claim:'+chunk[0]);await tick();return {accepted:chunk,skipped:[]}},
  scan:async item=>{order.push('scan:'+item);scanned.push(item);await tick()}});
 assert.equal(scanned.length,117);
 assert.ok(order.indexOf('scan:0')<order.indexOf('claim:114'));
 assert.ok(order.indexOf('scan:0')<order.indexOf('prepare:114'));
 assert.deepEqual(scanned.slice().sort((a,b)=>a-b),items);
});

test('exact duplicate skips are processed without scanning again',async()=>{
 const scanned=[],statistics=[];
 await stream.run({items:[1,2,3,4,5],chunkSize:2,prepare:async input=>({accepted:input.filter(x=>x%2),skipped:input.filter(x=>!(x%2)).length}),
  claim:async items=>({accepted:items.filter(x=>x!==3),skipped:items.filter(x=>x===3)}),
  scan:async item=>scanned.push(item),onChunk:details=>statistics.push(details)});
 assert.deepEqual(scanned,[1,5]);
 assert.equal(statistics.reduce((a,x)=>a+x.prepared.skipped+x.claimed.skipped.length,0),3);
});

test('stop signal drains no new photos and resolves waiting scanners',async()=>{
 let stop=false,scanned=0;
 const result=await stream.run({items:Array.from({length:100},(_,i)=>i),workers:2,chunkSize:4,
  shouldStop:()=>stop,
  prepare:async input=>({accepted:input,skipped:0}),claim:async input=>({accepted:input,skipped:[]}),
  scan:async()=>{scanned++;stop=true}});
 assert.equal(result.stopped,true);assert.ok(scanned<100);
});

test('producer failure does not hang waiting consumers',async()=>{
 await assert.rejects(stream.run({items:[1,2,3],workers:3,prepare:async()=>{throw new Error('cloud down')},claim:async()=>({accepted:[]}),scan:async()=>{}}),/cloud down/);
});

test('claim happens before an image can be scanned',async()=>{
 const claimed=new Set(),scanned=[];
 await stream.run({items:[1,2,3],chunkSize:1,prepare:async input=>({accepted:input,skipped:0}),
  claim:async input=>{input.forEach(x=>claimed.add(x));return {accepted:input,skipped:[]}},
  scan:async item=>{assert.ok(claimed.has(item));scanned.push(item)}});
 assert.deepEqual(scanned,[1,2,3]);
});

test('adaptive chunks scan first three covers while the rest are still being prepared',async()=>{
 const claimed=[],scanned=[];
 await stream.run({items:Array.from({length:117},(_,i)=>i),chunkSize:offset=>offset===0?3:18,
  prepare:async chunk=>({accepted:chunk,skipped:0}),
  claim:async chunk=>{claimed.push(chunk.length);await tick();return {accepted:chunk,skipped:[]}},
  scan:async item=>{scanned.push(item);await tick()}});
 assert.equal(claimed[0],3);
 assert.ok(claimed.slice(1).every(n=>n<=18));
 assert.equal(scanned.length,117);
});

test('scanner failures stop production rather than deadlocking behind backpressure',async()=>{
 await assert.rejects(stream.run({items:Array.from({length:100},(_,i)=>i),workers:1,bufferLimit:2,chunkSize:3,
  prepare:async chunk=>({accepted:chunk,skipped:0}),
  claim:async chunk=>({accepted:chunk,skipped:[]}),
  scan:async()=>{throw Error('recognition stopped')}}),/recognition stopped/);
});
