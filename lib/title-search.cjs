'use strict';
const {similarity}=require('./scan-extraction.cjs');
function short(value,max=350){return String(value||'').replace(/\s+/g,' ').trim().slice(0,max)}
function first(value){return Array.isArray(value)?value.find(Boolean):value}
function list(value){return (Array.isArray(value)?value:[value]).filter(Boolean).map(v=>typeof v==='string'?v:v.name||'').filter(Boolean).slice(0,4).join(', ')}
function year(value){return (String(value||'').match(/\b(?:1[5-9]\d{2}|20\d{2}|21\d{2})\b/)||[])[0]||''}
async function searchTitles(title,author='',{fetchImpl=globalThis.fetch,googleKey='',timeout=6500}={}){
 const input=short(title,150),writer=short(author,100);
 if(input.length<3)return [];
 const signalFetch=async (url)=>{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
  try{const result=await fetchImpl(url,{signal:controller.signal,headers:{Accept:'application/json'}});if(!result.ok)throw Error(String(result.status));return result.json()}
  finally{clearTimeout(timer)}
 };
 const tasks=[
  async()=>{const p=new URLSearchParams({title:input,limit:'10',fields:'key,title,author_name,first_publish_year,publisher'});if(writer)p.set('author',writer);const r=await signalFetch('https://openlibrary.org/search.json?'+p);return (r.docs||[]).map(x=>({title:x.title,authors:list(x.author_name),publisher:short(first(x.publisher),200),publication_year:year(x.first_publish_year),source:'Open Library'}))},
  async()=>{const q='intitle:'+input+(writer?' inauthor:'+writer:'');const p=new URLSearchParams({q,maxResults:'10',printType:'books'});if(googleKey)p.set('key',googleKey);const r=await signalFetch('https://www.googleapis.com/books/v1/volumes?'+p);return (r.items||[]).map(x=>({title:x.volumeInfo?.title,authors:list(x.volumeInfo?.authors),publisher:x.volumeInfo?.publisher,publication_year:year(x.volumeInfo?.publishedDate),language:x.volumeInfo?.language||'',pages:String(x.volumeInfo?.pageCount||''),subject:list(x.volumeInfo?.categories),source:'Google Books'}))},
  async()=>{const query='title:("'+input.replace(/["():]/g,' ')+'")'+(writer?' AND creator:("'+writer.replace(/["():]/g,' ')+'")':'');const p=new URLSearchParams({q:query,rows:'10',output:'json'});['title','creator','publisher','date'].forEach(f=>p.append('fl[]',f));const r=await signalFetch('https://archive.org/advancedsearch.php?'+p);return (r.response?.docs||[]).map(x=>({title:x.title,authors:list(x.creator),publisher:short(first(x.publisher),200),publication_year:year(x.date),source:'Internet Archive'}))},
  async()=>{const p=new URLSearchParams({fo:'json',q:input,c:'10',at:'results'});const r=await signalFetch('https://www.loc.gov/books/?'+p);return (r.results||[]).map(x=>({title:x.title,authors:list(x.contributor),publisher:short(first(x.publisher),200),publication_year:year(x.date),source:'Library of Congress'}))},
  async()=>{const p=new URLSearchParams({search:input});const r=await signalFetch('https://gutendex.com/books/?'+p);return (r.results||[]).map(x=>({title:x.title,authors:list(x.authors),language:list(x.languages),source:'Gutendex'}))},
  async()=>{const q=new URLSearchParams({'query.bibliographic':[input,writer].filter(Boolean).join(' '),rows:'8',filter:'type:book',select:'title,author,publisher,published,subject,type'});
   const r=await signalFetch('https://api.crossref.org/works?'+q);return (r.message?.items||[]).map(x=>({title:first(x.title),authors:list((x.author||[]).map(a=>[a.given,a.family].filter(Boolean).join(' '))),publisher:x.publisher,publication_year:year(first(x.published?.['date-parts'])?.[0]),subject:list(x.subject),source:'Crossref'}))},
  async()=>{const p=new URLSearchParams({search:[input,writer].filter(Boolean).join(' '),filter:'type:book',per_page:'10'});
   const r=await signalFetch('https://api.openalex.org/works?'+p);return (r.results||[]).filter(x=>x.type==='book').map(x=>({title:x.display_name||x.title,authors:list((x.authorships||[]).map(a=>a.author?.display_name)),publication_year:year(x.publication_year),language:x.language,source:'OpenAlex'}))}
 ];
 const settled=await Promise.allSettled(tasks.map(f=>f()));
 const found=settled.flatMap(r=>r.status==='fulfilled'?r.value:[]);
 const unique=new Map();
 for(const record of found){
  const candidate={title:short(record.title),authors:short(record.authors),publisher:short(record.publisher,200),publication_year:year(record.publication_year),language:short(record.language,30),pages:short(record.pages,20),subject:short(record.subject,350),source:record.source};
  if(!candidate.title||similarity(input,candidate.title)<0.34)continue;
  // Deduplicate by title and author rather than guessed ISBN.
  const key=(candidate.title+'|'+candidate.authors).toLowerCase().replace(/[^a-z\d]/g,'');
  const previous=unique.get(key);
  if(previous){for(const k of ['authors','publisher','publication_year','language','pages','subject'])if(!previous[k]&&candidate[k])previous[k]=candidate[k];previous.source+=', '+candidate.source;continue}
  candidate.score=Number((similarity(input,candidate.title)*.85+(writer&&candidate.authors?similarity(writer,candidate.authors)*.15:0)).toFixed(3));
  unique.set(key,candidate);
 }
 return [...unique.values()].sort((a,b)=>b.score-a.score).slice(0,12);
}
module.exports={searchTitles};
