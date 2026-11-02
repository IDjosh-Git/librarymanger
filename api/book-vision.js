'use strict';
// Optional Gemini-powered photo reading. Never store an API key in browser code.
// This endpoint returns suggestions only and never writes any library record.
const project='https://hotysnqorkqbiconjskl.supabase.co';
const publishable='sb_publishable_OL7r2hmR6n7OOWY5m-3bRw_Peft2X9q';
const rate=new Map();
module.exports=async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
 if(req.method==='GET')return res.status(200).json({enabled:!!process.env.GEMINI_API_KEY,provider:'Gemini',mode:'suggestions-only'});
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Unsupported method'})}
 if(!process.env.GEMINI_API_KEY)return res.status(501).json({error:'Optional AI image reading is not configured.'});
 const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(token.length<20||token.length>5000)return res.status(401).json({error:'Sign in to read a book image.'});
 try{
  const session=await fetch(project+'/auth/v1/user',{headers:{apikey:publishable,Authorization:'Bearer '+token},signal:AbortSignal.timeout(4500)});
  if(!session.ok)return res.status(401).json({error:'Sign-in expired.'});
  const user=await session.json();if(!user.id)return res.status(401).json({error:'Invalid session.'});
  const now=Date.now(),k=user.id,arr=(rate.get(k)||[]).filter(t=>t>now-60000);
  if(arr.length>=8){rate.set(k,arr);res.setHeader('Retry-After','60');return res.status(429).json({error:'AI reading limit reached. Please use local OCR or retry later.'})}
  arr.push(now);rate.set(k,arr);if(rate.size>1000)for(const [id,t]of rate)if(!t.some(x=>x>now-60000))rate.delete(id);
  const image=req.body?.image;
  if(typeof image!=='string'||image.length<100||image.length>2600000||!/^[A-Za-z0-9+/]+={0,2}$/.test(image))return res.status(400).json({error:'Upload one resized JPEG image.'});
  const model=process.env.GEMINI_MODEL||'gemini-3.5-flash-lite';
  const api=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
   method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
   body:JSON.stringify({contents:[{parts:[{text:'Extract ONLY text actually legible on this book cover or title page. Do not invent an ISBN, author, title or publisher. Return JSON with string keys title, authors, isbn; use empty strings if uncertain. No markdown.'},{inline_data:{mime_type:'image/jpeg',data:image}}]}],generationConfig:{responseMimeType:'application/json',temperature:0,maxOutputTokens:250}}),signal:AbortSignal.timeout(10500)
  });
  if(!api.ok)return res.status(api.status===429?429:503).json({error:'AI image reading temporarily unavailable.'});
  const body=await api.json(),value=body.candidates?.[0]?.content?.parts?.find(p=>p.text)?.text||'{}';
  const parsed=JSON.parse(value);
  const safe=k=>typeof parsed[k]==='string'?parsed[k].replace(/[\x00-\x1f<>]/g,' ').trim().slice(0,k==='isbn'?30:350):'';
  return res.status(200).json({metadata:{title:safe('title'),authors:safe('authors'),isbn:safe('isbn')},source:'AI image suggestion',verified:false});
 }catch{return res.status(503).json({error:'AI image reading unavailable; local OCR can still be used.'})}
};
