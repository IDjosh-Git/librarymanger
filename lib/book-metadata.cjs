'use strict';
/* Public, ISBN-specific book metadata. No database writes and no user-controlled upstream URLs. */
const FIELD_NAMES=['title','authors','publisher','publication_year','language','pages','subject'];
const cache=new Map();
const inFlight=new Map();
const quota=new Map();
const minute=60_000;
let openLibraryNext=0;
async function openLibraryJson(url,opts){
 // Open Library requests are identified and paced per serverless instance.
 if(opts.fetchImpl===globalThis.fetch){const interval=opts.headers?.['User-Agent']?360:1100;const start=Math.max(Date.now(),openLibraryNext);openLibraryNext=start+interval;if(start>Date.now())await new Promise(resolve=>setTimeout(resolve,start-Date.now()))}
 return json(url,opts);
}
const tidy=x=>String(x??'').trim();
const first=x=>Array.isArray(x)?x.find(Boolean):x;
const names=(xs,max=4)=>Array.isArray(xs)?xs.map(x=>typeof x==='string'?x:x?.name||[x?.given,x?.family].filter(Boolean).join(' ')).map(tidy).filter(Boolean).slice(0,max).join('; '):tidy(xs);
const year=x=>{const m=tidy(x).match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);return m?m[1]:''};
const digitISBN=x=>tidy(x).replace(/^ISBN(?:-1[03])?:?\s*/i,'').replace(/[\s-]/g,'').toUpperCase();
function validISBN(value){const x=digitISBN(value);if(/^\d{9}[\dX]$/.test(x)){let s=0;for(let i=0;i<10;i++)s+=(10-i)*(x[i]==='X'?10:Number(x[i]));return s%11===0}if(/^97[89]\d{10}$/.test(x)){let s=0;for(let i=0;i<13;i++)s+=Number(x[i])*(i%2?3:1);return s%10===0}return false}
function isbn13(code){const s=digitISBN(code);if(s.length===13)return s;if(!validISBN(s))return '';const t='978'+s.slice(0,9);let sum=0;for(let i=0;i<12;i++)sum+=Number(t[i])*(i%2?3:1);return t+((10-sum%10)%10)}
function sameISBN(a,b){return !!a&&!!b&&validISBN(a)&&validISBN(b)&&isbn13(a)===isbn13(b)}
function anyISBN(arr,code){return (Array.isArray(arr)?arr:[arr]).some(x=>sameISBN(x,code))}
function bounded(x,length=260){return tidy(x).replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,length)}
function metadata(x){const obj={};for(const k of FIELD_NAMES)obj[k]=bounded(x?.[k],k==='subject'?550:260);return obj}
function useful(x){return !!tidy(x?.title)}
function merge(left,right){const merged={...left};for(const k of FIELD_NAMES){if(!merged[k]&&right?.[k])merged[k]=right[k]}return merged}
async function json(url,{fetchImpl=globalThis.fetch,headers={},timeout=4100}={}){
 const ac=new AbortController();const timeoutId=setTimeout(()=>ac.abort(),timeout);
 try{const response=await fetchImpl(url,{headers:{Accept:'application/json',...headers},signal:ac.signal,redirect:'follow'});
 if(!response.ok)throw new Error('Upstream HTTP '+response.status);
 const size=Number(response.headers?.get?.('content-length')||0);if(size>1_200_000)throw new Error('Response too large');
 const text=await response.text();if(text.length>1_200_000)throw new Error('Response too large');return JSON.parse(text);
 }finally{clearTimeout(timeoutId)}
}
const sourceNames={google:'Google Books',openSearch:'Open Library Search',openEdition:'Open Library Edition',hathi:'HathiTrust',crossref:'Crossref',loc:'Library of Congress',isbndb:'ISBNdb'};
async function google(code,opts){let u='https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent('isbn:'+code)+'&maxResults=5&printType=books';if(opts.googleKey)u+='&key='+encodeURIComponent(opts.googleKey);const d=await json(u,opts);const v=(d.items||[]).find(x=>anyISBN((x.volumeInfo?.industryIdentifiers||[]).map(z=>z.identifier),code))?.volumeInfo;if(!v)return null;return metadata({title:v.title,authors:names(v.authors),publisher:v.publisher,publication_year:year(v.publishedDate),language:v.language,pages:v.pageCount,subject:names(v.categories,7)})}
async function openSearch(code,opts){const fields='title,author_name,publisher,first_publish_year,language,number_of_pages_median,subject,isbn';const u='https://openlibrary.org/search.json?isbn='+encodeURIComponent(code)+'&fields='+encodeURIComponent(fields)+'&limit=4';const d=await openLibraryJson(u,opts);const r=(d.docs||[]).find(x=>anyISBN(x.isbn||[],code));if(!r)return null;return metadata({title:r.title,authors:names(r.author_name),publisher:names(r.publisher,3),publication_year:'',language:names(r.language,3),pages:r.number_of_pages_median,subject:names(r.subject,6)})}
async function openEdition(code,opts){const d=await openLibraryJson('https://openlibrary.org/isbn/'+encodeURIComponent(code)+'.json',opts);if(!d?.title||!anyISBN([...(d.isbn_13||[]),...(d.isbn_10||[])],code))return null;return metadata({title:d.title,authors:names(d.by_statement||'',1),publisher:names(d.publishers,3),publication_year:year(d.publish_date),language:names((d.languages||[]).map(x=>x.key?.split('/').pop()),3),pages:d.number_of_pages,subject:names(d.subjects,6)})}
async function hathi(code,opts){const d=await json('https://catalog.hathitrust.org/api/volumes/brief/isbn/'+encodeURIComponent(code)+'.json',opts);const r=Object.values(d.records||{}).find(x=>anyISBN(x.isbns||[],code));if(!r)return null;return metadata({title:first(r.titles),authors:names(r.authors),publisher:names(r.publishers),publication_year:year(first(r.publishDates)),language:names(r.languages),pages:first(r.pages),subject:names(r.subjects,6)})}
async function crossref(code,opts){const d=await json('https://api.crossref.org/works?filter='+encodeURIComponent('isbn:'+code)+'&rows=4&select=ISBN,title,author,publisher,published,subject,type',opts);const r=(d.message?.items||[]).find(x=>anyISBN(x.ISBN||[],code)&&['book','monograph','edited-book','reference-book','book-series'].includes(x.type));if(!r)return null;return metadata({title:first(r.title),authors:names(r.author),publisher:r.publisher,publication_year:first(r.published?.['date-parts'])?.[0],subject:names(r.subject,5)})}
async function loc(code,opts){const d=await json('https://www.loc.gov/books/?fo=json&q='+encodeURIComponent(code)+'&c=10&at=results',opts);const matches=(d.results||[]).filter(x=>anyISBN([...(Array.isArray(x.isbn)?x.isbn:[x.isbn]),...(Array.isArray(x.item?.isbn)?x.item.isbn:[x.item?.isbn])],code));const r=matches[0];if(!r)return null;return metadata({title:r.title,authors:names(r.contributor),publisher:names(r.publisher),publication_year:year(r.date),language:names(r.language),subject:names(r.subject,6)})}
async function isbndb(code,opts){if(!opts.isbndbKey)return null;const d=await json('https://api2.isbndb.com/book/'+encodeURIComponent(code),{...opts,headers:{Authorization:opts.isbndbKey}});const r=d.book;if(!r||!anyISBN([r.isbn,r.isbn13,r.isbn10],code))return null;return metadata({title:r.title,authors:names(r.authors),publisher:r.publisher,publication_year:year(r.date_published||r.date),language:r.language,pages:r.pages,subject:names(r.subjects,6)})}
async function lookup(code,{fetchImpl=globalThis.fetch,googleKey=process.env.GOOGLE_BOOKS_API_KEY||'',isbndbKey=process.env.ISBNDB_API_KEY||'',contact=process.env.BOOK_API_CONTACT||'',timeout=4100}={}){
 const isbn=digitISBN(code);if(!validISBN(isbn))throw Object.assign(new Error('Enter a valid ISBN-10 or ISBN-13, including its check digit.'),{status:400});
 const headers={};if(tidy(contact)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))headers['User-Agent']='LibraryManager/4.0 ('+contact+')';
 const opts={fetchImpl,googleKey,isbndbKey,headers,timeout};const diagnostics=[];let result=metadata({});const sources=[];
 async function run(id,fn){try{const item=await fn(isbn,opts);diagnostics.push({source:sourceNames[id],status:item&&useful(item)?'found':'no_match'});return item&&useful(item)?item:null}catch{diagnostics.push({source:sourceNames[id],status:'unavailable'});return null}}
 // Open Library gets one edition request per ISBN normally; search is the optional enrichment lookup.
 const primary=await Promise.all([run('google',google),run('openEdition',openEdition),run('hathi',hathi)]);
 // Preserve the matched Google edition first; don't overwrite a field with data from a different edition.
 primary.forEach((item,i)=>{if(item){result=merge(result,item);sources.push([sourceNames.google,sourceNames.openEdition,sourceNames.hathi][i])}});
 if(!result.title||!result.publisher||!result.publication_year||!result.authors){
   // Crossref only contributes records with an ISBN match; ISBNdb is opt-in and paid.
   const secondary=await Promise.all([run('openSearch',openSearch),run('crossref',crossref),isbndbKey?run('isbndb',isbndb):Promise.resolve(null)]);
   secondary.forEach((item,i)=>{if(item){result=merge(result,item);sources.push([sourceNames.openSearch,sourceNames.crossref,sourceNames.isbndb][i])}});
 }
 if(!result.title){const final=await run('loc',loc);if(final){result=merge(result,final);sources.push(sourceNames.loc)}}
 return{found:!!result.title,metadata:result,sources,checked:diagnostics};
}
function limited(ip){const now=Date.now();if(quota.size>2000)for(const [k,v] of quota)if(now-v.start>minute)quota.delete(k);const key=tidy(ip).slice(0,100)||'unknown';const row=quota.get(key);if(!row||now-row.start>minute){quota.set(key,{start:now,count:1});return false}row.count++;return row.count>30}
function cachedLookup(code,opts){const key=digitISBN(code)+'|'+Boolean(opts.googleKey)+'|'+Boolean(opts.isbndbKey);const c=cache.get(key);if(c&&c.exp>Date.now())return Promise.resolve(c.value);if(inFlight.has(key))return inFlight.get(key);const p=lookup(code,opts).then(value=>{cache.set(key,{value,exp:Date.now()+(value.found?86_400_000:300_000)});if(cache.size>500)cache.delete(cache.keys().next().value);return value}).finally(()=>inFlight.delete(key));inFlight.set(key,p);return p}
module.exports={lookup,cachedLookup,validISBN,digitISBN,sameISBN,limited,metadata,merge,sourceNames};
