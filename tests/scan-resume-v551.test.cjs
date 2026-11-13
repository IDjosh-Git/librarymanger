'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../assets/library-manager-v542.css'),'utf8');
const guard=require('../assets/scan-upload-dedup');

// IndexedDB-shaped transactional harness: each operation is async and the backing
// object survives module reload, just like persisted browser storage.
class FakeDatabase{
 constructor(){this.stores=new Map();this.objectStoreNames={contains:n=>this.stores.has(n)}}
 createObjectStore(name){this.stores.set(name,new Map())}
 close(){}
 transaction(names,mode){const db=this,tx={oncomplete:null,onabort:null,onerror:null},stores=Array.isArray(names)?names:[names];let active=0,complete=false;
  function settle(){queueMicrotask(()=>{if(active===0&&!complete){complete=true;tx.oncomplete?.()}})}
  tx.objectStore=name=>{if(!stores.includes(name))throw Error('Store was not opened in transaction');const data=db.stores.get(name);if(!data)throw Error('Missing object store');
   const op=(type,k,value)=>{active++;const req={result:undefined,onsuccess:null,onerror:null};queueMicrotask(()=>{if(type==='get')req.result=structuredClone(data.get(k));else if(type==='put')data.set(k,structuredClone(value));else data.delete(k);req.onsuccess?.();active--;settle()});return req};
   return {get:k=>op('get',k),put:(v,k)=>op('put',k,v),delete:k=>op('delete',k)};
  };return tx;
 }
}
class FakeIndexedDB{
 constructor(){this.database=null}
 open(name,version){const req={onupgradeneeded:null,onsuccess:null,onerror:null,result:null};queueMicrotask(()=>{const created=!this.database;this.database??=new FakeDatabase();req.result=this.database;if(created)req.onupgradeneeded?.();req.onsuccess?.()});return req}
}
function apiWithDB(indexedDB){globalThis.indexedDB=indexedDB;const modulePath=require.resolve('../assets/scan-resume.js');delete require.cache[modulePath];return require(modulePath)}

test('IndexedDB scan recovery survives a simulated refresh and preserves original copy IDs',async()=>{
 const idb=new FakeIndexedDB(),owner='member-a',api=apiWithDB(idb);
 const items=[{path:'covers/a.jpg',saveRecordId:'copy-a',file:{name:'a.jpg',size:10},shelf:'A',source:'folder'},
              {path:'covers/b.jpg',saveRecordId:'copy-b',file:{name:'b.jpg',size:11},shelf:'B',source:'folder'}];
 await api.begin(owner,items,'folder');const first=await api.read(owner);await api.markDone(owner,0,'saved',first.id);
 const reloaded=apiWithDB(idb),stored=await reloaded.load(owner);
 assert.deepEqual(stored.job.done,[0]);assert.equal(stored.entries[1].saveRecordId,'copy-b');
 assert.equal(stored.entries[1].file.name,'b.jpg');
 const pending=stored.entries.filter(row=>!stored.job.done.includes(row.index));assert.deepEqual(pending.map(row=>row.index),[1]);
 await reloaded.markDone(owner,1,'review',first.id);const history=await reloaded.finish(owner);
 assert.deepEqual([history.saved,history.review,history.total],[1,1,2]);assert.equal(await reloaded.read(owner),null);
 assert.equal((await reloaded.history(owner)).finishedAt,history.finishedAt);
});

test('recovery is account-scoped and stale callbacks cannot mutate a newer job',async()=>{
 const idb=new FakeIndexedDB(),api=apiWithDB(idb);
 const item={path:'image.jpg',saveRecordId:'copy-1',file:{name:'image.jpg',size:42}};
 const first=await api.begin('one',[item],'photos');assert.equal(await api.read('two'),null);
 await api.discard('one');const next=await api.begin('one',[item],'photos');
 await api.markDone('one',0,'saved',first.id);
 assert.deepEqual((await api.read('one')).done,[]);
 await api.markDone('one',0,'saved',next.id);assert.deepEqual((await api.read('one')).done,[0]);
 await api.discard('one');assert.equal(await api.read('one'),null);
});

test('a confirmed 100% scan is kept for six hours and expires afterward',async()=>{
 const idb=new FakeIndexedDB(),api=apiWithDB(idb),owner='member-c';
 const j=await api.begin(owner,[{path:'b.jpg',file:{name:'b.jpg'}}],'photos');
 await api.markDone(owner,0,'skipped',j.id);await api.finish(owner);
 assert.equal((await api.history(owner)).skipped,1);
 const history=idb.database.stores.get('history').get(owner);history.finishedAt=Date.now()-api.HISTORY_MS-1;
 assert.equal(await api.history(owner),null);
});

test('restored photo record ID can reclaim its own fresh cloud claim without waiting ten minutes',async()=>{
 const signatures='sha256:'+'a'.repeat(64),owner='user1',id='record1';
 class Query{constructor(db,table){this.db=db;this.table=table;this.op='select';this.tests=[];this.fields='*'}
  select(fields='*'){this.fields=fields;return this}upsert(rows){this.op='upsert';this.rows=rows;return this}update(values){this.op='update';this.values=values;return this}
  eq(k,v){this.tests.push(x=>x[k]===v);return this}in(k,values){this.tests.push(x=>values.includes(x[k]));return this}lt(k,v){this.tests.push(x=>x[k]<v);return this}
  then(ok,err){return Promise.resolve().then(()=>{const array=this.db.tables[this.table];let found;if(this.op==='upsert'){found=this.rows.filter(x=>!array.some(old=>old.fingerprint===x.fingerprint));array.push(...found)}else{found=array.filter(row=>this.tests.every(t=>t(row)));if(this.op==='update')found.forEach(row=>Object.assign(row,this.values))}const columns=this.fields==='*'?null:this.fields.split(',');return {data:found.map(row=>columns?Object.fromEntries(columns.map(k=>[k,row[k]])):{...row}),error:null}}).then(ok,err)}
 }
 const db={tables:{library_scan_files:[{fingerprint:signatures,uploaded_by:owner,record_id:id,status:'processing',updated_at:new Date().toISOString()}],library_books:[],library_review_queue:[]},from(t){return new Query(this,t)}};
 const item={sourceSignature:signatures,saveRecordId:id,resumeSession:true};
 const result=await guard.register(db,owner,[item]);assert.equal(result.accepted.length,1);assert.equal(result.recovered,1);
 const another=await guard.register(db,owner,[{...item,resumeSession:false}]);assert.equal(another.accepted.length,0);
});

test('scan and Review are wired for browser restoration, reconnect, title-safe idempotency and recent history',()=>{
 assert.match(html,/assets\/scan-resume\.js\?v=5\.51/);
 for(const phrase of ['restoreResumableScan(true)','scanRecoveryBar','scanRecentSummary','scanResumeNow','scanCheckpointDone','scanRetryAttempts','scanResumeStore.begin','scanResumeStore.finish'])assert.ok(html.includes(phrase),phrase);
 assert.match(html,/row\.saved=true;row\.selected=false;row\.reviewStaged=false/);
 assert.match(html,/reviewCardJobs\.set\(id,job\)/);
 assert.match(css,/#shelfScan \.scan-recent-counters/);
 assert.match(css,/#shelfScan \.scan-recovery-bar/);
});


test('resumed covers recheck actual cloud signatures rather than assuming locally staged reviews are saved',()=>{
 const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
 assert.match(html,/const knownPhotos=new Set\(originalQueue\.some\(item=>item\.resumeSession\)\?\[\]:batchItems\.map/);
});
