'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('// Each Review card uses its own idempotent cloud transaction.'),end=html.indexOf('// Native form submission works with touch',start);
assert.ok(start>0&&end>start,'Independent Review save function must be present');
const saveCode=html.slice(start,end);
function defer(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}}
function setup(){
 const owner='user-1',jobs=new Map(),pending=new Map(),feedback=[],buttons={},drafts=[];let listRender=0;
 const sb={from(table){return {
   select(){return {eq(k,v){this.key=v;return this},maybeSingle:async()=>({data:null,error:null})}},
   insert(payload){return {select(){return {single(){const d=defer();pending.set(payload.record_id,d);return d.promise}}}}},
   update(changes){return {eq(){return this},select(){return {single:async()=>({data:null,error:{message:'not implemented'}})}}}}
 }}};
 const ctx={sb,BOOKS:'library_books',session:{user:{id:owner}},authGeneration:0,reviewCardJobs:jobs,reviewDraftVersion:1,reviewSaveTimer:null,clearTimeout,reviewCloudSync:Promise.resolve(),
   batchImageUrls:new Map(),books:[],console,Date,Map,Set,URL:{revokeObjectURL:()=>{}},
   $:()=>({textContent:''}),clean:x=>String(x||'').trim(),uuid:()=>`generated-${Math.random()}`,
   renderBatch:()=>{listRender++},reloadAll:async()=>{},persistReviewDraft:async()=>{drafts.push('backup')},deleteCloudReview:async()=>{},scanUploadGuard:{changeStatus:async()=>{}},
   setReviewFormFeedback:(form,text,kind)=>{form.feedback={text,kind};feedback.push({form:form.id,text,kind})}
 };
 vm.createContext(ctx);vm.runInContext(saveCode,ctx);
 const save=row=>{const button={disabled:false,textContent:'Approve & save'},input={disabled:false};buttons[row.saveRecordId]={button,input};const form={id:row.saveRecordId,querySelector:()=>button,querySelectorAll:()=>[input]};const result=vm.runInContext('saveReviewCard',ctx)(row,form);return {promise:result,form,button,input}};
 return {pending,feedback,buttons,jobs,drafts,save,renderCount:()=>listRender};
}
function row(id){return {saveRecordId:id,title:'Book '+id,authors:'Author',barcode:'',shelf:'A2',reviewStaged:true,reviewUpdatedAt:Date.now(),saved:false,file:null}}

test('two Review cards may save at once and have independent buttons, feedback and confirmations',async()=>{
 const app=setup(),one=row('copy-1'),two=row('copy-2');
 const first=app.save(one),second=app.save(two);
 await new Promise(r=>setImmediate(r));
 assert.equal(app.jobs.size,2);assert.equal(first.button.disabled,true);assert.equal(second.button.disabled,true);
 assert.equal(app.pending.size,2);assert.equal(app.renderCount(),0,'other cards stay mounted while saves are pending');
 app.pending.get('copy-2').resolve({data:{record_id:'copy-2',book_id:'B002',user_id:'user-1'},error:null});
 await second.promise;assert.equal(two.saved,true);assert.equal(one.saved,false);assert.equal(app.jobs.size,1);assert.equal(app.renderCount(),0);
 app.pending.get('copy-1').resolve({data:{record_id:'copy-1',book_id:'B001',user_id:'user-1'},error:null});
 await first.promise;assert.equal(one.saved,true);assert.equal(app.jobs.size,0);assert.equal(app.renderCount(),1);
 assert.ok(app.feedback.some(x=>x.form==='copy-1'&&x.kind==='success'));assert.ok(app.feedback.some(x=>x.form==='copy-2'&&x.kind==='success'));
});

test('one failing Review save retains its data and does not block another successful card',async()=>{
 const app=setup(),a=row('copy-a'),b=row('copy-b');const first=app.save(a),second=app.save(b);await new Promise(r=>setImmediate(r));
 app.pending.get('copy-a').resolve({error:{message:'Network unavailable'},data:null});
 await first.promise;assert.equal(a.saved,false);assert.equal(first.button.disabled,false);assert.match(first.form.feedback.text,/Network unavailable/);
 assert.equal(app.jobs.size,1);assert.equal(app.renderCount(),0);
 app.pending.get('copy-b').resolve({data:{record_id:'copy-b',book_id:'B212',user_id:'user-1'},error:null});
 await second.promise;assert.equal(b.saved,true);assert.equal(app.jobs.size,0);
 assert.equal(a.title,'Book copy-a');assert.equal(a.shelf,'A2');
});

test('double-clicking the same Review card does not create a second cloud insert',async()=>{
 const app=setup(),a=row('copy-a');const first=app.save(a);await new Promise(r=>setImmediate(r));
 const second=app.save(a);assert.equal(await second.promise,undefined,'an in-flight card is ignored');assert.equal(app.pending.size,1);
 app.pending.get('copy-a').resolve({data:{record_id:'copy-a',book_id:'B1',user_id:'user-1'},error:null});await first.promise;assert.equal(a.saved,true);
});


test('the Review form resolves its stable record id after other rows are removed or reordered',()=>{
 const start=html.indexOf('function reviewRowForForm('),end=html.indexOf('// Native form submission works with touch',start);
 assert.ok(start>0&&end>start);
 const a=row('copy-a'),b=row('copy-b'),c=row('copy-c');
 const context={batchItems:[a,b,c],reviewRowKey:r=>r.saveRecordId};
 vm.createContext(context);vm.runInContext(html.slice(start,end),context);
 const form={dataset:{reviewForm:'1',reviewKey:'copy-b'}};
 assert.equal(vm.runInContext('reviewRowForForm',context)(form),b);
 context.batchItems=[c,a,b];
 assert.equal(vm.runInContext('reviewRowForForm',context)(form),b,'cloud reorder must never target another physical copy');
 const element={closest:()=>({dataset:{reviewKey:'copy-b'}})};
 assert.equal(vm.runInContext('reviewStableIndex',context)(element,1),2);
 context.batchItems=[c,a];
 assert.equal(vm.runInContext('reviewRowForForm',context)(form),undefined,'removed copies must not be approved by stale forms');
});

test('cloud merge and saved-row cleanup do not reorder an actively saving Review editor',()=>{
 assert.match(html,/function reconcileSavedScanRows\(\)\{\s*if\(reviewCardJobs\.size\)return 0/);
 assert.match(html,/async function restoreReviewDraftRaw\(force=false\)\{\s*if\(reviewCardJobs\.size\)return/);
 assert.match(html,/if\(reviewCardJobs\.size\)\{reviewDraftLoadedFor=null;return;\}/);
 assert.match(html,/data-review-key="\$\{batchAttr\(x\.saveRecordId\)\}"/);
});
