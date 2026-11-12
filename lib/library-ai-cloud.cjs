'use strict';
/* Authenticated Library Manager AI persistence. Every database request uses the
   verified member's Supabase JWT, so Postgres RLS remains the access boundary.
   No service-role credential or browser chat-history fallback is used. */
const PROJECT_URL = 'https://hotysnqorkqbiconjskl.supabase.co';
const PROJECT_PUBLISHABLE_KEY = 'sb_publishable_OL7r2hmR6n7OOWY5m-3bRw_Peft2X9q';
const MAX_MESSAGES = 60;
function failure(message, status = 500, code = 'AI_CLOUD_ERROR') {
 return Object.assign(new Error(message), {status, code});
}
function settings(){
 const url=String(process.env.SUPABASE_URL||PROJECT_URL).replace(/\/+$/,'');
 const key=String(process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||PROJECT_PUBLISHABLE_KEY);
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(url) || !key)throw failure('Supabase has not been configured for Library AI.',503,'AI_CLOUD_UNAVAILABLE');
 return {url,key};
}
function bearer(req){
 const raw=req.headers?.authorization;
 const match=typeof raw==='string' ? /^Bearer\s+([^\s]+)$/i.exec(raw.trim()) : null;
 if(!match || match[1].length>6000)throw failure('Sign in to Library Manager to use AI and cloud chat.',401,'AUTH_REQUIRED');
 return match[1];
}
async function networkJson(url, opts){
 let response;
 try {response=await fetch(url,{...opts,signal:AbortSignal.timeout(12000),cache:'no-store'});}
 catch {throw failure('Supabase is temporarily unreachable. Your conversation has not been saved.',503,'AI_CLOUD_UNAVAILABLE');}
 const data=await response.json().catch(()=>null);
 if(!response.ok){
  // Detailed PostgREST diagnostics stay on the server; browser errors are generic.
  console.error('Library AI Supabase error', {status:response.status, code:data?.code||null, message:String(data?.message||'').slice(0,180), endpoint:new URL(url).pathname});
  if(response.status===401||response.status===403)throw failure('Your library session has expired or access is not permitted. Sign in again.',401,'AUTH_REQUIRED');
  throw failure('Supabase could not save or retrieve this conversation. Please try again.',503,'AI_CLOUD_ERROR');
 }
 return data;
}
async function authenticate(req){
 const token=bearer(req),{url,key}=settings();
 const baseHeaders={apikey:key,Authorization:'Bearer '+token};
 const auth=await networkJson(url+'/auth/v1/user',{headers:baseHeaders});
 if(!auth?.id || auth.is_anonymous===true)throw failure('Please sign in with a permanent Library Manager account.',401,'AUTH_REQUIRED');
 const role=await networkJson(url+'/rest/v1/library_member_roles?select=role&user_id=eq.'+encodeURIComponent(auth.id)+'&limit=1',{headers:baseHeaders});
 if(!Array.isArray(role)||!['admin','user'].includes(role[0]?.role))throw failure('Only authorized Library Manager members can use the assistant.',403,'LIBRARY_MEMBER_REQUIRED');
 return {id:auth.id,role:role[0].role,token,url,key};
}
async function rest(member, table, {method='GET',query='',body,prefer='return=representation'}={}){
 const headers={apikey:member.key,Authorization:'Bearer '+member.token,Accept:'application/json'};
 if(body!==undefined)headers['Content-Type']='application/json';
 if(prefer)headers.Prefer=prefer;
 return networkJson(member.url+'/rest/v1/'+table+query,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
}
async function findThread(member){
 const items=await rest(member,'library_manager_ai_conversations',{query:'?select=id,user_id&user_id=eq.'+member.id+'&limit=1'});
 return items?.[0]||null;
}
async function ensureThread(member){
 const existing=await findThread(member);if(existing)return existing;
 try{
  const inserted=await rest(member,'library_manager_ai_conversations',{method:'POST',body:{user_id:member.id}});
  if(inserted?.[0]?.id)return inserted[0];
 }catch(e){ // A second signed-in device may have inserted the unique thread concurrently.
  const concurrent=await findThread(member);if(concurrent)return concurrent;
  throw e;
 }
 const concurrent=await findThread(member);if(concurrent)return concurrent;
 throw failure('Could not initialize cloud conversation.',503);
}
async function messages(member, thread, limit=MAX_MESSAGES){
 if(!thread)return [];
 const arr=await rest(member,'library_manager_ai_messages',{query:'?select=id,role,content,mode,sources,created_at&conversation_id=eq.'+thread.id+'&order=message_sequence.desc&limit='+Math.min(Math.max(limit,1),MAX_MESSAGES)});
 return (arr||[]).reverse();
}
// Save one message at a time. PostgREST bulk JSON inserts reject mixed object
// keys with PGRST102, which previously broke all chat-saving attempts.
// Each write is confirmed by Supabase before advancing the conversation.
async function insertMessage(member, thread, role, content, {mode=null,sources=[]}={}){
 const body={conversation_id:thread.id,user_id:member.id,role,content:String(content||'').slice(0,12000),mode,sources:Array.isArray(sources)?sources.slice(0,6):[]};
 const inserted=await rest(member,'library_manager_ai_messages',{method:'POST',body});
 if(!Array.isArray(inserted)||inserted.length!==1||!inserted[0]?.id)throw failure('Supabase did not confirm that your message was saved.',503,'AI_CLOUD_ERROR');
 return inserted[0];
}
async function insertUserMessage(member,thread,question){return insertMessage(member,thread,'user',question);}
async function insertAssistantMessage(member,thread,answer){return insertMessage(member,thread,'assistant',answer.reply,{mode:answer.mode||null,sources:answer.sources});}
async function reset(member){
 await rest(member,'library_manager_ai_conversations',{method:'DELETE',query:'?user_id=eq.'+member.id,prefer:'return=minimal'});
}
async function knowledge(member){
 return rest(member,'library_manager_ai_knowledge',{query:'?select=slug,title,answer,keywords,sort_order&enabled=eq.true&order=sort_order.asc&limit=120'});
}
function matchKnowledge(question,entries,max=4){
 const q=String(question||'').toLowerCase();
 const tokens=[...new Set(q.match(/[a-z0-9]{3,}/g)||[])].filter(x=>!['the','and','how','what','does','for','can','you','with','this','that','our','please','will','who','where','have','use','using','about','want','from','when'].includes(x));
 return (Array.isArray(entries)?entries:[]).map(entry=>{
  const title=String(entry.title||'').toLowerCase(),slug=String(entry.slug||'').replace(/-/g,' '),terms=Array.isArray(entry.keywords)?entry.keywords.map(x=>String(x).toLowerCase()):[],answer=String(entry.answer||'').toLowerCase();
  let score=0;
  for(const token of tokens){if(title.includes(token))score+=3;if(slug.includes(token))score+=3;if(terms.some(t=>t===token||t.startsWith(token)))score+=4;if(answer.includes(token))score+=0.4;}
  if(q.includes(title)&&title.length>8)score+=8;
  return {entry,score};
 }).filter(x=>x.score>=3).sort((a,b)=>b.score-a.score).slice(0,max).map(x=>({...x.entry,score:x.score}));
}
module.exports={authenticate,rest,findThread,ensureThread,messages,insertUserMessage,insertAssistantMessage,reset,knowledge,matchKnowledge,failure};
