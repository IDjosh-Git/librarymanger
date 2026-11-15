'use strict';
const s=require('../lib/recognition-server.cjs');const multi=require('./book-multi-vision');
module.exports=async function(req,res){res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'GET only'});
 if(!process.env.CRON_SECRET||req.headers.authorization!=='Bearer '+process.env.CRON_SECRET)return res.status(401).json({error:'Unauthorized'});
 try{const jobs=await s.api('/rest/v1/rpc/library_recognition_claim_job',{method:'POST',body:{}});if(!jobs?.length){const old=await s.api('/rest/v1/library_recognition_jobs?status=in.(failed,cancelled)&created_at=lt.'+encodeURIComponent(new Date(Date.now()-24*3600000).toISOString())+'&input_paths=not.eq.%5B%5D&select=id,input_paths&limit=5');for(const item of old){await s.remove((item.input_paths||[]).map(p=>p.path));await s.api('/rest/v1/library_recognition_jobs?id=eq.'+item.id,{method:'PATCH',body:{input_paths:[],updated_at:new Date().toISOString()}})}return res.status(200).json({processed:0,expired_photos:old.length})}const job=jobs[0];const paths=Array.isArray(job.input_paths)?job.input_paths:[];
 let succeeded=false;try{if(paths.length<2||paths.length>3||paths.some(p=>!p.path?.startsWith(job.user_id+'/'+job.id+'/')))throw new Error('Invalid private image paths');const photos=[];for(const p of paths)photos.push({label:p.label,image:await s.download(p.path)});
 let code=200,result={};const mock={setHeader(){return this},status(c){code=c;return this},json(v){result=v;return this}};
 await multi({method:'POST',headers:{},_trustedJob:true,body:{photos}},mock);
 if(code!==200)throw new Error(String(result.error||'Recognition failed').slice(0,240));
 // Cancelled jobs must never be overwritten by a late worker result.
 const committed=await s.api('/rest/v1/library_recognition_jobs?id=eq.'+job.id+'&status=eq.running&attempt_count=eq.'+job.attempt_count+'&select=id',{method:'PATCH',headers:{Prefer:'return=representation'},body:{status:'completed',result,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}});
 succeeded=Array.isArray(committed)&&committed.length>0;return res.status(200).json({processed:1,status:succeeded?'completed':'superseded',job_id:job.id});
 }catch(e){await s.api('/rest/v1/library_recognition_jobs?id=eq.'+job.id+'&status=eq.running&attempt_count=eq.'+job.attempt_count,{method:'PATCH',body:{status:'failed',error:String(e.message).slice(0,300),finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}});return res.status(200).json({processed:1,status:'failed',job_id:job.id})}
 finally{if(succeeded){try{await s.remove(paths.map(p=>p.path))}catch(cleanupError){console.error('Recognition cleanup failed:',cleanupError.message)}}}
 }catch(e){return res.status(503).json({error:'Recognition worker unavailable'})}}
