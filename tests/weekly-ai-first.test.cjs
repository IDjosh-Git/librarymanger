'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {isoWeekStart}=require('../lib/weekly-selection.cjs');
const source=path.join(__dirname,'../api/weekly-pick.js');
const root=path.join(__dirname,'..');
const ID='cf50b0f7-8051-43c5-8df2-b9ac352ee007';
const book={record_id:ID,title:'A Verified Book',authors:'A. Writer',barcode:'9780143127741',subject:'Education',publication_year:'2018',shelf_location:'2',book_status:'Available'};
const reason='An accessible, thoughtful book drawn from the library collection. Its listed educational subject makes it a useful starting point for new readers.';
function mockEnv({ai=true,manual=true}={}){
 const keys=['GEMINI_API_KEY','OPENROUTER_API_KEY','GROQ_API_KEY','SUPABASE_SERVICE_ROLE_KEY','CRON_SECRET'];
 const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 for(const k of keys)delete process.env[k];
 if(ai)process.env.GEMINI_API_KEY='test-gemini';
 process.env.SUPABASE_SERVICE_ROLE_KEY='test-private-service-key';process.env.CRON_SECRET='test-cron-secret';
 let saved=null, calls={ai:0,inventory:0,write:0,manual:0};
 const oldFetch=global.fetch;
 const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
 global.fetch=async(url,opt={})=>{
  const u=String(url),method=opt.method||'GET';
  if(u.includes('generativelanguage.googleapis.com')){
   calls.ai++;
   if(!ai)return response({error:'Provider unavailable'},503);
   return response({candidates:[{content:{parts:[{text:JSON.stringify({book_id:ID,reason,reading_hook:'Explore the subject',ideal_for:'Curious readers',discussion_question:'What would you learn?'})}]}}]});
  }
  if(u.includes('/auth/v1/user'))return response({id:'user-1'});
  if(u.includes('/rest/v1/library_member_roles'))return response([{role:'admin'}]);
  if(u.includes('/rest/v1/library_featured_books')){calls.manual++;return response(manual?[{id:1}]:[])}
  if(u.includes('/rest/v1/library_ai_weekly_picks')){
   if(method==='POST'){
    calls.write++;const newRow=JSON.parse(opt.body);
    if(!saved||u.includes('on_conflict'))saved=newRow;
    return response([saved]);
   }
   return response(u.includes('week_start=lt.')?[]:saved?[saved]:[]);
  }
  if(u.includes('/rest/v1/library_books')){calls.inventory++;return response([book]);}
  throw Error('Unexpected URL '+u);
 };
 delete require.cache[require.resolve(source)];
 const handler=require(source);
 const request=(method='GET',query={},headers={},body={})=>({method,query,headers,body});
 const invoke=async req=>{
  let responseData;
  const res={setHeader(){},status(code){this.code=code;return this},json(body){responseData={status:this.code,body};return responseData}};
  return handler(req,res);
 };
 return {invoke,request,calls,getSaved:()=>saved,cleanup(){global.fetch=oldFetch;for(const [k,v] of Object.entries(original)){if(v===undefined)delete process.env[k];else process.env[k]=v}delete require.cache[require.resolve(source)]}};
}
test('public first visit chooses AI from verified inventory and next visit reuses the same weekly pick',async()=>{
 const m=mockEnv();try{
  const first=await m.invoke(m.request('GET',{ensure:'1'}));
  assert.equal(first.status,200);assert.equal(first.body.status,'published');assert.equal(first.body.pick.selection_source,'ai');
  assert.equal(first.body.pick.title,'A Verified Book');assert.equal(first.body.pick.week_start,isoWeekStart());
  assert.ok(!('inventory_record_id' in first.body.pick));assert.ok(!('provider' in first.body.pick));
  const next=await m.invoke(m.request('GET',{ensure:'1'}));
  assert.equal(next.body.status,'existing');assert.equal(m.calls.ai,1);assert.equal(m.calls.write,1);
  assert.equal(m.calls.inventory,1);
 }finally{m.cleanup()}
});
test('AI unavailable: catalogue rotation publishes a real inventory title without manual table short-circuit',async()=>{
 const m=mockEnv({ai:false,manual:true});try{
  const r=await m.invoke(m.request('GET',{ensure:'1'}));
  assert.equal(r.status,200);assert.equal(r.body.pick.selection_source,'automatic');
  assert.equal(r.body.pick.title,'A Verified Book');assert.equal(m.calls.manual,0);
 }finally{m.cleanup()}
});
test('cron remains secret-protected and can select AI even if a manual fallback exists',async()=>{
 const m=mockEnv();try{
  const denied=await m.invoke(m.request('GET'));
  assert.equal(denied.status,401);
  const ok=await m.invoke(m.request('GET',{}, {authorization:'Bearer test-cron-secret'}));
  assert.equal(ok.status,200);assert.equal(ok.body.pick.selection_source,'ai');assert.equal(m.calls.manual,0);
 }finally{m.cleanup()}
});
test('public ensure never honours regenerate or caller-supplied candidates',async()=>{
 const m=mockEnv();try{
  const first=await m.invoke(m.request('GET',{ensure:'1'}));
  const again=await m.invoke(m.request('GET',{ensure:'1',regenerate:'true'}, {},{regenerate:true,candidates:[{title:'Invented book'}]}));
  assert.equal(first.body.pick.title,again.body.pick.title);assert.equal(m.calls.write,1);
 }finally{m.cleanup()}
});
test('SQL public RPC prioritizes AI over manual, then catalogue fallback',()=>{
 const sql=fs.readFileSync(path.join(root,'database/10_ai_first_weekly_spotlight.sql'),'utf8');
 assert.match(sql,/WITH ai AS/);assert.match(sql,/SELECT \* FROM ai UNION ALL SELECT \* FROM manual UNION ALL SELECT \* FROM rotation UNION ALL SELECT \* FROM fallback/);
 assert.match(sql,/selection_source='ai'/);assert.match(sql,/NOT EXISTS\(SELECT 1 FROM ai\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.library_public_weekly_spotlight_v2\(\) FROM PUBLIC/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.library_public_weekly_spotlight_v2\(\) TO anon, authenticated/);
});
test('public pages attempt lazy weekly generation and never expose service-role credentials',()=>{
 for(const name of ['assets/book-of-the-week.js','assets/reading-guide.js']){
  const src=fs.readFileSync(path.join(root,name),'utf8');
  assert.match(src,/\/api\/weekly-pick\?ensure=1/);
  assert.doesNotMatch(src,/SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET/);
 }
});

test('public spotlight does not return before the automatic AI recovery request',()=>{
 const src=fs.readFileSync(path.join(root,'assets/book-of-the-week.js'),'utf8');
 assert.doesNotMatch(src,/return updateSpotlight\(result\.data\[0\]\)/);
 const ensure=src.indexOf('async function ensureWeeklyPick');
 const call=src.indexOf('await ensureWeeklyPick()');
 assert.ok(ensure>0&&call>ensure);
});
