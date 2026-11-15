'use strict';
const crypto=require('node:crypto');
const s=require('../lib/recognition-server.cjs');
module.exports=async function(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');try{
 const user=await s.userFromRequest(req);const base='/rest/v1/library_recognition_jobs';
 if(req.method==='GET'){const rows=await s.api(base+'?user_id=eq.'+encodeURIComponent(user)+'&select=id,review_key,status,mode,input_count,result,error,attempt_count,created_at,updated_at,finished_at&order=created_at.desc&limit=30');return res.status(200).json({jobs:rows})}
 if(req.method==='POST'&&req.body?.action==='retry'){const id=String(req.body.id||'');if(!/^[a-f0-9-]{36}$/i.test(id))return res.status(400).json({error:'Invalid job'});const rows=await s.api(base+'?id=eq.'+id+'&user_id=eq.'+user+'&status=eq.failed&input_paths=not.eq.%5B%5D&select=id',{method:'PATCH',headers:{Prefer:'return=representation'},body:{status:'queued',error:null,updated_at:new Date().toISOString()}});return res.status(rows.length?200:409).json({retried:!!rows.length})}
 if(req.method==='DELETE'){const id=String(req.query?.id||'');if(!/^[a-f0-9-]{36}$/i.test(id))return res.status(400).json({error:'Invalid job'});const rows=await s.api(base+'?id=eq.'+id+'&user_id=eq.'+user+'&status=in.(queued,running)&select=id,input_paths',{method:'PATCH',headers:{Prefer:'return=representation'},body:{status:'cancelled',updated_at:new Date().toISOString()}});if(rows.length)await s.remove((rows[0].input_paths||[]).map(p=>p.path));return res.status(rows.length?200:409).json({cancelled:!!rows.length})}
 if(req.method!=='POST')return res.status(405).json({error:'Unsupported method'});
 const photos=req.body?.photos;if(!s.validatePhotos(photos))return res.status(400).json({error:'Provide 2–3 distinct JPEG photos, resized to 2.2MB or less each'});
 const id=crypto.randomUUID(),paths=[];try{for(const photo of photos){const path=user+'/'+id+'/'+photo.label+'.jpg';await s.upload(path,photo.image);paths.push({label:photo.label,path})}
 const rows=await s.api(base+'?select=id,status',{method:'POST',headers:{Prefer:'return=representation'},body:{id,user_id:user,status:'queued',input_count:photos.length,mode:'accurate',input_paths:paths,review_key:/^[a-f0-9-]{36}$/i.test(String(req.body.review_key||''))?req.body.review_key:null}});return res.status(202).json({job:rows[0]});
 }catch(e){await s.remove(paths.map(p=>p.path));throw e}
 }catch(e){const unauthorized=e.message==='Unauthorized';return res.status(unauthorized?401:503).json({error:unauthorized?'Sign in required':e.message})}}
