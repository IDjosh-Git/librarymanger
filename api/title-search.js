'use strict';
// Title-page OCR leads to *suggestions*, never an unverified ISBN.
// Uses several public catalogs. API outages must not block manual review.
const {searchTitles}=require('../lib/title-search.cjs');
module.exports=async function handler(req,res){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'Use GET'});
 const title=String(req.query?.title||'').trim().slice(0,150);
 const author=String(req.query?.author||'').trim().slice(0,100);
 if(title.length<3)return res.status(400).json({error:'Enter at least three letters of the title.'});
 try{
  const candidates=await searchTitles(title,author,{googleKey:process.env.GOOGLE_BOOKS_API_KEY||''});
  res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=600');
  return res.status(200).json({candidates,sources:['Open Library','Google Books','Internet Archive','Library of Congress','Gutendex'],note:'Possible works/editions. Confirm a match against the image; ISBN is never assumed.'});
 }catch{return res.status(503).json({error:'Catalogs unavailable. Enter the title and author manually.'})}
};
