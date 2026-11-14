'use strict';
/* Authenticated administrator-only, server-side evidence. Never accepts client supplied evidence. */
const {verifyIndependentEdition}=require('../lib/independent-edition-verifier.cjs');
const base=()=>process.env.SUPABASE_URL||'https://hotysnqorkqbiconjskl.supabase.co';
async function request(path,{method='GET',token,service=false,body}={}){
 const key=service?process.env.SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_ANON_KEY;
 if(!key)throw Error('Supabase credentials missing');
 const r=await fetch(base()+path,{method,headers:{apikey:key,Authorization:'Bearer '+(service?key:token),'Content-Type':'application/json',...(service?{'Prefer':'return=representation'}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('Database or authentication request failed ('+r.status+')');return r.status===204?null:r.json();
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'POST required'});
 const token=/^Bearer (.+)$/.exec(req.headers.authorization||'')?.[1];if(!token)return res.status(401).json({error:'Sign in required'});
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.SUPABASE_ANON_KEY)return res.status(503).json({error:'Server configuration incomplete'});
 try{
  const user=await request('/auth/v1/user',{token});if(!user?.id)return res.status(401).json({error:'Invalid session'});
  const roles=await request('/rest/v1/library_member_roles?select=role&user_id=eq.'+encodeURIComponent(user.id),{token,service:true});
  if(!roles?.some(x=>x.role==='admin'))return res.status(403).json({error:'Administrator required'});
  const limit=Number(req.body?.limit||10);if(!Number.isInteger(limit)||limit<1||limit>25)return res.status(400).json({error:'Batch size must be 1–25'});
  const rows=await request('/rest/v1/library_review_queue?select=review_key,data&status=eq.pending&order=created_at.asc&limit='+limit,{service:true});
  const results=[];
  for(const row of rows||[]){
   let decision;
   try{
    await request('/rest/v1/library_auto_review_verified_sources?review_key=eq.'+encodeURIComponent(row.review_key),{method:'DELETE',service:true});
    decision=await verifyIndependentEdition(row,{googleKey:process.env.GOOGLE_BOOKS_API_KEY||''});
    if(decision.ok){
     // Source evidence written only by server role; subsequent approval independently rechecks queue fields.
     await request('/rest/v1/library_auto_review_verified_sources?on_conflict=review_key',{method:'POST',service:true,body:{review_key:row.review_key,isbn:decision.isbn,title:decision.title,authors:decision.authors,source:decision.source,verified_at:new Date().toISOString()}});
    }
   }catch(e){decision={ok:false,reasons:['provider_or_database_unavailable']};}
   results.push({review_key:row.review_key,verified:!!decision.ok,reasons:decision.reasons||[]});
  }
  return res.status(200).json({checked:results.length,verified:results.filter(x=>x.verified).length,items:results,approvalExecuted:false});
 }catch(e){return res.status(503).json({error:'Verification unavailable',detail:String(e.message||e).slice(0,160)})}
};
