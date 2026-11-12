'use strict';
const cloud=require('../lib/library-ai-cloud.cjs');
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store, private');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'&&req.method!=='DELETE') {res.setHeader('Allow','GET, DELETE');return res.status(405).json({error:'Method not allowed',code:'METHOD_NOT_ALLOWED'});}
 try{
  const member=await cloud.authenticate(req);
  if(req.method==='DELETE'){
   await cloud.reset(member);
   return res.status(200).json({reset:true,messages:[]});
  }
  // A signed-in member starts a persistent cloud thread automatically.
  const thread=await cloud.ensureThread(member);
  const messages=await cloud.messages(member,thread);
  return res.status(200).json({messages,cloud:true});
 }catch(err){return res.status(err.status||503).json({error:err.message||'Cloud chat is unavailable.',code:err.code||'AI_CLOUD_ERROR'});}
};
