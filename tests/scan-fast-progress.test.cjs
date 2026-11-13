const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const progress=require('../assets/scan-progress');
const stream=require('../assets/scan-stream');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'../assets/premium-progress-upload.js'),'utf8');

test('large batch shows nonzero progress as soon as the first image is prepared',()=>{
 const first=progress.snapshot({total:117,prepared:1,checked:0,finished:0});
 assert.ok(first.percentage>0&&first.percentage<1);
 const cloud=progress.snapshot({total:117,prepared:1,checked:1,finished:0});
 assert.ok(cloud.percentage>first.percentage);
 const recognized=progress.snapshot({total:117,prepared:1,checked:1,finished:1});
 assert.ok(recognized.percentage>cloud.percentage);
 assert.equal(progress.snapshot({total:117,prepared:117,checked:117,finished:117}).percentage,100);
});

test('progress is bounded and never reports 100% before every photo completes',()=>{
 for(const raw of [{total:117,prepared:117,checked:117,finished:0},{total:117,prepared:117,checked:117,finished:116},{total:10,prepared:10000,checked:999,finished:9}]){
  const state=progress.snapshot(raw);assert.ok(state.percentage<100&&state.percentage>=0);
 }
 assert.equal(progress.snapshot({total:0}).percentage,0);
});

test('117-photo pipeline can report preparation before first OCR scan finishes',async()=>{
 const photos=Array.from({length:117},(_,i)=>i),snapshots=[];let prepared=0,checked=0,finished=0;
 await stream.run({items:photos,chunkSize:offset=>offset===0?1:12,workers:2,
  prepare:async items=>{prepared+=items.length;snapshots.push(progress.snapshot({total:photos.length,prepared,checked,finished}));return {accepted:items,skipped:0}},
  claim:async items=>({accepted:items,skipped:[]}),
  onChunk:details=>{checked=details.checked;snapshots.push(progress.snapshot({total:photos.length,prepared,checked,finished}))},
  scan:async()=>{finished++;snapshots.push(progress.snapshot({total:photos.length,prepared,checked,finished}))}});
 assert.ok(snapshots[0].percentage>0);
 assert.equal(snapshots.at(-1).percentage,100);
 assert.ok(snapshots.some(x=>x.checked>0&&x.finished===0));
});

test('automatic bulk scanning has quicker recognition while manual retries remain full',()=>{
 assert.match(html,/decodeBatchBarcode\(item\.file,\{fast:true\}\)/);
 assert.match(html,/enrichScanFromImage\(row,\{fast:true\}\)/);
 assert.match(html,/if\(window\.Html5Qrcode\&\&\(!fast\|\|typeof BarcodeDetector===\x27undefined\x27\)\)/);
 assert.match(html,/enrichScanFromImage\(row,\{mode:withOCR===/);
 assert.match(ui,/scanPrepared/);
 assert.match(ui,/scanScanned/);
});

test('title search preserves full provider list for manual lookups and has 2-provider fast path',()=>{
 const lookup=fs.readFileSync(path.join(__dirname,'../lib/title-search.cjs'),'utf8');
 const handler=fs.readFileSync(path.join(__dirname,'../api/title-search.js'),'utf8');
 assert.match(lookup,/fast\?tasks\.slice\(0,2\):tasks/);
 assert.match(handler,/fast\?2500:6500/);
 assert.match(html,/findOCRCatalogMatches\(row,\{fast\}\)/);
});
