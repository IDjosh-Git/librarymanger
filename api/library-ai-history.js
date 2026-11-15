'use strict';
const cloud=require('../lib/library-ai-cloud.cjs');
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store, private');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','DELETE','POST'].includes(req.method)) {res.setHeader('Allow','GET, DELETE, POST');return res.status(405).json({error:'Method not allowed',code:'METHOD_NOT_ALLOWED'});}
 try{
  const member=await cloud.authenticate(req);
  if(req.method==='POST'){const thread=await cloud.createThread(member,req.body?.title);return res.status(201).json({thread,threads:await cloud.listThreads(member)});}
  const threadId=typeof req.query?.thread==='string'&&/^[0-9a-f-]{36}$/i.test(req.query.thread)?req.query.thread:null;
  if(req.method==='DELETE'){
   await cloud.reset(member,threadId);
   return res.status(200).json({reset:true,messages:[]});
  }
  // A signed-in member starts a persistent cloud thread automatically.
  const thread=await cloud.ensureThread(member,threadId);
  const messages=await cloud.messages(member,thread);
  return res.status(200).json({messages,thread,threads:await cloud.listThreads(member),cloud:true});
 }catch(err){return res.status(err.status||503).json({error:err.message||'Cloud chat is unavailable.',code:err.code||'AI_CLOUD_ERROR'});}
};
