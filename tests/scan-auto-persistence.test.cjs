'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf('const scanAutoRoute=globalThis.LibraryScanAutoRoute;'),html.indexOf('const batchMetadataCache=new Map();'));
const route=require('../assets/scan-auto-route');
const OWNER='16a99b75-d7e5-40e9-8c3e-82802680a655';
function setup({failBulk=false,failSingle=false,duplicate=false}={}){
 let statuses=[],cloudDeletes=[],payloads=[];
 const row={title:'Cover Book',authors:'The Writer',barcode:'9780143127741',verifiedSource:'isbn',saveRecordId:'0c4a9441-d3d1-429f-83a6-7016ca8bc73a',sourceSignature:'sha256:'+'a'.repeat(64),file:null,reviewStaged:false,autoHandled:true,autoState:'saving'};
 const ui={};for(const id of ['scanAutoSavedCount','scanAutoReviewCount','scanAutoSkippedCount','scanAutoOutcome','scanAutoErrorMessage'])ui[id]={textContent:'',dataset:{},hidden:false};
 const mockDB={from(){return {
  insert(input){payloads.push(input);return {select(){
   if(Array.isArray(input))return Promise.resolve(failBulk?{data:null,error:{code:'23505',message:'duplicate'}}:{data:[{record_id:row.saveRecordId,book_id:'BK1',user_id:OWNER}],error:null});
   return {single:async()=>failSingle||duplicate?{error:{code:duplicate?'23505':'400',message:'insert failed'},data:null}:{error:null,data:{record_id:row.saveRecordId,book_id:'BK1',user_id:OWNER}}};
  }}},
  select(){let field='';return {eq(k,v){field=k;return this},maybeSingle(){return Promise.resolve({data:field==='source_signature'&&duplicate?{record_id:'original',source_signature:row.sourceSignature}:null,error:null})}}}
 }}};
 const ctx={
  globalThis:{LibraryScanAutoRoute:route},batchItems:[row],batchImageUrls:new Map(),
  autoScanSession:{saved:0,review:0,failed:0,skipped:0,total:1},
  $:id=>ui[id],session:{user:{id:OWNER}},authGeneration:0,sb:mockDB,BOOKS:'library_books',
  scanUploadGuard:{changeStatus:async(_,owner,rows,status)=>statuses.push({owner,rows,status})},
  deleteCloudReview:async ids=>cloudDeletes.push(ids),renderBatch:()=>{},
  console,URL:{revokeObjectURL:()=>{}},setTimeout,clearTimeout
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,row,ui,stats:()=>vm.runInContext('autoScanSession',ctx),statuses,cloudDeletes,payloads,commit:()=>vm.runInContext('autoCommitRows(batchItems,"'+OWNER+'",0)',ctx),review:()=>vm.runInContext('markAutoReviewConfirmed([{saveRecordId:batchItems[0].saveRecordId}])',ctx)};
}
test('cloud-confirmed bulk insert immediately marks inventory saved, then resolves review key',async()=>{
 const s=setup();await s.commit();assert.equal(s.row.saved,true);assert.equal(s.stats().saved,1);assert.equal(s.stats().review,0);
 assert.equal(s.statuses.length,1);assert.equal(s.statuses[0].status,'saved');assert.equal(s.cloudDeletes.length,1);
 assert.equal(s.ui.scanAutoSavedCount.textContent,'1');
});
test('failed auto-save does not claim Inventory success and leaves row for cloud Review',async()=>{
 const s=setup({failBulk:true,failSingle:true});await s.commit();assert.equal(!!s.row.saved,false);
 assert.equal(s.row.reviewStaged,true);assert.match(s.row.saveError,/failed/i);
 assert.equal(s.stats().saved,0);assert.equal(s.stats().review,0);assert.equal(s.stats().failed,1);
 assert.equal(s.cloudDeletes.length,0);assert.equal(s.statuses.length,0);
 s.review();assert.equal(s.stats().review,1);s.review();assert.equal(s.stats().review,1);
});
test('same image saved elsewhere is counted as skipped, not inserted twice',async()=>{
 const s=setup({failBulk:true,duplicate:true});await s.commit();assert.equal(s.row.saved,true);
 assert.equal(s.stats().skipped,1);assert.equal(s.stats().saved,0);
 assert.equal(s.cloudDeletes.length,0);assert.equal(s.statuses.length,0);
});
