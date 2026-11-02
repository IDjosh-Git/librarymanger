/** Server-only admin invitation delivery. Do not call privileged Admin APIs or expose secrets to browser. */
'use strict';
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEmail=email=>typeof email==='string'&&email.length<=254&&EMAIL_RE.test(email);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function siteUrl(raw){const url=new URL(raw);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('Invalid APP_BASE_URL');if(url.username||url.password||url.search||url.hash)throw Error('Invalid APP_BASE_URL');return url}
function inviteLink(base,email,code){const url=siteUrl(base);url.hash='admin-invite='+encodeURIComponent(code)+'&email='+encodeURIComponent(email);return url.toString()}
async function fetchJson(url,opts){const response=await fetch(url,opts);let body={};try{body=await response.json()}catch{}return {ok:response.ok,status:response.status,body}}
async function rpc(url,key,token,method,arg){return fetchJson(url+'/rest/v1/rpc/'+method,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+token},body:JSON.stringify(arg)});}
function response(res,code,payload){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(code).json(payload)}
async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return response(res,405,{error:'Method not allowed'});}
 const {SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,RESEND_API_KEY,RESEND_FROM,APP_BASE_URL}=process.env;
 if(!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY||!RESEND_API_KEY||!RESEND_FROM||!APP_BASE_URL)return response(res,503,{error:'Invitation email is not configured. Contact the app owner.'});
 let target;
 try{target=siteUrl(APP_BASE_URL);if(!/^https:\/\/[a-z0-9.-]+(?:\.supabase\.co)$/.test(SUPABASE_URL))throw Error('Invalid Supabase URL')}catch{return response(res,503,{error:'Invitation email configuration is invalid.'})}
 // Reject cross-site browser requests; bearer auth and server-side role checks remain mandatory.
 const origin=req.headers.origin;
 if(origin && origin!==target.origin)return response(res,403,{error:'Request origin not allowed.'});
 const bearer=String(req.headers.authorization||'').match(/^Bearer\s+([A-Za-z0-9._~+/-]+=*)$/i);
 if(!bearer)return response(res,401,{error:'Sign in as an administrator to send an invitation.'});
 const token=bearer[1],email=String(req.body?.email||'').trim().toLowerCase();
 if(!isEmail(email))return response(res,400,{error:'Enter a valid email address.'});
 const auth=await fetchJson(SUPABASE_URL+'/auth/v1/user',{method:'GET',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token}}).catch(()=>null);
 if(!auth?.ok||!auth.body?.id||!auth.body?.email)return response(res,401,{error:'Your session has expired. Please sign in again.'});
 // The create RPC itself requires a verified ADMIN role in the private role table.
 const created=await rpc(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,token,'library_create_admin_invite',{p_email:email}).catch(()=>null);
 if(!created?.ok){const denied=created?.status===403||created?.body?.code==='42501';return response(res,denied?403:502,{error:denied?'Administrator permission required.':'Could not create invitation. Verify the Supabase invitation setup.'})}
 const code=created.body;
 if(typeof code!=='string'||!(/^[0-9a-f]{64}$/i.test(code)))return response(res,502,{error:'Invalid invitation service response.'});
 const link=inviteLink(APP_BASE_URL,email,code);
 const html=`<div style="font-family:Arial,sans-serif;background:#f4f7ff;padding:36px 16px"><div style="max-width:560px;margin:auto;background:white;border-radius:20px;padding:32px;border:1px solid #e1e7f6"><div style="font-size:14px;font-weight:800;letter-spacing:.12em;color:#455acb">LIBRARY MANAGER</div><h1 style="font-size:28px;color:#16264c;margin:18px 0 8px">You're invited to be an administrator</h1><p style="color:#475477;line-height:1.65">An administrator has invited <strong>${escapeHtml(email)}</strong> to manage the library. Use the secure registration link below to create your account or activate admin access on your existing account.</p><p style="margin:28px 0"><a href="${escapeHtml(link)}" style="display:inline-block;padding:15px 24px;border-radius:12px;color:#fff;text-decoration:none;font-weight:bold;background:#5c50da">Accept invitation</a></p><p style="color:#66738f;font-size:13px;line-height:1.6">This one-time invitation expires in 48 hours and works only for ${escapeHtml(email)}. If you were not expecting this invitation, you can ignore this email.</p></div></div>`;
 let sent;
 try{sent=await fetchJson('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:RESEND_FROM,to:[email],subject:'Your Library Manager administrator invitation',html,text:`You have been invited to administer Library Manager. Open this private link to register: ${link}\n\nThis link is single-use, valid for 48 hours, and tied to ${email}. Ignore this message if you did not request an invitation.`})})}catch{sent=null}
 if(!sent?.ok||!sent.body?.id){
  // Invalidate a code if delivery fails so there is no live undelivered invitation.
  await rpc(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,token,'library_revoke_admin_invite',{p_code:code}).catch(()=>null);
  return response(res,502,{error:'Email could not be sent. Check the verified sender, Resend key and sending quota, then try again.'});
 }
 return response(res,200,{ok:true,email,expiresInHours:48});
}
module.exports=handler;
module.exports.inviteLink=inviteLink;
module.exports.isEmail=isEmail;
module.exports.escapeHtml=escapeHtml;
