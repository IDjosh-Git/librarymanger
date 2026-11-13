/* v5.51 Durable client-side scan journal and six-hour completed-scan history.
   Photos stay in the user's browser (IndexedDB), never in localStorage or a new server.
   All writes are scoped to the authenticated user's id. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LibraryScanResume=api})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const DB='library-manager-scan-resume-v551',JOBS='jobs',PHOTOS='photos',HISTORY='history',HISTORY_MS=6*60*60*1000;
 function open(){return new Promise((resolve,reject)=>{if(!root?.indexedDB)return reject(Error('This browser does not support offline scan recovery.'));const request=root.indexedDB.open(DB,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(JOBS))db.createObjectStore(JOBS);if(!db.objectStoreNames.contains(PHOTOS))db.createObjectStore(PHOTOS);if(!db.objectStoreNames.contains(HISTORY))db.createObjectStore(HISTORY)};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error('Unable to open scan recovery storage'))})}
 async function transact(stores,mode,job){const db=await open();return new Promise((resolve,reject)=>{let result;let done=false;let tx;try{tx=db.transaction(stores,mode);result=job(tx)}catch(e){db.close();reject(e);return}tx.oncomplete=()=>{done=true;db.close();resolve(result)};tx.onabort=()=>{if(!done){db.close();reject(tx.error||Error('Scan recovery transaction failed'))}};tx.onerror=()=>{};})}
 const key=(owner,index)=>`${owner}:${index}`;
 async function read(owner){if(!owner)return null;const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(JOBS,'readonly'),req=tx.objectStore(JOBS).get(owner);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();tx.onabort=()=>{db.close();reject(tx.error)}})}
 async function discard(owner){if(!owner)return;const old=await read(owner);await transact([JOBS,PHOTOS],'readwrite',tx=>{tx.objectStore(JOBS).delete(owner);for(let i=0;i<(old?.total||0);i++)tx.objectStore(PHOTOS).delete(key(owner,i))})}
 async function begin(owner,items,source,zipFile=null){if(!owner||!Array.isArray(items)||!items.length)throw Error('Missing scan selection');
  // Do not silently overwrite an unfinished journal: caller must guard it.
  const old=await read(owner);if(old?.state!=='completed'&&old?.total)throw Error('An unfinished scan is available. Resume it before uploading a new batch.');
  const now=Date.now(),id=(root.crypto?.randomUUID?.()||`${now}-${Math.random().toString(36).slice(2)}`);
  const meta={owner,id,source,createdAt:now,updatedAt:now,state:'active',total:items.length,done:[],saved:0,review:0,skipped:0,failed:0,checked:0,finished:0,zipFile:source==='ZIP'?zipFile:null};
  // One IndexedDB transaction commits all photos and its metadata atomically.
  // If storage quota fails, NO partial resume job is left behind.
  await transact([JOBS,PHOTOS,HISTORY],'readwrite',tx=>{
   const photos=tx.objectStore(PHOTOS),jobs=tx.objectStore(JOBS);tx.objectStore(HISTORY).delete(owner);
   for(let i=0;i<items.length;i++){const item=items[i];photos.put({index:i,path:item.path,shelf:item.shelf,source:item.source,size:item.size||item.file?.size||0,saveRecordId:item.saveRecordId,file:source==='ZIP'?null:item.file},key(owner,i))}
   jobs.put(meta,owner);
  });return meta;
 }
 async function load(owner){
  const job=await read(owner);if(!job)return null;
  const db=await open();return new Promise((resolve,reject)=>{
   const entries=new Array(job.total),tx=db.transaction(PHOTOS,'readonly'),store=tx.objectStore(PHOTOS);
   for(let i=0;i<job.total;i++){const req=store.get(key(owner,i));req.onsuccess=()=>{entries[i]=req.result||null}}
   tx.oncomplete=()=>{db.close();if(entries.some(x=>!x))reject(Error('Stored scan files are incomplete. Please reselect the photos.'));else resolve({job,entries})};
   tx.onabort=()=>{db.close();reject(tx.error||Error('Could not restore stored scan photos'))};
  });
 }
 async function update(owner,patch){const db=await open();return new Promise((resolve,reject)=>{let output;const tx=db.transaction(JOBS,'readwrite'),store=tx.objectStore(JOBS),request=store.get(owner);request.onsuccess=()=>{if(!request.result)return;output={...request.result,...patch,updatedAt:Date.now()};store.put(output,owner)};tx.oncomplete=()=>{db.close();resolve(output||null)};tx.onabort=()=>{db.close();reject(tx.error)};tx.onerror=()=>{};})}
 // Read-modify-write occurs in a single transaction, so concurrent image workers
 // cannot overwrite each other's completion checkpoint.
 async function markDone(owner,index,kind,expectedJobId=null){const db=await open();return new Promise((resolve,reject)=>{let output;const tx=db.transaction(JOBS,'readwrite'),store=tx.objectStore(JOBS),request=store.get(owner);request.onsuccess=()=>{const old=request.result;if(!old||(expectedJobId&&old.id!==expectedJobId)||old.done.includes(index))return;const done=[...old.done,index];const counts={saved:old.saved||0,review:old.review||0,skipped:old.skipped||0};if(kind in counts)counts[kind]++;output={...old,...counts,done,finished:done.length,checked:Math.max(old.checked||0,done.length),updatedAt:Date.now()};store.put(output,owner)};tx.oncomplete=()=>{db.close();resolve(output||null)};tx.onabort=()=>{db.close();reject(tx.error)};tx.onerror=()=>{};})}
 async function finish(owner){const snapshot=await read(owner);if(!snapshot||snapshot.done.length!==snapshot.total)return null;const summary={total:snapshot.total,saved:snapshot.saved||0,review:snapshot.review||0,skipped:snapshot.skipped||0,failed:snapshot.failed||0,finishedAt:Date.now()};await transact([HISTORY],'readwrite',tx=>tx.objectStore(HISTORY).put(summary,owner));await discard(owner);return summary}
 async function history(owner){if(!owner)return null;const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(HISTORY,'readonly'),r=tx.objectStore(HISTORY).get(owner);r.onsuccess=()=>{const value=r.result;resolve(value&&Date.now()-value.finishedAt<HISTORY_MS?value:null)};r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();tx.onabort=()=>{db.close();reject(tx.error)}})}
 return {begin,read,load,update,markDone,finish,history,discard,HISTORY_MS};
});
