'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/library-manager-v542.css'),'utf8');
const ui=fs.readFileSync(path.join(root,'assets/premium-progress-upload.js'),'utf8');
const dedup=require('../assets/scan-upload-dedup.js');
const stream=require('../assets/scan-stream.js');
const tick=(ms=18)=>new Promise(resolve=>setTimeout(resolve,ms));

test('image hashes run in a bounded pool but duplicates preserve their original order',async()=>{
 const photos=Array.from({length:12},(_,i)=>({file:{i},path:`${i}.jpg`}));
 const digest=async f=>{await tick(f.i===0?55:18);return f.i===7?'hash:0':`hash:${f.i}`};
 const seen=[];
 const result=await dedup.prepare(photos,[],(count,total,duplicates)=>seen.push([count,total,duplicates]),{concurrency:3,fingerprintFn:digest});
 assert.deepEqual(result.accepted.map(x=>x.file.i),[0,1,2,3,4,5,6,8,9,10,11]);
 assert.equal(result.skipped,1);
 assert.deepEqual(seen.map(x=>x[0]),Array.from({length:12},(_,i)=>i+1));
 assert.equal(seen.at(-1)[2],1);
});

test('parallel digest preparation reduces elapsed time for I/O-paced images',async()=>{
 const images=Array.from({length:12},(_,i)=>({file:{i}}));
 const digest=async f=>{await tick(16);return `hash:${f.i}`};
 let t=performance.now();await dedup.prepare(images,[],()=>{},{concurrency:1,fingerprintFn:digest});const serial=performance.now()-t;
 t=performance.now();await dedup.prepare(images,[],()=>{},{concurrency:3,fingerprintFn:digest});const parallel=performance.now()-t;
 assert.ok(parallel<serial*.70,`serial ${serial.toFixed(1)}ms; parallel ${parallel.toFixed(1)}ms`);
});

test('an extra scanner worker overlaps delayed remote catalogues while OCR stays separately capped',async()=>{
 const images=Array.from({length:12},(_,i)=>i);
 const config={items:images,chunkSize:4,bufferLimit:10,
  prepare:async chunk=>({accepted:chunk,skipped:0}),
  claim:async chunk=>({accepted:chunk,skipped:[]}),
  scan:async()=>{await tick(21)}
 };
 let t=performance.now();await stream.run({...config,workers:1});const serial=performance.now()-t;
 t=performance.now();await stream.run({...config,workers:2});const parallel=performance.now()-t;
 assert.ok(parallel<serial*.75,`serial ${serial.toFixed(1)}ms; parallel ${parallel.toFixed(1)}ms`);
 assert.match(html,/workers:Math\.min\(4,maxOCRWorkers\(\)\+1\)/);
});

test('a browser without native BarcodeDetector uses the local fast barcode decoder',async()=>{
 const isbn='9780306406157';
 let uses=0,clears=0;
 class FastBarcode{
  scanFile(file,showImage){uses++;assert.equal(showImage,false);return Promise.resolve(isbn)}
  clear(){clears++;return Promise.resolve()}
 }
 const first=html.indexOf('let barcodeFallbackChain=Promise.resolve();');
 const last=html.indexOf('\nasync function batchLookUp(row){',first);
 assert.ok(first>=0&&last>first);
 const code=html.slice(first,last);
 const sandbox={window:{Html5Qrcode:FastBarcode,Html5QrcodeSupportedFormats:{EAN_13:1,UPC_A:2,CODE_128:3}},
  Html5Qrcode:FastBarcode,clean:x=>String(x),normalizeIsbn:x=>x,validIsbn:x=>x===isbn,
  Promise,Array,Set,Map,console};
 vm.createContext(sandbox);
 vm.runInContext(code+'\nthis.decodeFast=decodeBatchBarcode;',sandbox);
 assert.equal(await sandbox.decodeFast({name:'back.jpg'}, {fast:true}),isbn);
 assert.equal(uses,1);assert.equal(clears,1);
});

test('progress UI never marks cloud saves completed while they are still being confirmed',()=>{
 assert.match(ui,/const saving=\/saving\|confirming\|syncing/);
 assert.match(ui,/const success=\/\^\(\?:completed:/);
 assert.match(ui,/const observer=new MutationObserver\(queueRefresh\)/);
 assert.match(html,/if\(route!==\x27inventory\x27\)\{/);
 assert.match(html,/if\(!row\.thumbnailData&&row\.file\)row\.thumbnailData=await reviewThumbnail/);
});

test('the premium scan progress card has fixed desktop/mobile heights and clipped status lines',()=>{
 assert.match(css,/#shelfScan \.scan-auto-progress-shell \.premium-progress\{[\s\S]+?height:166px!important;min-height:166px!important;max-height:166px!important/);
 assert.match(css,/#shelfScan #batchStatus\{[\s\S]+?-webkit-line-clamp:2!important/);
 assert.match(css,/@media\(max-width:540px\)\{[\s\S]+?height:181px!important;min-height:181px!important;max-height:181px!important/);
 assert.match(html,/library-manager-v542\.css\?v=5\.53\.0/);
});
