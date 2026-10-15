'use strict';
const {cachedLookup,identifierKind,limited,sourceNames}=require('../lib/book-metadata.cjs');
module.exports=async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Use GET with an ISBN or book barcode.'})}
 if(!req.query?.isbn&&!req.query?.code){res.setHeader('Cache-Control','no-store');return res.status(200).json({status:'ready',sources:Object.values(sourceNames),optionalPaidSource:'ISBNdb (requires ISBNDB_API_KEY)',hasGoogleKey:!!process.env.GOOGLE_BOOKS_API_KEY,hasIsbndbKey:!!process.env.ISBNDB_API_KEY})}
 const identifier=identifierKind(req.query.code||req.query.isbn);
 if(identifier.kind==='unsupported')return res.status(400).json({error:'Enter an ISBN, EAN, UPC or other book barcode (up to 80 characters).'});
 const ip=(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0];
 if(limited(ip)){res.setHeader('Retry-After','60');return res.status(429).json({error:'Too many lookups from this address. Try again in a minute.'})}
 try{const data=await cachedLookup(identifier.code,{googleKey:process.env.GOOGLE_BOOKS_API_KEY||'',isbndbKey:process.env.ISBNDB_API_KEY||'',contact:process.env.BOOK_API_CONTACT||''});res.setHeader('Cache-Control',`public, s-maxage=${data.found?3600:30}, stale-while-revalidate=300`);return res.status(200).json(data)}
 catch{res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'Book lookup is temporarily unavailable. Try title search or edit the book details.'})}
};
