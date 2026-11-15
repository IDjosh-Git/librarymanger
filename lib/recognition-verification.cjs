'use strict';
const {isbnValid}=require('./recognition-fusion.cjs');
function norm(s){return String(s||'').toLocaleLowerCase('en').normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
function comparable(a,b){const x=norm(a),y=norm(b);if(!x||!y)return false;return x===y||(x.length>12&&y.length>12&&(x.includes(y)||y.includes(x)))}
function authorMatch(recognized,catalogue){const parts=String(recognized||'').split(/\s*(?:,|;|\band\b|&)\s*/i).filter(Boolean);return parts.some(part=>catalogue.some(name=>comparable(part,name)))}
async function verify(metadata,{fetcher=fetch,timeoutMs=4500}={}){
 const isbn=String(metadata?.isbn||'').replace(/[-\s]/g,'').toUpperCase();
 const out={verified:false,source:null,source_url:null,fields:{},status:'not_checked'};
 if(!isbnValid(isbn)){out.status='no_valid_isbn';return out}
 try{
  const url='https://openlibrary.org/isbn/'+encodeURIComponent(isbn)+'.json';
  const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok){out.status=response.status===404?'not_found':'provider_unavailable';return out}
  const data=await response.json();
  const titleMatch=comparable(metadata.title,data.title);
  out.fields.title={matched:titleMatch,recognized:metadata.title||'',catalogue:data.title||''};
  out.fields.isbn={matched:true,recognized:isbn,catalogue:isbn};
  out.source='Open Library';out.source_url=url;
  const year=String(data.publish_date||'').match(/\b(?:1[5-9]\d{2}|20\d{2})\b/)?.[0]||'';
  if(metadata.publication_year&&year)out.fields.publication_year={matched:String(metadata.publication_year).trim()===year,recognized:String(metadata.publication_year),catalogue:year};
  const authorRefs=Array.isArray(data.authors)?data.authors.filter(x=>/^\/authors\/OL\w+A$/.test(x?.key||'')).slice(0,5):[];
  if(metadata.authors&&authorRefs.length){
   const names=(await Promise.all(authorRefs.map(async a=>{try{const r=await fetcher('https://openlibrary.org'+a.key+'.json',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(timeoutMs)});return r.ok?(await r.json()).name||'':''}catch{return ''}}))).filter(Boolean);
   if(names.length)out.fields.authors={matched:authorMatch(metadata.authors,names),recognized:metadata.authors,catalogue:names.join(', ')};
  }
  out.verified=titleMatch;
  out.status=!titleMatch?'title_mismatch':out.fields.authors?.matched===false?'author_mismatch':out.fields.publication_year?.matched===false?'year_mismatch':'title_matched';
  // A title/ISBN match does not validate authors, year, or edition. Keep field evidence explicit.
  return out;
 }catch{out.status='provider_unavailable';return out}
}
module.exports={verify,comparable,authorMatch};
