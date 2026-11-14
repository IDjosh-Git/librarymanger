'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const migration=fs.readFileSync(path.join(__dirname,'../database/12_shared_admin_review_queue.sql'),'utf8');
const makeId=n=>`eefe31db-3947-49b8-81ea-${String(n).padStart(12,'0')}`;
const start=html.indexOf('async function fetchCloudReview(owner){'),end=html.indexOf('function openReviewStore(){',start);
assert.ok(start>0&&end>start);
const source=html.slice(start,end);
function env(role,rows){
 const operations=[],owner='admin-A',cache=new Map(),ownership=new Map(),bookRows=[],statuses=[];
 const sb={from(table){return {
  filter:[],payload:null,op:null,
  select(fields){this.fields=fields;return this},
  eq(k,v){this.filter.push([k,v]);return this},
  order(){return this},range(s,e){this.limit=[s,e];return this},
  upsert(payload){this.op='upsert';this.payload=payload;return this},
  update(payload){this.op='update';this.payload=payload;return this},
  then(resolve,reject){
   const filtered=rows.filter(x=>this.filter.every(([k,v])=>String(x[k])===String(v)));
   operations.push({table,op:this.op||'select',filter:this.filter.slice(),payload:this.payload});
   let data;
   if(this.op==='update'){
    for(const row of filtered)Object.assign(row,this.payload);
    data=filtered.map(x=>({review_key:x.review_key}));
   }else if(this.op==='upsert'){
    const input=Array.isArray(this.payload)?this.payload:[this.payload];
    for(const record of input){const i=rows.findIndex(x=>x.user_id===record.user_id&&x.review_key===record.review_key);if(i>=0)Object.assign(rows[i],record);else rows.push({...record});}
    data=input;
   }else data=filtered.slice(this.limit?.[0]||0,(this.limit?.[1]??200)+1).map(row=>Object.fromEntries((this.fields||'').split(',').map(k=>[k,row[k]])));
   return Promise.resolve({data,error:null}).then(resolve,reject);
  }
 }}};
 const ctx={sb,REVIEW_QUEUE:'library_review_queue',books:bookRows,console,Date,session:{user:{id:owner}},
  reviewRemoteHashes:cache,reviewRemoteOwners:ownership,reviewCloudSync:Promise.resolve(),
  isAdmin:()=>role==='admin',validReviewKey:key=>/^[0-9a-f-]{36}$/.test(key),
  reviewSerializableRow:x=>({...x}),reviewStatus:(message)=>statuses.push(message)};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {owner,ctx,rows,operations,cache,ownership,statuses,
  fetch:()=>vm.runInContext('fetchCloudReview',ctx)(owner),
  resolved:()=>vm.runInContext('fetchCloudResolvedReviewKeys',ctx)(owner),
  remove:(keys)=>vm.runInContext('deleteCloudReview',ctx)(keys,owner),
  sync:(rows)=>vm.runInContext('syncCloudReview',ctx)(owner,rows)};
}
test('every administrator fetches all 92 pending records, without an uploader filter',async()=>{
 const rows=Array.from({length:92},(_,i)=>({user_id:i%2?'admin-B':'admin-A',review_key:makeId(i+1),data:{saveRecordId:makeId(i+1),title:'Book '+i},status:'pending',updated_at:'2026-11-14T00:00:00Z'}));
 const app=env('admin',rows);const list=await app.fetch();assert.equal(list.length,92);
 assert.ok(list.every(x=>x.user_id==='admin-A'||x.user_id==='admin-B'));
 const query=app.operations.find(op=>op.op==='select');assert.deepEqual(query.filter,[['status','pending']]);
});
test('non-admin member fetches only their own queue, never the team-wide records',async()=>{
 const rows=[{user_id:'admin-A',review_key:makeId(1),status:'pending'},{user_id:'admin-B',review_key:makeId(2),status:'pending'}];
 const app=env('user',rows);assert.equal((await app.fetch()).length,1);
 assert.ok(app.operations[0].filter.some(([k,v])=>k==='user_id'&&v==='admin-A'));
});
test('approving a teammate record resolves uploader row using UPDATE, never duplicates it',async()=>{
 const id=makeId(44),rows=[{user_id:'admin-B',review_key:id,data:{title:'A Book'},status:'pending'}],app=env('admin',rows);
 app.ownership.set(id,'admin-B');await app.remove([id]);
 assert.equal(rows.length,1);assert.equal(rows[0].status,'resolved');assert.equal(rows[0].user_id,'admin-B');
 assert.equal(app.operations.filter(x=>x.op==='upsert').length,0);
 assert.equal(app.operations.find(x=>x.op==='update').filter.find(x=>x[0]==='user_id')[1],'admin-B');
});
test('admin edits a teammate pending record in place, without changing its uploader',async()=>{
 const id=makeId(20),rows=[{user_id:'admin-B',review_key:id,data:{title:'Original'},status:'pending'}],app=env('admin',rows);
 app.ownership.set(id,'admin-B');
 await app.sync([{saveRecordId:id,reviewOwnerId:'admin-B',title:'Corrected title',saved:false}]);
 assert.equal(rows.length,1);assert.equal(rows[0].user_id,'admin-B');
 assert.equal(rows[0].data.title,'Corrected title');assert.equal(app.operations.some(x=>x.op==='upsert'),false);
});
test('already resolved teammate records are not revived by a stale edit',async()=>{
 const id=makeId(19),rows=[{user_id:'admin-B',review_key:id,data:{title:'Saved'},status:'resolved'}],app=env('admin',rows);
 app.ownership.set(id,'admin-B');await app.sync([{saveRecordId:id,reviewOwnerId:'admin-B',title:'Old draft',saved:false}]);
 assert.equal(rows[0].status,'resolved');assert.equal(rows.length,1);
});
test('shared Review database policies permit admin team read/edit but retain owner-only inserts and member isolation',()=>{
 assert.match(migration,/Review owner or administrator select/);
 assert.match(migration,/Review owner or administrator update/);
 assert.match(migration,/library_member_roles AS access/);
 assert.match(migration,/access\.role = 'admin'/);
 assert.doesNotMatch(migration,/DROP POLICY IF EXISTS "Review owner insert"/);
 assert.doesNotMatch(migration,/DROP POLICY IF EXISTS "Review owner delete"/);
 assert.match(html,/const reviewCounts=\{pending:reviewItems\.length/);
 assert.match(html,/navBadge\.textContent=String\(reviewCounts\.pending\)/);
 assert.match(html,/reviewStaged:true,matches:\[\]/);
 assert.match(html,/reviewOwnerId:row\.user_id/);
 assert.match(html,/if\(!isAdmin\(\)\)query=query\.eq\('user_id',owner\)/);
});

test('review restoration shows all 92 teammate uploads even when old cloud rows were not marked as reviewStaged',async()=>{
 const begin=html.indexOf('async function restoreReviewDraftRaw(force=false){'),finish=html.indexOf('function batchShelf(',begin);
 assert.ok(begin>0&&finish>begin);
 const owner='admin-A';const pending=Array.from({length:92},(_,i)=>({review_key:makeId(i+1),user_id:i%2?'admin-B':'admin-A',status:'pending',data:{saveRecordId:makeId(i+1),reviewStaged:false,title:i%3?'Recognised title':'',saved:false,reviewUpdatedAt:100+i}}));
 const context={session:{user:{id:owner}},authGeneration:2,reviewCardJobs:new Map(),reviewDraftLoadedFor:null,
  batchItems:[],books:[],reviewRemoteOwners:new Map(),reviewRemoteHashes:new Map(),Date,Set,Map,console,
  reviewDraftOperation:async()=>null,fetchCloudReview:async()=>pending,fetchCloudResolvedReviewKeys:async()=>[],
  reviewRowKey:x=>x?.saveRecordId||'',reviewSerializableRow:x=>({saveRecordId:x.saveRecordId,reviewOwnerId:x.reviewOwnerId,reviewStaged:x.reviewStaged,title:x.title}),
  reviewStatus:()=>{},batchOutput:()=>{},updateCloudScanStatus:()=>{},renderBatch:()=>{},scheduleReviewDraftSave:()=>{},
  reviewSaveTimer:null,lastCloudScanAt:0,document:{querySelector:()=>null}};
 vm.createContext(context);vm.runInContext(html.slice(begin,finish),context);
 await vm.runInContext('restoreReviewDraftRaw',context)(true);
 assert.equal(context.batchItems.length,92);
 assert.equal(context.batchItems.filter(x=>x.reviewStaged).length,92);
 assert.equal(context.batchItems.filter(x=>x.reviewOwnerId==='admin-B').length,46);
 assert.equal(context.reviewRemoteOwners.size,92);
 // A teammate's completed approval disappears after a cloud tombstone is fetched.
 const removedId=makeId(2);
 context.fetchCloudResolvedReviewKeys=async()=>[removedId];
 context.fetchCloudReview=async()=>pending.filter(row=>row.review_key!==removedId);
 await vm.runInContext('restoreReviewDraftRaw',context)(true);
 assert.equal(context.batchItems.length,91);
 assert.ok(!context.batchItems.some(x=>x.saveRecordId===removedId));
});

test('shared Review counts appear in desktop and mobile menus, with separate saved-needs-correction tally',()=>{
 assert.match(html,/id="reviewNavCount"/);
 assert.match(html,/id="mobileReviewNavCount"/);
 assert.match(html,/id="reviewPendingCount"/);
 assert.match(html,/id="reviewSavedAttentionCount"/);
 assert.match(html,/mobileNavBadge\.textContent=String\(reviewCounts\.pending\)/);
 assert.match(html,/Saved books needing correction/);
});
