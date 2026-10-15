'use strict';
/* Public, ISBN-specific book metadata. No database writes and no user-controlled upstream URLs. */
const FIELD_NAMES=['title','authors','publisher','publication_year','language','pages','subject'];
const CORE_FIELDS=['title','authors','publisher','publication_year'];
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
const digitISBN=x=>{
 let value=tidy(x).replace(/[\u0000-\u001f\u007f]/g,'').replace(/^\][A-Z0-9]{2}/i,'').replace(/^ISBN(?:[\s-]*1[03])?\s*[:#]?\s*/i,'').replace(/[\s-]/g,'').toUpperCase();
 // Some book scanners append EAN-2/EAN-5 price supplements, or encode
 // the same Bookland EAN as a GTIN-14 with a leading packaging zero.
 const padded=value.match(/^0(97[89]\d{10})(?:\d{2}|\d{5})?$/);
 if(padded)value=padded[1];
 const supplement=value.match(/^(97[89]\d{10})(?:\d{2}|\d{5})$/);
 if(supplement)value=supplement[1];
 // The 9-digit historical Standard Book Number is ISBN-10 with leading 0.
 if(/^SBN\d{9}$/i.test(value))value='0'+value.slice(3);
 return value
};
function validISBN(value){const x=digitISBN(value);if(/^\d{9}[\dX]$/.test(x)){let s=0;for(let i=0;i<10;i++)s+=(10-i)*(x[i]==='X'?10:Number(x[i]));return s%11===0}if(/^97[89]\d{10}$/.test(x)){let s=0;for(let i=0;i<13;i++)s+=Number(x[i])*(i%2?3:1);return s%10===0}return false}
function isbn13(code){const s=digitISBN(code);if(s.length===13)return s;if(!validISBN(s))return '';const t='978'+s.slice(0,9);let sum=0;for(let i=0;i<12;i++)sum+=Number(t[i])*(i%2?3:1);return t+((10-sum%10)%10)}
function sameISBN(a,b){return !!a&&!!b&&validISBN(a)&&validISBN(b)&&isbn13(a)===isbn13(b)}
function isbnVariants(code){const entered=digitISBN(code),variants=[entered];if(!validISBN(entered))return variants;const as13=isbn13(entered);if(as13!==entered)variants.push(as13);if(as13.startsWith('978')){const body=as13.slice(3,12);let sum=0;for(let i=0;i<9;i++)sum+=(10-i)*Number(body[i]);const check=(11-sum%11)%11;const as10=body+(check===10?'X':String(check));if(!variants.includes(as10))variants.push(as10)}return variants}
function anyISBN(arr,code){return (Array.isArray(arr)?arr:[arr]).some(x=>sameISBN(x,code))}
function bounded(x,length=260){return tidy(x).replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,length)}
function metadata(x){const obj={};for(const k of FIELD_NAMES)obj[k]=bounded(x?.[k],k==='subject'?550:260);return obj}
function useful(x){return !!tidy(x?.title)}
function compatibleTitles(a,b){
 const norm=x=>tidy(x).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
 const left=norm(a),right=norm(b);if(!left||!right||left===right||left.includes(right)||right.includes(left))return true;
 const aa=new Set(left.split(' ').filter(x=>x.length>2)),bb=new Set(right.split(' ').filter(x=>x.length>2));
 const common=[...aa].filter(x=>bb.has(x)).length;
 return common>=2&&common/Math.min(Math.max(1,aa.size),Math.max(1,bb.size))>=.5;
}
function merge(left,right){const merged={...left};if(!compatibleTitles(merged.title,right?.title))return merged;for(const k of FIELD_NAMES){if(!merged[k]&&right?.[k])merged[k]=right[k]}return merged}
async function json(url,{fetchImpl=globalThis.fetch,headers={},timeout=4100}={}){
 const ac=new AbortController();const timeoutId=setTimeout(()=>ac.abort(),timeout);
 try{const response=await fetchImpl(url,{headers:{Accept:'application/json',...headers},signal:ac.signal,redirect:'follow'});
 if(!response.ok)throw new Error('Upstream HTTP '+response.status);
 const size=Number(response.headers?.get?.('content-length')||0);if(size>1_200_000)throw new Error('Response too large');
 const text=await response.text();if(text.length>1_200_000)throw new Error('Response too large');return JSON.parse(text);
 }finally{clearTimeout(timeoutId)}
}
const sourceNames={datacite:'DataCite',google:'Google Books',openSearch:'Open Library Search',openEdition:'Open Library Edition',openBooks:'Open Library Books API',hathi:'HathiTrust',crossref:'Crossref',loc:'Library of Congress',isbndb:'ISBNdb',internetArchive:'Internet Archive',wikidata:'Wikidata'};
async function google(code,opts){
 // Some Google Books editions are indexed under ISBN-10 rather than the printed ISBN-13.
 // Try both identifiers, and never accept a record without a matching identifier.
 for(const variant of isbnVariants(code).slice(0,2)){
  let u='https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent('isbn:'+variant)+'&maxResults=10&printType=books';
  if(opts.googleKey)u+='&key='+encodeURIComponent(opts.googleKey);
  const d=await json(u,opts);
  const matches=(d.items||[]).map(x=>x.volumeInfo).filter(v=>v?.title&&anyISBN((v.industryIdentifiers||[]).map(z=>z.identifier),code));
  if(matches.length){const score=v=>['authors','publisher','publishedDate','pageCount','language'].reduce((n,k)=>n+(v[k]?1:0),0);
   const v=matches.sort((a,b)=>score(b)-score(a))[0];
   return metadata({title:v.title,authors:names(v.authors),publisher:v.publisher,publication_year:year(v.publishedDate),language:v.language,pages:v.pageCount,subject:names(v.categories,7)})}
 }
 return null;
}
async function openSearch(code,opts){const fields='title,author_name,publisher,first_publish_year,language,number_of_pages_median,subject,isbn';const u='https://openlibrary.org/search.json?isbn='+encodeURIComponent(code)+'&fields='+encodeURIComponent(fields)+'&limit=4';const d=await openLibraryJson(u,opts);const r=(d.docs||[]).find(x=>anyISBN(x.isbn||[],code));if(!r)return null;return metadata({title:r.title,authors:names(r.author_name),publisher:'',publication_year:'',language:'',pages:'',subject:names(r.subject,6)})}
async function openEdition(code,opts){const d=await openLibraryJson('https://openlibrary.org/isbn/'+encodeURIComponent(code)+'.json',opts);if(!d?.title||!anyISBN([...(d.isbn_13||[]),...(d.isbn_10||[])],code))return null;return metadata({title:d.title,authors:names(d.by_statement||'',1),publisher:names(d.publishers,3),publication_year:year(d.publish_date),language:names((d.languages||[]).map(x=>x.key?.split('/').pop()),3),pages:d.number_of_pages,subject:names(d.subjects,6)})}
async function openBooks(code,opts){const u='https://openlibrary.org/api/books?bibkeys='+encodeURIComponent('ISBN:'+code)+'&format=json&jscmd=data';const d=await openLibraryJson(u,opts);const r=d['ISBN:'+code],identifiers=r?.identifiers||{};if(!r?.title||!anyISBN([...(identifiers.isbn_13||[]),...(identifiers.isbn_10||[])],code))return null;return metadata({title:r.title,authors:names(r.authors),publisher:names(r.publishers,3),publication_year:year(r.publish_date),language:names((r.languages||[]).map(x=>x.key?.split('/').pop()),3),pages:r.number_of_pages,subject:names(r.subjects,6)})}
async function hathi(code,opts){const d=await json('https://catalog.hathitrust.org/api/volumes/brief/isbn/'+encodeURIComponent(code)+'.json',opts);const r=Object.values(d.records||{}).find(x=>anyISBN(x.isbns||[],code));if(!r)return null;return metadata({title:first(r.titles),authors:names(r.authors),publisher:names(r.publishers),publication_year:year(first(r.publishDates)),language:names(r.languages),pages:first(r.pages),subject:names(r.subjects,6)})}
async function crossref(code,opts){const d=await json('https://api.crossref.org/works?filter='+encodeURIComponent('isbn:'+code)+'&rows=4&select=ISBN,title,author,publisher,published,subject,type',opts);const r=(d.message?.items||[]).find(x=>anyISBN(x.ISBN||[],code)&&['book','monograph','edited-book','reference-book','book-series'].includes(x.type));if(!r)return null;return metadata({title:first(r.title),authors:names(r.author),publisher:r.publisher,publication_year:first(r.published?.['date-parts'])?.[0],subject:names(r.subject,5)})}
async function loc(code,opts){const d=await json('https://www.loc.gov/books/?fo=json&q='+encodeURIComponent(code)+'&c=10&at=results',opts);const matches=(d.results||[]).filter(x=>anyISBN([...(Array.isArray(x.isbn)?x.isbn:[x.isbn]),...(Array.isArray(x.item?.isbn)?x.item.isbn:[x.item?.isbn])],code));const r=matches[0];if(!r)return null;return metadata({title:r.title,authors:names(r.contributor),publisher:names(r.publisher),publication_year:year(r.date),language:names(r.language),subject:names(r.subject,6)})}
async function internetArchive(code,opts){const fields=['title','creator','publisher','date','year','language','number_of_pages','subject','isbn'];const u='https://archive.org/advancedsearch.php?q='+encodeURIComponent('isbn:'+code)+'&fl[]='+fields.map(encodeURIComponent).join('&fl[]=')+'&rows=5&output=json';const d=await json(u,opts);const r=(d.response?.docs||[]).find(x=>anyISBN(x.isbn||[],code));if(!r)return null;return metadata({title:r.title,authors:names(r.creator),publisher:names(r.publisher),publication_year:year(r.date||r.year),language:names(r.language),pages:r.number_of_pages,subject:names(r.subject,6)})}
async function wikidata(code,opts){const query=`SELECT ?isbn ?bookLabel ?authorLabel ?publisherLabel ?publicationDate ?languageLabel ?subjectLabel WHERE { { ?book wdt:P212 ?isbn. } UNION { ?book wdt:P957 ?isbn. } FILTER(REPLACE(STR(?isbn), "-", "") = "${code}") OPTIONAL { ?book wdt:P50 ?author. } OPTIONAL { ?book wdt:P123 ?publisher. } OPTIONAL { ?book wdt:P577 ?publicationDate. } OPTIONAL { ?book wdt:P407 ?language. } OPTIONAL { ?book wdt:P921 ?subject. } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 10`;const u='https://query.wikidata.org/sparql?query='+encodeURIComponent(query)+'&format=json';const d=await json(u,{...opts,headers:{...opts.headers,Accept:'application/sparql-results+json'}});const rows=(d.results?.bindings||[]).filter(x=>sameISBN(x.isbn?.value,code));if(!rows.length)return null;const values=key=>[...new Set(rows.map(x=>x[key]?.value).filter(Boolean))].join('; ');return metadata({title:values('bookLabel'),authors:values('authorLabel'),publisher:values('publisherLabel'),publication_year:year(values('publicationDate')),language:values('languageLabel'),subject:values('subjectLabel')})}
// DataCite registers book/research DOIs. Only ISBN identifiers on the DOI record
// can establish an exact match. A full-text query hit alone is NEVER sufficient.
async function datacite(code,opts){
 const query='identifiers.identifier:'+code+' OR relatedIdentifiers.relatedIdentifier:'+code;
 const u='https://api.datacite.org/dois?query='+encodeURIComponent(query)+'&page[size]=5';
 const d=await json(u,opts);
 const candidates=(d.data||[]).map(x=>x.attributes||{});
 const r=candidates.find(x=>{
  const kind=String(x.types?.resourceTypeGeneral||x.types?.resourceType||'').toLowerCase();
  if(kind&&!/book|monograph|text|chapter/.test(kind))return false;
  const identifiers=[...(x.identifiers||[]).map(z=>z.identifier),...(x.alternateIdentifiers||[]).map(z=>z.alternateIdentifier),...(x.relatedIdentifiers||[]).filter(z=>/ISBN/i.test(z.relatedIdentifierType||'')).map(z=>z.relatedIdentifier)];
  return anyISBN(identifiers,code);
 });
 if(!r)return null;
 return metadata({title:first((r.titles||[]).map(x=>x.title)),authors:names((r.creators||[]).map(x=>x.name||[x.givenName,x.familyName].filter(Boolean).join(' '))),publisher:typeof r.publisher==='object'?r.publisher?.name:r.publisher,publication_year:year(r.publicationYear),language:r.language,subject:names((r.subjects||[]).map(x=>x.subject),6)});
}
async function isbndb(code,opts){if(!opts.isbndbKey)return null;const d=await json('https://api2.isbndb.com/book/'+encodeURIComponent(code),{...opts,headers:{Authorization:opts.isbndbKey}});const r=d.book;if(!r||!anyISBN([r.isbn,r.isbn13,r.isbn10],code))return null;return metadata({title:r.title,authors:names(r.authors),publisher:r.publisher,publication_year:year(r.date_published||r.date),language:r.language,pages:r.pages,subject:names(r.subjects,6)})}
async function lookup(code,{fetchImpl=globalThis.fetch,googleKey=process.env.GOOGLE_BOOKS_API_KEY||'',isbndbKey=process.env.ISBNDB_API_KEY||'',contact=process.env.BOOK_API_CONTACT||'',timeout=4100}={}){
 const isbn=digitISBN(code);if(!validISBN(isbn))throw Object.assign(new Error('Enter a valid ISBN-10 or ISBN-13, including its check digit.'),{status:400});
 const headers={};if(tidy(contact)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))headers['User-Agent']='LibraryManager/4.0 ('+contact+')';
 const opts={fetchImpl,googleKey,isbndbKey,headers,timeout};const diagnostics=[];let result=metadata({});const sources=[];
 async function run(id,fn){try{const item=await fn(isbn,opts);diagnostics.push({source:sourceNames[id],status:item&&useful(item)?'found':'no_match'});return item&&useful(item)?item:null}catch{diagnostics.push({source:sourceNames[id],status:'unavailable'});return null}}
 // Query secondary catalogs only when a core bibliographic field is still missing.
 const primary=await Promise.all([run('google',google),run('openEdition',openEdition),run('hathi',hathi)]);
 // Preserve the matched Google edition first; don't overwrite a field with data from a different edition.
 primary.forEach((item,i)=>{if(item){result=merge(result,item);sources.push([sourceNames.google,sourceNames.openEdition,sourceNames.hathi][i])}});
 if(CORE_FIELDS.some(field=>!result[field])){
   // Crossref only contributes records with an ISBN match; ISBNdb is opt-in and paid.
   const secondary=await Promise.all([run('openSearch',openSearch),run('openBooks',openBooks),run('crossref',crossref),run('datacite',datacite),isbndbKey?run('isbndb',isbndb):Promise.resolve(null),run('internetArchive',internetArchive),run('wikidata',wikidata)]);
   secondary.forEach((item,i)=>{if(item){result=merge(result,item);sources.push([sourceNames.openSearch,sourceNames.openBooks,sourceNames.crossref,sourceNames.datacite,sourceNames.isbndb,sourceNames.internetArchive,sourceNames.wikidata][i])}});
 }
 if(!result.title){const final=await run('loc',loc);if(final){result=merge(result,final);sources.push(sourceNames.loc)}}
 return{found:!!result.title,metadata:result,sources,checked:diagnostics,partial:!!result.title&&CORE_FIELDS.some(field=>!result[field])};
}

// A product barcode is not automatically an ISBN. Search only exact identifiers
// to avoid assigning metadata from an unrelated title or product.
function identifierKind(raw){
 const isbn=digitISBN(raw);
 if(validISBN(isbn))return {kind:'isbn',code:isbn};
 const scanned=tidy(raw).replace(/^\][A-Z0-9]{2}\s*/i,'').replace(/^ISBN(?:[\s-]*1[03])?\s*[:#]?\s*/i,'').replace(/^[\s\-]+|[\s\-]+$/g,'').toUpperCase();
 const compact=/^[0-9\s\-]+$/.test(scanned)?scanned.replace(/[\s\-]/g,''):scanned;
 if(!compact||compact.length>80||/[\u0000-\u001f]/.test(compact))return {kind:'unsupported',code:''};
 return {kind:'barcode',code:compact};
}
function comparableBarcode(raw){return tidy(raw).replace(/^\][A-Z0-9]{2}\s*/i,'').replace(/[\s\-]/g,'').toUpperCase()}
function barcodeMatches(actual,entered){
 const a=comparableBarcode(actual),b=comparableBarcode(entered);
 if(!a||!b)return false;
 if(a===b)return true;
 // A UPC-A 12-digit code and its leading-zero GTIN-13 are the same product.
 return /^\d{12}$/.test(a)&&b==='0'+a || /^\d{12}$/.test(b)&&a==='0'+b;
}
async function googleBarcode(code,opts){
 const id=identifierKind(code);if(id.kind!=='barcode')return null;
 let url='https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent(id.code)+'&maxResults=20&printType=books';
 if(opts.googleKey)url+='&key='+encodeURIComponent(opts.googleKey);
 const data=await json(url,opts);
 const volumes=(data.items||[]).map(x=>x.volumeInfo).filter(v=>v?.title&&
   (v.industryIdentifiers||[]).some(z=>barcodeMatches(z.identifier,id.code)));
 if(!volumes.length)return null;
 const v=volumes.sort((a,b)=>(Number(!!b.publisher)+Number(!!b.authors))-(Number(!!a.publisher)+Number(!!a.authors)))[0];
 return metadata({title:v.title,authors:names(v.authors),publisher:v.publisher,publication_year:year(v.publishedDate),language:v.language,pages:v.pageCount,subject:names(v.categories,7)});
}
async function lookupIdentifier(code,opts={}){
 const id=identifierKind(code);
 if(id.kind==='isbn')return lookup(id.code,opts);
 if(id.kind==='unsupported')return {found:false,metadata:metadata({}),sources:[],checked:[],partial:false,identifierType:'unsupported'};
 const item=await googleBarcode(id.code,{fetchImpl:opts.fetchImpl||globalThis.fetch,googleKey:opts.googleKey||process.env.GOOGLE_BOOKS_API_KEY||'',timeout:opts.timeout||4100});
 return {found:!!item,metadata:item||metadata({}),sources:item?['Google Books (exact barcode)']:[],checked:[{source:'Google Books (exact barcode)',status:item?'found':'no_match'}],partial:!!item&&CORE_FIELDS.some(field=>!item[field]),identifierType:'barcode'};
}

function limited(ip){const now=Date.now();if(quota.size>2000)for(const [k,v] of quota)if(now-v.start>minute)quota.delete(k);const key=tidy(ip).slice(0,100)||'unknown';const row=quota.get(key);if(!row||now-row.start>minute){quota.set(key,{start:now,count:1});return false}row.count++;return row.count>100}
function cachedLookup(code,opts){const key=identifierKind(code).code+'|'+Boolean(opts.googleKey)+'|'+Boolean(opts.isbndbKey);const c=cache.get(key);if(c&&c.exp>Date.now())return Promise.resolve(c.value);if(inFlight.has(key))return inFlight.get(key);const p=lookupIdentifier(code,opts).then(value=>{cache.set(key,{value,exp:Date.now()+(value.found?86_400_000:45_000)});if(cache.size>500)cache.delete(cache.keys().next().value);return value}).finally(()=>inFlight.delete(key));inFlight.set(key,p);return p}
module.exports={lookup,lookupIdentifier,cachedLookup,validISBN,digitISBN,identifierKind,barcodeMatches,sameISBN,limited,metadata,merge,sourceNames};
