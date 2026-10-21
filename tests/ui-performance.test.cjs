const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const grouping=require('../lib/inventory-grouping.cjs');
const groupingSource=html.slice(html.indexOf('let inventoryGroupCache='),html.indexOf('function inventoryGroupQuality('));
function groupHarness(){
 let calls=0,renders=0,day='2026-10-20',id=0;const timers=new Map();
 const c=vm.createContext({books:[{record_id:'one',barcode:'9780140328721',book_status:'Available'}],
 today:()=>day,session:{user:{id:'alice'}},authGeneration:0,
 LibraryInventoryGrouping:{groupBooks(...args){calls++;return grouping.groupBooks(...args)}},
 setTimeout(fn){timers.set(++id,fn);return id},clearTimeout(id){timers.delete(id)},renderBooks(){renders++}});
 vm.runInContext(groupingSource+';globalThis.groups=inventoryGroups;globalThis.schedule=scheduleBookRender;',c);
 return {c,calls:()=>calls,renders:()=>renders,timers,setDay:d=>day=d,flush(){const jobs=[...timers.values()];timers.clear();jobs.forEach(fn=>fn())}};
}
test('repeated inventory/dashboard reads reuse groups, data replacement invalidates them',()=>{
 const h=groupHarness(),first=h.c.groups();
 for(let i=0;i<50;i++)assert.equal(h.c.groups(),first);
 assert.equal(h.calls(),1);
 h.c.books=h.c.books.map(b=>({...b,shelf_location:'A',book_status:'Borrowed',due_date:'2026-10-20'}));
 assert.equal(h.c.groups()[0].borrowedCopies,1);assert.equal(h.c.groups()[0].shelves[0],'A');assert.equal(h.calls(),2);
 h.setDay('2026-10-21');assert.equal(h.c.groups()[0].overdueCopies,1);assert.equal(h.calls(),3);
 h.c.books=[];assert.equal(h.c.groups().length,0);
});
test('a burst of search input renders once and account changes cancel stale callbacks',()=>{
 const h=groupHarness();for(let i=0;i<10;i++)h.c.schedule();
 assert.equal(h.timers.size,1);assert.equal(h.renders(),0);h.flush();assert.equal(h.renders(),1);
 h.c.schedule();h.c.authGeneration++;h.flush();assert.equal(h.renders(),1);
 h.c.session=null;h.c.schedule();h.flush();assert.equal(h.renders(),1);
});
const reviewSource=html.slice(html.indexOf('async function restoreReviewDraft('),html.indexOf('function batchShelf('));
function reviewHarness(initial=[]){
 let resolveCloud,renders=0;const statuses=[];
 const c=vm.createContext({session:{user:{id:'alice'}},authGeneration:0,reviewDraftLoadedFor:null,
 batchItems:initial,books:[],reviewRemoteHashes:new Map(),console,
 reviewRowKey:x=>x.saveRecordId,reviewDraftOperation:async()=>({rows:[]}),
 fetchCloudReview:()=>new Promise(resolve=>{resolveCloud=resolve}),
 reviewStatus:(...v)=>statuses.push(v),batchOutput(){},renderBatch(){renders++}});
 vm.runInContext(reviewSource+';globalThis.restore=restoreReviewDraft;',c);
 return {c,statuses,renders:()=>renders,flush:()=>new Promise(r=>setImmediate(r)),finish:rows=>resolveCloud(rows)};
}
test('background restore preserves current edits and newly scanned rows',async()=>{
 const h=reviewHarness([{saveRecordId:'old',title:'Before',reviewUpdatedAt:1}]);const p=h.c.restore();await h.flush();
 h.c.batchItems[0].title='Edited while loading';h.c.batchItems.push({saveRecordId:'new',title:'New scan'});
 h.finish([{data:{saveRecordId:'old',title:'Cloud',reviewUpdatedAt:99}},{data:{saveRecordId:'remote',title:'Recovered'}}]);await p;
 assert.equal(h.c.batchItems.find(x=>x.saveRecordId==='old').title,'Edited while loading');
 assert.ok(h.c.batchItems.some(x=>x.saveRecordId==='new'));assert.ok(h.c.batchItems.some(x=>x.saveRecordId==='remote'));
});
test('background restore does not resurrect removed rows or newly saved copies',async()=>{
 const h=reviewHarness([{saveRecordId:'removed'}]);const p=h.c.restore();await h.flush();
 h.c.batchItems=[];h.c.books=[{record_id:'saved'}];
 h.finish([{data:{saveRecordId:'removed'}},{data:{saveRecordId:'saved'}}]);await p;
 assert.equal(h.c.batchItems.length,0);
});
test('a saved book UPDATE correction remains in Review until explicitly saved',async()=>{
 const h=reviewHarness();const p=h.c.restore();await h.flush();
 h.c.books=[{record_id:'existing'}];h.c.batchItems=[{saveRecordId:'existing',importAction:'UPDATE',title:'Correction'}];
 h.finish([]);await p;assert.equal(h.c.batchItems.length,1);assert.equal(h.c.batchItems[0].title,'Correction');
});
test('a previous login cannot restore review data after same-user reauthentication',async()=>{
 const h=reviewHarness();const p=h.c.restore();await h.flush();h.c.authGeneration++;
 h.finish([{data:{saveRecordId:'stale'}}]);await p;
 assert.equal(h.c.batchItems.length,0);assert.equal(h.renders(),0);assert.equal(h.statuses.length,0);
});
