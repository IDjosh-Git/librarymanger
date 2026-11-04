'use strict';
// Isolated integration exercise of the exact production scan/save functions;
// Supabase is mocked so production inventory is never modified.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sleep=n=>new Promise(resolve=>setTimeout(resolve,n));
function grab(name){
 const start=source.indexOf(`async function ${name}(`);
 assert(start>=0,`missing ${name}`);
 const end=source.indexOf('\n}\n',start);
 assert(end>start,`end of ${name}`);
 return source.slice(start,end+3);
}
async function scanningTest(){
 let id=0,snapshots=[];
 const payload=[{file:{name:'a.jpg'},path:'A/a.jpg',shelf:'A-1'}, {file:{name:'b.jpg'},path:'A/b.jpg',shelf:'A-1'}];
 const progress={value:0,max:0},owner='user-a';
 const c={
   session:{user:{id:owner}},batchActive:false,batchSaving:false,batchZipLoading:false,batchQueue:payload,batchStopRequested:false,batchItems:[],
   reviewDraftVersion:1,scanCheckpointAt:0,scanCheckpointSync:Promise.resolve(),
   $:id=>id==='batchProgress'?progress:id==='batchUseOCR'?{checked:false}:null,
   renderBatch(){},batchOutput(){},warmupOCR(){},
   maxOCRWorkers(){return 2},uuid(){return '00000000-0000-4000-8000-'+String(++id).padStart(12,'0')},
   reviewThumbnail:async()=>'thumbnail',
   decodeBatchBarcode:async f=>{await sleep(f.name==='a.jpg'?6:90);return '9780143127741'},
   batchLookUp:async row=>{row.title='A sample book';row.authors='A. Reader';return true},
   enrichScanFromImage:async()=>{},
   batchDuplicate:()=>false,batchValid:()=>false,refreshBatchDuplicates(){},
   persistReviewDraft:async(_owner,_version)=>{snapshots.push(c.batchItems.map(x=>x.saveRecordId));},
   requestAnimationFrame:cb=>setTimeout(cb,0),Date,Array,Promise,Map,console,setTimeout,
   authGeneration:1,reviewPage:1
 };
 const ctx=vm.createContext(c);
 vm.runInContext(source.slice(source.indexOf('// Throttled, durable checkpoints'),source.indexOf('function batchSelectAll(){')),ctx);
 const task=ctx.runBatch();
 await sleep(28);
 assert.equal(c.batchItems.length,1,'the first completed photo must already be visible in Review');
 await task;
 assert.equal(c.batchItems.length,2);
 assert.equal(new Set(c.batchItems.map(x=>x.saveRecordId)).size,2,'physical copies need distinct permanent IDs');
 assert.equal(progress.value,2);
 assert(snapshots.at(-1).length===2,'a complete batch must be checkpointed');
 assert(c.batchItems.every(x=>x.title==='A sample book'));
 console.log('PASS incremental scan checkpoint, unique copy IDs, completed-review persistence');
}
async function savingTest(){
 let nextBook=0, cloudDeletes=[],rendered=[],records=[];
 const owner='user-a';
 const sourceRows=[
  {saveRecordId:'00000000-0000-4000-8000-000000000001',barcode:'9780143127741',title:'A sample book',authors:'A. Reader',shelf:'A-1',selected:true,saved:false,reviewApproval:'confirmed',lookup_status:'Verified'},
  {saveRecordId:'00000000-0000-4000-8000-000000000002',barcode:'9780143127741',title:'A sample book',authors:'A. Reader',shelf:'A-1',selected:true,saved:false,reviewApproval:'confirmed',lookup_status:'Verified'}
 ];
 const progress={max:0,value:0};
 const makeQuery=()=>{
  let insertPayload, recordID;
  return {
   insert(v){insertPayload=v;return this},select(){return this},eq(field,value){if(field==='record_id')recordID=value;return this},
   then(resolve){
    if(insertPayload){const rows=Array.isArray(insertPayload)?insertPayload:[insertPayload];
     const saved=rows.map(row=>{const found=records.find(x=>x.record_id===row.record_id);if(found)return found;const entry={...row,book_id:`LIB-${String(++nextBook).padStart(6,'0')}`};records.push(entry);return entry});return Promise.resolve(resolve({data:saved,error:null}));}
    return Promise.resolve(resolve({data:records.find(r=>r.record_id===recordID)||null,error:null}));
   },
   async single(){return {data:records.find(r=>r.record_id===recordID),error:null}}
  };
 };
 const c={
  batchActive:false,batchSaving:false,batchZipLoading:false,batchExcelLoading:false,session:{user:{id:owner}},
  batchItems:sourceRows,BOOKS:'library_books',books:[],Date,Array,Promise,Map,Set,console,
  reviewSavePlan:(items)=>({selected:items.filter(x=>x.selected&&!x.saved),message:'Save copies?'}),
  refreshBatchDuplicates(){for(const x of sourceRows)x.duplicate=true},
  confirm:()=>true,renderBatch(){},batchOutput(){},
  clean:value=>String(value||'').trim(),
  sb:{from(name){assert.equal(name,'library_books');return makeQuery()}},
  $:id=>id==='batchProgress'?progress:null,
  deleteCloudReview:async keys=>{cloudDeletes=keys},
  reloadAll:async()=>{c.books=records.slice()},
  renderScannedBooks:()=>{rendered=records.filter(x=>x.scan_date).slice()},
  uuid:()=>{throw Error('Existing stable IDs must be reused')}
 };
 const ctx=vm.createContext(c);vm.runInContext(grab('saveBatch'),ctx);
 await ctx.saveBatch();
 assert.equal(records.length,2,'two physical copies with identical ISBN must be inserted');
 assert.equal(new Set(records.map(r=>r.record_id)).size,2);
 assert.equal(new Set(records.map(r=>r.book_id)).size,2);
 assert.equal(rendered.length,2,'all saved scans must appear in saved register');
 assert.equal(cloudDeletes.length,2,'saved review rows should be cleaned up');
 const grouped=require(path.join(root,'lib/inventory-grouping.cjs'));
 const groups=grouped.groupBooks(records,new Date().toISOString().slice(0,10));
 assert.equal(groups.length,1,'inventory should group the two matching ISBN copies');
 assert.equal(groups[0].totalCopies,2);
 await ctx.saveBatch();assert.equal(records.length,2,'second save must not duplicate already saved rows');
 console.log('PASS Supabase mock: two distinct copies, Inventory grouping, Scanned Books, no duplicate saves');
}
(async()=>{await scanningTest();await savingTest()})().catch(e=>{console.error(e);process.exitCode=1});
