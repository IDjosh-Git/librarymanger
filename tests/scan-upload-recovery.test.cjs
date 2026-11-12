const {test}=require('node:test');
const assert=require('node:assert/strict');
const guard=require('../assets/scan-upload-dedup.js');

class MemoryQuery {
 constructor(db,table){this.db=db;this.table=table;this.op='select';this.filters=[];this.fields='*';this.rows=null;this.patch=null;}
 select(fields='*'){this.fields=fields;return this;}
 upsert(rows,opts){this.op='upsert';this.rows=rows;this.opts=opts;return this;}
 update(changes){this.op='update';this.patch=changes;return this;}
 delete(){this.op='delete';return this;}
 eq(k,v){this.filters.push(r=>String(r[k])===String(v));return this;}
 in(k,values){const set=new Set(values.map(String));this.filters.push(r=>set.has(String(r[k])));return this;}
 lt(k,v){this.filters.push(r=>String(r[k])<String(v));return this;}
 then(resolve,reject){return Promise.resolve().then(()=>this.execute()).then(resolve,reject);}
 execute(){
  this.db.calls.push({table:this.table,op:this.op});
  const rows=this.db.tables[this.table];if(!rows)return {error:{message:'table missing'},data:null};
  let result=[];
  if(this.op==='upsert'){
   for(const row of this.rows){
    const existing=rows.find(r=>r.fingerprint===row.fingerprint);
    if(!existing){rows.push({...row});result.push({...row});}
    else if(!this.opts?.ignoreDuplicates)Object.assign(existing,row);
   }
  }else{
   result=rows.filter(r=>this.filters.every(f=>f(r)));
   if(this.op==='update'){for(const r of result)Object.assign(r,this.patch);}
   else if(this.op==='delete')for(const r of result)rows.splice(rows.indexOf(r),1);
  }
  const fields=this.fields==='*'?null:this.fields.split(',').map(x=>x.trim());
  return {data:result.map(r=>fields?Object.fromEntries(fields.map(k=>[k,r[k]])):{...r}),error:null};
 }
}
class MemoryDB {
 constructor(){this.tables={library_scan_files:[],library_books:[],library_review_queue:[]};this.calls=[];}
 from(table){return new MemoryQuery(this,table);}
}
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const old=new Date(Date.now()-60*60*1000).toISOString(),recent=new Date().toISOString();
const hash=n=>'sha256:'+n.toString(16).padStart(64,'0');
const record=n=>`33333333-3333-4333-8333-${n.toString(16).padStart(12,'0')}`;
const items=(count,start=1)=>Array.from({length:count},(_,i)=>({sourceSignature:hash(start+i),saveRecordId:record(start+i+500),file:{name:`photo${i}.jpg`}}));
const lease=(item,u=owner,status='processing',age=old,id=item.saveRecordId)=>({fingerprint:item.sourceSignature,uploaded_by:u,record_id:id,status,updated_at:age});

test('new photo claims are accepted and exact repeats remain duplicates',async()=>{
 const db=new MemoryDB(),original=items(2);
 const initial=await guard.register(db,owner,original);
 assert.equal(initial.accepted.length,2);assert.equal(initial.recovered,0);
 await guard.changeStatus(db,owner,[original[0]],'saved');
 db.tables.library_books.push({record_id:original[0].saveRecordId,source_signature:original[0].sourceSignature});
 const retry=await guard.register(db,owner,original);
 assert.equal(retry.accepted.length,0);assert.equal(retry.skipped.length,2);
 assert.equal(retry.alreadySaved,1);
});

test('111 abandoned processing fingerprints are recovered as three database batches',async()=>{
 const db=new MemoryDB(),photos=items(111);
 for(const item of photos)db.tables.library_scan_files.push(lease(item,owner,'processing',old));
 const result=await guard.register(db,owner,photos);
 assert.equal(result.recovered,111);
 assert.equal(result.accepted.length,111);
 assert.equal(result.skipped.length,0);
 assert.ok(result.accepted.every(x=>x.recovered&&x.saveRecordId===photos.find(p=>p.sourceSignature===x.sourceSignature).saveRecordId));
 assert.equal(db.calls.filter(x=>x.table==='library_scan_files'&&x.op==='update').length,3);
 assert.equal(db.tables.library_scan_files.filter(x=>x.status==='processing').length,111);
 const immediate=await guard.register(db,owner,photos);
 assert.equal(immediate.recovered,0,'second attempt cannot reclaim a fresh active lease');
 assert.equal(immediate.skipped.length,111);
});

test('saved books, active reviews, fresh leases and other owners cannot be reprocessed',async()=>{
 const db=new MemoryDB(),a=items(5);
 db.tables.library_scan_files.push(lease(a[0],owner,'saved',old),lease(a[1],owner,'pending',old),
   lease(a[2],owner,'processing',recent),lease(a[3],other,'processing',old),lease(a[4],owner,'processing',old));
 db.tables.library_books.push({record_id:a[0].saveRecordId,source_signature:a[0].sourceSignature},
   {record_id:a[4].saveRecordId,source_signature:null});
 db.tables.library_review_queue.push({review_key:a[1].saveRecordId,user_id:owner,status:'pending'});
 const r=await guard.register(db,owner,a);
 assert.equal(r.recovered,0);assert.equal(r.skipped.length,5);
 assert.equal(r.alreadySaved,2);assert.equal(r.inReview,1);
});

test('stale pending record without active Review can be scanned again safely',async()=>{
 const db=new MemoryDB(),[a]=items(1);
 db.tables.library_scan_files.push(lease(a,owner,'pending',old));
 db.tables.library_review_queue.push({review_key:a.saveRecordId,user_id:owner,status:'resolved'});
 const result=await guard.register(db,owner,[a]);
 assert.equal(result.recovered,1);
 assert.equal(db.tables.library_scan_files[0].status,'processing');
});

test('cloud lookup errors prevent unsafe duplicate recovery',async()=>{
 const db=new MemoryDB(),[a]=items(1);db.tables.library_scan_files.push(lease(a,owner,'processing',old));
 delete db.tables.library_review_queue;
 await assert.rejects(guard.register(db,owner,[a]),/Could not verify existing Review books/);
 assert.equal(db.tables.library_scan_files[0].updated_at,old);
});

test('same photo in one batch is fingerprinted only once, regardless of filename',async()=>{
 const a=Uint8Array.from([10,20,30]);
 const file1={name:'folder1/a.jpg',arrayBuffer:async()=>a.buffer};
 const file2={name:'folder2/b.jpg',arrayBuffer:async()=>a.buffer};
 const r=await guard.prepare([{file:file1},{file:file2}]);
 assert.equal(r.accepted.length,1);assert.equal(r.skipped,1);
});

test('simultaneous retries claim a stale photo on only one device',async()=>{
 const db=new MemoryDB(),[a]=items(1);
 db.tables.library_scan_files.push(lease(a,owner,'processing',old));
 const [first,second]=await Promise.all([guard.register(db,owner,[a]),guard.register(db,owner,[a])]);
 assert.equal(first.accepted.length+second.accepted.length,1);
 assert.equal(first.skipped.length+second.skipped.length,1);
 assert.equal(db.tables.library_scan_files.length,1);
});

test('release only clears unprocessed owned leases, preserving Review and saved records',async()=>{
 const db=new MemoryDB(),a=items(4);
 db.tables.library_scan_files.push(lease(a[0],owner,'processing'),lease(a[1],owner,'pending'),
   lease(a[2],owner,'saved'),lease(a[3],other,'processing'));
 await guard.releaseProcessing(db,owner,a);
 assert.deepEqual(db.tables.library_scan_files.map(x=>x.fingerprint).sort(),
   a.slice(1).map(x=>x.sourceSignature).sort());
});
