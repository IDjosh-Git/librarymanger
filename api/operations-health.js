'use strict';
// Authenticated operational health; never expose counts to anonymous callers.
module.exports=async function(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 if(!process.env.CRON_SECRET||req.headers.authorization!=='Bearer '+process.env.CRON_SECRET)return res.status(401).json({error:'Unauthorized'});
 const base=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)return res.status(503).json({status:'unconfigured'});
 try{
  const response=await fetch(base+'/rest/v1/library_notification_outbox?select=id&limit=1',{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Database HTTP '+response.status);
  return res.status(200).json({status:'healthy',database:'reachable',delivery_configured:Boolean(process.env.RESEND_API_KEY&&process.env.NOTIFICATION_FROM_EMAIL),report_configured:Boolean(process.env.REPORT_TO_EMAIL),timestamp:new Date().toISOString()});
 }catch(e){return res.status(503).json({status:'unhealthy',reason:String(e.message).slice(0,100)})}
};
