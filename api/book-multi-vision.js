'use strict';
// Multiple photographed pages, returned as suggestions only. No inventory writes.
const vision=require('./book-vision');
const {fuse}=require('../lib/recognition-fusion.cjs');
const {verify}=require('../lib/recognition-verification.cjs');
module.exports=async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'POST required'})}
 const photos=req.body?.photos;
 if(!Array.isArray(photos)||photos.length<2||photos.length>3||photos.some(p=>!['front','back','title_page'].includes(p?.label)||typeof p.image!=='string'||p.image.length>2600000)||new Set(photos.map(p=>p.label)).size!==photos.length)return res.status(400).json({error:'Supply 2 or 3 labelled, resized photographs.'});
 const results=[];
 for(const photo of photos){
  let code=200,body={};const mock={setHeader(){return this},status(n){code=n;return this},json(value){body=value;return this}};
  await vision({...req,body:{image:photo.image,ocrText:String(photo.ocrText||'').slice(0,1400)}},mock);
  if(code!==200)return res.status(code).json({error:body.error||'Image recognition unavailable',completed:results.length});
  results.push({label:photo.label,metadata:body.metadata,provider:body.provider});
 }
 const merged=fuse(results);
 const catalogue=await verify(merged.metadata);
 return res.status(200).json({...merged,catalogue,photos:results.map(r=>({label:r.label,provider:r.provider})),source:'multi-photo AI suggestions'});
};
