'use strict';
const {validISBN,digitISBN}=require('./book-metadata.cjs');
const {norm}=require('./strict-verification.cjs');
function names(v){return Array.isArray(v)?v.join('; '):String(v||'');}
function match(row,edition,isbn){
 const ids=(edition.isbns||[]).map(digitISBN);
 return ids.includes(isbn)&&norm(row?.data?.title)===norm(edition.title)&&norm(row?.data?.authors)===norm(edition.authors)&&!!norm(edition.title)&&!!norm(edition.authors);
}
async function verifyIndependentEdition(row,{fetchImpl=globalThis.fetch,googleKey='',timeoutMs=6000}={}){
 const isbn=digitISBN(row?.data?.barcode);if(!validISBN(isbn))return {ok:false,reasons:['invalid_isbn']};
 if(!norm(row?.data?.title)||!norm(row?.data?.authors))return {ok:false,reasons:['missing_title_or_author']};
 const providers=[];const errors=[];
 async function get(url){const r=await fetchImpl(url,{signal:AbortSignal.timeout(timeoutMs),headers:{Accept:'application/json'}});if(!r.ok)throw Error('provider_'+r.status);return r.json();}
 try{
  const url='https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent('isbn:'+isbn)+'&maxResults=20'+(googleKey?'&key='+encodeURIComponent(googleKey):'');
  const data=await get(url);
  for(const item of data.items||[]){const v=item.volumeInfo||{};providers.push({source:'google_books',title:v.title,authors:names(v.authors),isbns:(v.industryIdentifiers||[]).map(x=>x.identifier)});}
 }catch(_){errors.push('google_books_unavailable');}
 try{
  const data=await get('https://openlibrary.org/isbn/'+encodeURIComponent(isbn)+'.json');
  let authors=[];
  for(const a of (data.authors||[]).slice(0,8)){
   if(a.name)authors.push(a.name);
   else if(/^\/authors\/OL\w+A$/.test(a.key||'')){
    try{const person=await get('https://openlibrary.org'+a.key+'.json');if(person.name)authors.push(person.name);}catch(_){errors.push('open_library_author_unavailable');}
   }
  }
  providers.push({source:'open_library',title:data.title,authors:names(authors),isbns:[...(data.isbn_10||[]),...(data.isbn_13||[])]});
 }catch(_){errors.push('open_library_unavailable');}
 const matches=providers.filter(p=>match(row,p,isbn));
 const conflicts=providers.filter(p=>p.isbns.map(digitISBN).includes(isbn)&&p.title&&p.authors&&!match(row,p,isbn));
 if(conflicts.length)return {ok:false,reasons:['provider_metadata_conflict'],sources:providers.map(p=>p.source)};
 if(!matches.length)return {ok:false,reasons:[providers.length?'no_exact_edition_match':'providers_unavailable',...errors],sources:providers.map(p=>p.source)};
 const p=matches[0];return {ok:true,reasons:[],isbn,title:row.data.title,authors:row.data.authors,source:p.source,sources:matches.map(x=>x.source)};
}
module.exports={verifyIndependentEdition,match};
