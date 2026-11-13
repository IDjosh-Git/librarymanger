'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','assets','scan-review-premium-v539.css'),'utf8');
const deletionStart=html.indexOf('async function discardPendingReviewImage(index){');
const deletionEnd=html.indexOf("$('reviewSaveCorrected').onclick",deletionStart);
const deletionSource=html.slice(deletionStart,deletionEnd);
assert.ok(deletionSource.startsWith('async function discardPendingReviewImage(index){'));
const ROW_ID='f8d0c74e-18c2-49fd-9419-df886fdf69a7',OWNER='b19d3f4c-6310-47b6-a32f-24702e161ad0';
function mockDelete({saved=false,cloudError=false,confirmed=true,rowSaved=false}={}){
 const calls=[];const row={saveRecordId:ROW_ID,fileName:'bad-photo.jpg',title:'',saved:rowSaved,sourceSignature:'sha256:'+'a'.repeat(64),file:null};
 const scope={
  batchItems:[row],session:{user:{id:OWNER}},reviewDraftVersion:3,reviewCloudSync:Promise.resolve(),
  batchActive:false,batchSaving:false,batchZipLoading:false,batchExcelLoading:false,
  reviewRemoteHashes:new Map([[ROW_ID,'old']]),reviewDraftLastSignature:'old',
  batchImageUrls:new Map(),
  REVIEW_QUEUE:'library_review_queue', // invisible word joiner removed below
  BOOKS:'library_books',
  validReviewKey: key=>/^[0-9a-f-]{36}$/.test(key),
  confirm:()=>confirmed,
  renderBatch:()=>calls.push(['render']),
  persistReviewDraft:async(owner,version)=>{calls.push(['persist',owner,version]);return true},
  reviewRowKey:x=>String(x?.saveRecordId||''),
  reviewStatus:(message,type)=>{calls.push(['status',message,type])},
  $:id=>id==='reviewActionStatus'?{set textContent(x){calls.push(['action',x])}}:null,
  URL:{revokeObjectURL:()=>{}},
  console,
  sb:{from(table){
   const filters=[];
   const api={
    select(){return api},eq(field,val){filters.push(['eq',field,val]);return api},in(field,values){filters.push(['in',field,values]);return api},
    delete(){calls.push(['delete',table]);return api},
    upsert(record){calls.push(['upsert',table,record]);return api},
    async maybeSingle(){calls.push(['lookup',table,filters]);return {data:saved?{record_id:ROW_ID}:null,error:null}},
    async single(){return cloudError?{data:null,error:{message:'cloud unavailable'}}:{data:{status:'resolved'},error:null}},
    then(resolve,reject){return Promise.resolve({error:null}).then(resolve,reject)}
   };return api;
  }}
 };
 scope.REVIEW_QUEUE='library_review_queue';
 const context=vm.createContext(scope);
 vm.runInContext(deletionSource,context);
 return {row,calls,scope,discard:()=>context.discardPendingReviewImage(0)};
}
test('Scan has premium automatic workflow and no visible result tables',()=>{
 const scan=html.slice(html.indexOf('<div id="shelfScan"'),html.indexOf('<div id="review"'));
 assert.match(scan,/Scan books with ease/);
 assert.match(scan,/id="batchHeading"/);
 assert.equal((scan.match(/class="batch-head scan-auto-hero"/g)||[]).length,0);
 assert.match(scan,/id="jumpQuickAdd"/);
 assert.match(scan,/id="quickAddDrawer"/);
 assert.match(css,/#shelfScan \.shelf-page-hero/);
 assert.match(css,/backdrop-filter:blur/);
 assert.match(scan,/id="scanAutoSavedCount"/);
 assert.match(scan,/id="scanAutoReviewCount"/);
 assert.match(scan,/id="scanAutoOutcome"/);
 assert.match(scan,/id="scanInventoryJump"/);
 assert.match(scan,/id="scanOpenReview"/);
 assert.match(scan,/id="scanLegacyControls" hidden aria-hidden="true"/);
 assert.doesNotMatch(scan,/<table[\s>]/i);
 assert.doesNotMatch(scan,/Show table|Hide table|Save all ready books|Save selected/);
});
test('Scan automatically routes verified records, review stays manual for corrections',()=>{
 const body=html.slice(html.indexOf('async function runBatch(){'),html.indexOf('function batchSelectAll()'));
 assert.match(body,/const route=scanAutoRoute\.decide\(row\)/);
 assert.match(body,/if\(route==='inventory'\)queueAutomaticSave\(row,uploader,generation\)/);
 assert.match(body,/reviewUploads\.push\(item\)/);
 assert.match(body,/markAutoReviewConfirmed\(unresolved\)/);
 assert.match(html,/function queueAutomaticSave\(row,owner,generation\)/);
 assert.match(html,/const rows=batchItems\.filter\(x=>!x\.saved&&\(x\.reviewStaged\|\|!x\.autoHandled\)\)/);
 assert.match(html,/\$\('reviewSaveCorrected'\)\.onclick/);
});
test('Auto saving remains idempotent per photo and separate from Review edits',()=>{
 assert.match(fs.readFileSync(path.join(__dirname,'../assets/scan-auto-route.js'),'utf8'),/record_id:row\.saveRecordId/);
 assert.match(html,/await autoCommitRows\(group,owner,generation\)/);
 assert.match(html,/const saved=rows\.filter\(row=>row\.saved&&row\.autoState==='saved'\)/);
 assert.match(html,/changeStatus\(sb,owner,saved,'saved'\)/);
 assert.match(html,/await deleteCloudReview\(saved\.map\(row=>row\.saveRecordId\),owner\)/);
 assert.match(html,/row\.saved\|\|!row\.reviewStaged\|\|row\.reviewConfirmed/);
});
test('Review exposes Delete Image only for unsaved pending image cards',()=>{
 assert.match(html,/data-delete-review="\$\{i\}"/);
 assert.match(html,/Delete image/);
 assert.match(html,/if\(!row\|\|row\.saved\|\|!owner/);
 assert.match(html,/This will NOT delete any book already saved to Inventory/);
});
test('Deleted review image is cloud-resolved before local removal; fingerprint is reclaimed',async()=>{
 const a=mockDelete();await a.discard();
 assert.equal(a.scope.batchItems.length,0);
 const cloud=a.calls.findIndex(c=>c[0]==='upsert'&&c[1]==='library_review_queue');
 const remove=a.calls.findIndex(c=>c[0]==='delete'&&c[1]==='library_scan_files');
 assert.ok(cloud>=0&&remove>cloud,a.calls);
 assert.equal(a.calls.filter(c=>c[0]==='delete'&&c[1]==='library_books').length,0);
 assert.equal(a.calls.at(-1)[0],'render');
});
test('Cancel does not discard image or touch Supabase',async()=>{
 const a=mockDelete({confirmed:false});await a.discard();
 assert.equal(a.scope.batchItems.length,1);
 assert.equal(a.calls.filter(c=>c[0]==='upsert').length,0);
});
test('Saved inventory copy cannot be deleted through pending Review',async()=>{
 const a=mockDelete({saved:true});await a.discard();
 assert.equal(a.scope.batchItems.length,1);
 assert.equal(a.calls.filter(c=>c[0]==='upsert').length,0);
});
test('Cloud failure preserves pending row and reports an error',async()=>{
 const a=mockDelete({cloudError:true});await a.discard();
 assert.equal(a.scope.batchItems.length,1);
 assert.equal(a.calls.filter(c=>c[0]==='delete').length,0);
 assert.ok(a.calls.some(c=>c[0]==='status'&&c[2]==='error'));
});
test('Already saved review row is never eligible for Delete Image',async()=>{
 const a=mockDelete({rowSaved:true});await a.discard();
 assert.equal(a.scope.batchItems.length,1);
 assert.equal(a.calls.filter(c=>c[0]==='upsert').length,0);
});
test('Resolved cloud tombstones prevent removed review photos reappearing after device refresh',()=>{
 assert.match(html,/fetchCloudResolvedReviewKeys\(owner\)/);
 assert.match(html,/for\(const discarded of discardedKeys\)live\.delete\(discarded\)/);
 assert.match(html,/if\(item\.saved\|\|discardedKeys\.has\(key\)\)live\.delete\(key\)/);
 assert.match(html,/\.eq\('user_id',owner\)\.eq\('status','resolved'\)/);
});
test('Replacement image only receives pending cloud status after backup succeeds',()=>{
 assert.match(html,/const backedUp=await persistReviewDraft\(owner,reviewDraftVersion\)/);
 assert.match(html,/if\(!backedUp\)\{/);
 assert.match(html,/await scanUploadGuard\.changeStatus\(sb,owner,\[claimedPhoto\],'pending'\)/);
 assert.match(html,/\.eq\('fingerprint',oldSignature\)/);
});

test('premium heroes use photographs and glass cards; compact sidebar is scoped to signed-in desktop',()=>{
 assert.match(html,/class="shelf-page-image" aria-hidden="true"/);
 assert.match(html,/class="lm-review-hero-image" aria-hidden="true"/);
 assert.match(css,/#review \.lm-review-hero-image/);
 assert.match(css,/grid-template-columns:minmax\(0,272px\) minmax\(0,1fr\)/);
 assert.match(html,/Add book manually/);
 assert.match(html,/id="addManual"/);
 assert.doesNotMatch(html,/scan-auto-premium-v534\.css/);
});
