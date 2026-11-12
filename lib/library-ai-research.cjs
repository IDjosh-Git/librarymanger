'use strict';
/* External bibliographic enrichment. Exact ISBN or strong title+author checks
   prevent another book/edition from contaminating an inventory response. */
const {validISBN,digitISBN,sameISBN}=require('./book-metadata.cjs');
const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const neat=(s,max=1200)=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/[\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const cache=new Map();
function sameTitle(a,b){const x=norm(a),y=norm(b);if(!x||!y)return false;if(x===y)return true;const ts=x.split(' ').filter(w=>w.length>2),us=y.split(' ').filter(w=>w.length>2);const overlap=ts.filter(w=>us.includes(w)).length;return overlap>=2&&overlap/Math.min(ts.length,us.length)>=.75;}
function sameAuthor(a,b){if(!a||!b)return false;const token=s=>norm(s).split(' ').filter(w=>w.length>2);const peopleA=String(a).split(/;|\band\b|&/),peopleB=String(b).split(/;|\band\b|&/);return peopleA.some(a1=>peopleB.some(b1=>{const x=token(a1),y=token(b1);return x.length>=2&&y.length>=2&&x.filter(t=>y.includes(t)).length>=2;}));}
function matched(book,record){
 if(validISBN(book.isbn)){return (record.isbns||[]).some(id=>sameISBN(book.isbn,id))&&sameTitle(book.title,record.title);}
 return sameTitle(book.title,record.title)&&!!book.authors&&!!record.authors&&sameAuthor(book.authors,record.authors);
}
async function getJSON(url,fetchImpl,ms=3500){
 const ac=new AbortController(),timeout=setTimeout(()=>ac.abort(),ms);
 try{const response=await fetchImpl(url,{headers:{Accept:'application/json','User-Agent':'LibraryManager/5.29 (bibliographic-metadata)'},redirect:'follow',signal:ac.signal});if(!response.ok)throw new Error('Upstream error');const len=Number(response.headers?.get?.('content-length')||0);if(len>800000)throw new Error('Too large');const content=await response.text();if(content.length>800000)throw new Error('Too large');return JSON.parse(content);}finally{clearTimeout(timeout)}
}
function googles(book,items=[]){
 for(const item of items){const v=item?.volumeInfo;if(!v?.title)continue;
  const candidate={title:v.title,authors:Array.isArray(v.authors)?v.authors.join('; '):'',isbns:(v.industryIdentifiers||[]).map(x=>x.identifier||'')};
  if(!matched(book,candidate))continue;
  const id=String(item.id||'').replace(/[^a-zA-Z0-9_-]/g,'');
  return {title:neat(v.title),authors:neat(candidate.authors),description:neat(v.description,450),publisher:neat(v.publisher),year:neat(v.publishedDate,30),pages:typeof v.pageCount==='number'?String(v.pageCount):'',subjects:Array.isArray(v.categories)?v.categories.map(x=>neat(x,150)).join('; ').slice(0,400):'',source:'Google Books',url:id?'https://books.google.com/books?id='+encodeURIComponent(id):'https://books.google.com/'};
 }return null;
}
function openlibrary(book,item){
 if(!item?.title)return null;
 const id=String(item.key||'').match(/^\/books\/(OL\d+M)$/)?.[1];
 const candidate={title:item.title,authors:'',isbns:[...(Array.isArray(item.isbn_13)?item.isbn_13:[]),...(Array.isArray(item.isbn_10)?item.isbn_10:[]),...(Array.isArray(item.isbn)?item.isbn:[])]};
 // Edition endpoint can be accepted by exact ISBN; otherwise require author names in Search API.
 if(!matched(book,candidate))return null;
 return {title:neat(item.title),authors:'',description:neat(typeof item.description==='string'?item.description:item.description?.value,450),publisher:neat(Array.isArray(item.publishers)?item.publishers.join('; '):''),year:neat(item.publish_date),pages:item.number_of_pages?String(item.number_of_pages):'',subjects:Array.isArray(item.subjects)?item.subjects.slice(0,8).map(x=>neat(x,120)).join('; '):'',source:'Open Library',url:id?'https://openlibrary.org/books/'+id:'https://openlibrary.org/'};
}
async function lookup(book,{fetchImpl=globalThis.fetch,googleKey=process.env.GOOGLE_BOOKS_API_KEY||''}={}){
 if(!book?.title)return {records:[],checked:false};
 const id=validISBN(book.isbn)?digitISBN(book.isbn):'';
 const cacheKey=[norm(book.title),norm(book.authors),id].join('|');
 const cached=cache.get(cacheKey);if(cached&&cached.expires>Date.now())return cached.value;
 const tasks=[];
 const q=id?'isbn:'+id:'intitle:'+String(book.title).slice(0,90)+(book.authors?' inauthor:'+String(book.authors).split(/[;,]/)[0].slice(0,70):'');
 const googleUrl='https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent(q)+'&maxResults=8&printType=books'+(googleKey?'&key='+encodeURIComponent(googleKey):'');
 tasks.push(getJSON(googleUrl,fetchImpl).then(d=>googles(book,d.items)).catch(()=>null));
 if(id)tasks.push(getJSON('https://openlibrary.org/isbn/'+encodeURIComponent(id)+'.json',fetchImpl).then(d=>openlibrary(book,d)).catch(()=>null));
 const results=(await Promise.all(tasks)).filter(Boolean);
 const unique=results.filter((x,i,a)=>a.findIndex(v=>v.source===x.source)===i);
 const value={records:unique,checked:true};cache.set(cacheKey,{value,expires:Date.now()+3600_000});if(cache.size>150)cache.delete(cache.keys().next().value);return value;
}
function summary(records){const selected=records.filter(x=>x.description||x.subjects).slice(0,2);return selected.map(r=>({source:r.source,title:r.title,authors:r.authors,description:r.description,topics:r.subjects,publisher:r.publisher,year:r.year,pages:r.pages,url:r.url}));}
function text(records){if(!records.length)return '\n**External book information:** No reliably matched Google Books or Open Library details were found. Do not assume a generic internet result is the same book.';
 return '\n**Verified external book information:**\n'+records.slice(0,2).map(r=>{
 const lines=['**'+r.source+':** '+r.title];if(r.description)lines.push('Description: '+r.description);if(r.subjects)lines.push('Topics: '+r.subjects);return lines.join('\n');
 }).join('\n')+'\nExternal descriptions are catalogue/publisher summaries, not a verified reading of the complete book.';
}
module.exports={lookup,summary,text,matched,sameTitle,neat,googles,openlibrary};
