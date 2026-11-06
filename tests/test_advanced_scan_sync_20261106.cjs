'use strict';
const fs=require('fs');
const vm=require('vm');
const assert=require('node:assert/strict');
const path=require('path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const styles=fs.readFileSync(path.join(root,'assets/library-ui.css'),'utf8');
function extract(name){
 const regex=new RegExp('(?:async )?function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}', 'm');
 const match=source.match(regex);assert(match,`Missing ${name}`);return match[0];
}
async function run(){
 // One physical copy saved on another device must leave review; an ISBN duplicate
 // with its own distinct record_id MUST stay pending as an additional copy.
 const done=[],imageReleases=[],files=new Map();
 const context={
  books:[{record_id:'saved-100',barcode:'9781234567897'}],
  batchItems:[
   {saveRecordId:'saved-100',barcode:'9781234567897'},
   {saveRecordId:'new-200',barcode:'9781234567897'},
   {saveRecordId:'saved-100',importAction:'UPDATE',updateTargetId:'saved-100'}
  ],
  batchImageUrls:files,URL:{revokeObjectURL:x=>imageReleases.push(x)},
  deleteCloudReview:async keys=>{done.push(...keys)},scheduleReviewDraftSave:()=>{context.draftSaves++},draftSaves:0,
  Set,console,Number,String
 };
 vm.createContext(context);vm.runInContext(extract('reconcileSavedScanRows'),context);
 const count=vm.runInContext('reconcileSavedScanRows()',context);assert.equal(count,1);
 assert.deepEqual(context.batchItems.map(x=>x.saveRecordId),['new-200','saved-100']);
 assert.equal(context.draftSaves,1);
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(done,['saved-100']);

 // ISBN auto-enrichment may prefill a title, but must not automatically INSERT into inventory.
 const isbnRow={saveRecordId:'pending-isbn',barcode:'9780306406157',title:'',saved:false,selected:false,reviewBusy:false,file:null,reviewUpdatedAt:0};
 const fallbackRow={saveRecordId:'pending-ai',barcode:'9780143127741',title:'',saved:false,selected:false,reviewBusy:false,thumbnailData:'data:image/jpeg;base64,AA',reviewUpdatedAt:0};
 const alreadyTitled={saveRecordId:'already-titled',barcode:'9780306406157',title:'Title Known',saved:false,selected:true};
 const events=[];
 const c2={
  session:{user:{id:'u1'}},authGeneration:1,batchActive:false,batchSaving:false,batchZipLoading:false,batchExcelLoading:false,
  batchItems:[isbnRow,fallbackRow,alreadyTitled],books:[],autoISBNChecked:new Set(),isbnAutoJob:null,
  validIsbn:x=>String(x).startsWith('978'),normalizeIsbn:x=>x,hasBookTitle:t=>!!String(t||'').trim(),
  $:id=>({checked:true}),
  batchLookUp:async row=>{events.push('lookup:'+row.saveRecordId);if(row===isbnRow)row.title='Verified catalog title'},
  reviewSourceFile:async()=>({name:'cover.jpg'}),readCoverWithAI:async row=>{events.push('ai:'+row.saveRecordId);row.title='AI recognized cover';return true},
  batchOutput:x=>events.push(x),renderBatch:()=>events.push('render'),
  Date,Math,Set,Promise,String,console
 };
 vm.createContext(c2);vm.runInContext(extract('autoEnrichISBNReviews'),c2);
 await vm.runInContext('autoEnrichISBNReviews()',c2);
 assert.equal(isbnRow.title,'Verified catalog title');assert.equal(fallbackRow.title,'AI recognized cover');
 assert.equal(isbnRow.selected,false);assert.equal(fallbackRow.selected,false);
 assert.equal(alreadyTitled.title,'Title Known');assert.equal(alreadyTitled.selected,true);
 assert.equal(c2.books.length,0);
 assert(events.includes('ai:pending-ai'));
 const prev=events.length;
 await vm.runInContext('autoEnrichISBNReviews()',c2);assert.equal(events.length,prev);
 // UI requirements: cloud refresh, bulk mark+save, visibly grouped advanced tools.
 for(const id of ['scanRefreshCloud','batchSaveAllReady','batchEnrichAll','scanAdvancedTools','scanCloudLastSync'])assert(source.includes(`id="${id}"`),id);
 assert(source.includes("reconcileSavedScanRows()"));
 assert(source.includes('await reloadAll({background:true,force:true})'));
 assert(source.includes('only matching')===false||source.includes('record_id'));
 assert(styles.includes('#shelfScan .scan-tool-card'));
 assert(styles.includes('.scan-selection-tools button.scan-save-all'));
 assert(styles.includes('grid-template-columns:minmax(0,1fr)'));
 console.log('PASS: cross-device unique-ID reconciliation, ISBN / AI autofill without auto-saving, mobile advanced controls');
}
run().catch(e=>{console.error(e);process.exit(1)});
