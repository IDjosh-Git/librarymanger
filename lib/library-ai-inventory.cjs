'use strict';
/* Read-only, authenticated, bibliographic inventory retrieval for Library AI.
   Never select borrower, loans, owner, or account fields. Supabase RLS and
   library_member_roles are enforced by the caller's user JWT. */
const cloud=require('./library-ai-cloud.cjs');
const {validISBN,digitISBN,sameISBN}=require('./book-metadata.cjs');
const FIELDS='record_id,book_id,title,authors,barcode,publisher,publication_year,language,pages,subject,shelf_location,book_status';
const STOP=new Set('the a an and or for is are about book books from our my library inventory catalogue catalog do you we have any tell me what who wrote author authors of to on in at by which how much can please show find information details give know it this that available copy copies its with your list some all want need recommend summarize explain summary review reading read'.split(' '));
const tidy=(s,max=320)=>String(s??'').replace(/[\x00-\x1f<>]/g,' ').trim().slice(0,max);
function norm(s){return tidy(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function tokens(s){return norm(s).split(' ').filter(x=>x.length>=3&&!STOP.has(x));}
const ignored=/\b(?:how\s+(?:do|can)\s+i\s+(?:add|scan|upload|review|edit|delete|manage|use|save|create|update|filter|export|lend|return|find|search)|where\s+(?:is|are)\s+the\s+(?:inventory|scan|review|search|report)|how\s+does\s+(?:library manager|the app)|navigate to|reset (?:my |the )?chat)\b/i;
function explicitTarget(q){
 const value=tidy(q,1200);
 const isbn=value.match(/\b(?:isbn(?:-1[03])?|barcode)\s*(?:number|no\.?|is|:|#)?\s*([0-9Xx\s-]{10,22})\b/i);
 if(isbn&&validISBN(isbn[1]))return {isbn:digitISBN(isbn[1])};
 const raw=value.match(/(?:^|[\s:])['“‘]([^'”’]{3,160})['”’]/);
 if(raw)return {title:raw[1]};
 const patterns=[
  /\b(?:tell me|information|details|more|summary|summarize|overview|review|synopsis|facts|what do you know)\s+(?:me\s+)?(?:more\s+)?(?:about|on|of)\s+(?:the\s+book\s+|a\s+book\s+|book\s+)?(.+)$/i,
  /\b(?:do (?:we|you) have|find|search for|look up|locate|show me|check)\s+(?:the\s+book\s+|a\s+book\s+|book\s+)?(.+)$/i,
  /\b(?:who (?:wrote|is the author of)|what is the (?:author|publisher|isbn|shelf|summary|plot) of)\s+(?:the\s+book\s+|a\s+book\s+|book\s+)?(.+)$/i,
  /\b(?:what is|what's)\s+(?:the\s+book\s+)?(.+?)\s+about\??$/i,
  /\b(?:is|are)\s+(?:the\s+book\s+)?(.+?)\s+(?:in (?:our|the) (?:library|inventory|catalogue|catalog)|available to borrow|on the shelf)\??$/i,
  /\b(?:book\s+(?:called|titled|named)|title\s+(?:called|named))\s+(.+)$/i,
  /\b(?:themes?|lessons?|plot|chapters?|reviews?|main ideas|key (?:points|ideas)|takeaways?|synopsis|insights?)\s+(?:of|from|in|about|for)\s+(?:the\s+book\s+)?(.+)$/i,
  /\b(?:what do (?:readers|critics|people) say|find (?:online |external )?information|search (?:online|the web|the internet))\s+(?:about|on|for)\s+(?:the\s+book\s+)?(.+)$/i
 ];
 for(const p of patterns){let m=value.match(p);if(!m)continue;let title=m[1].replace(/[?!.,\s]+$/g,'').replace(/\s+(?:in|from|within)\s+(?:our|the|your)\s+(?:inventory|library|catalogue|catalog)\b.*$/i,'').replace(/\s+(?:online|on the web|on the internet)\b.*$/i,'').replace(/^(?:the|a)\s+book\s+/i,'').trim();if(/^(?:(?:this|that|my|our|the|a)\s+)?(?:book|novel|title|it)$/i.test(title))continue; if(tokens(title).length||norm(title).length>3)return {title};}
 return null;
}
function referencedInConversation(history){
 const previous=(history||[]).slice(-5).reverse().find(m=>m.role==='assistant');
 if(!previous||!/^Inventory record:\s*\*\*(.{2,180}?)\*\*/.test(previous.content||''))return null;
 return {title:previous.content.match(/^Inventory record:\s*\*\*(.{2,180}?)\*\*/)[1]};
}
function shouldLookUp(q,book,history=[]){
 if(ignored.test(q))return false;
 if(explicitTarget(q))return true;
 if(/\b(?:inventory|catalogue|catalog|isbn|barcode|shelf|in (?:the|our) library|in stock|copies?|borrow|available|author of|published by)\b/i.test(q))return true;
 if(book?.recordId||book?.isbn||book?.title){return /\b(?:book|it|this|its|author|who wrote|about|synopsis|plot|pages?|title|isbn|published|publisher|theme|summary|summarize|genre|chapters?|read|ideas|lessons|recommend|review|copies?|available|shelf|research|online|external)\b/i.test(q);}
 if(referencedInConversation(history)&&/\b(?:it|its|this book|more|author|who wrote|summary|about|publisher|publication|copies|shelf|available)\b/i.test(q))return true;
 return false;
}
function cleanRow(row){const safe={};for(const key of FIELDS.split(','))safe[key]=tidy(row?.[key],key==='subject'?500:320);return safe;}
async function read(member,query){const result=await cloud.rest(member,'library_books',{query,prefer:''});return Array.isArray(result)?result.map(cleanRow):[];}
function rank(record,needle){
 const title=norm(record.title),author=norm(record.authors),value=norm(needle.title||'');
 if(needle.isbn)return sameISBN(record.barcode,needle.isbn)?150:digitISBN(record.barcode)===needle.isbn?150:0;
 if(!value)return 0;
 if(title===value)return 120;
 if(title.startsWith(value+' ')||value.startsWith(title+' '))return 90;
 if(title.includes(value)&&value.length>5)return 82;
 const wanted=tokens(value),got=new Set(tokens(title)),authors=new Set(tokens(author));
 if(!wanted.length)return 0;
 const inTitle=wanted.filter(t=>got.has(t)).length,inAuthor=wanted.filter(t=>authors.has(t)).length;
 return Math.max(inTitle/wanted.length*70+(inTitle>=2?8:0),inAuthor/wanted.length*45)+(inTitle>=1&&inAuthor>=1?8:0);
}
function groupRows(rows){const map=new Map();for(const row of rows){const key=norm(row.title)+'|'+digitISBN(row.barcode)+'|'+norm(row.authors);if(!map.has(key))map.set(key,[]);map.get(key).push(row);}return [...map.values()];}
function summarize(rows,incomplete=false){
 const book=rows[0];return {book:{title:book.title,authors:book.authors,isbn:book.barcode,publisher:book.publisher,year:book.publication_year,pages:book.pages,subject:book.subject,language:book.language,shelf:[...new Set(rows.map(x=>x.shelf_location).filter(Boolean))].slice(0,6).join('; ')},copies:{total:rows.length,available:rows.filter(x=>/^available$/i.test(x.book_status)).length,onLoan:rows.filter(x=>/^borrowed$/i.test(x.book_status)).length,unclassified:rows.filter(x=>!/^available$|^borrowed$/i.test(x.book_status)).length,incomplete},source:'authenticated Library Manager inventory'};
}
async function lookup(member,{question,selected={},history=[]}){
 const explicit=explicitTarget(question);
 // An explicit title/ISBN in the user's question always overrides old UI selection.
 let needle=explicit||(selected?.recordId||selected?.title||selected?.isbn?{recordId:tidy(selected.recordId,160),title:tidy(selected.title),isbn:validISBN(selected.isbn)?digitISBN(selected.isbn):''}:null);
 if(!needle)needle=referencedInConversation(history);
 if(!needle){const t=tokens(question).filter(x=>x.length>=4).slice(0,5);if(t.length)needle={title:t.join(' ')};}
 if(!needle)return {status:'not-specified'};
 let rows=[];
 if(needle.recordId&&!explicit){
  rows=await read(member,'?select='+FIELDS+'&record_id=eq.'+encodeURIComponent(needle.recordId)+'&limit=1');
  if(!rows.length)needle={title:needle.title,isbn:needle.isbn};
 }
 if(!rows.length&&needle.isbn&&validISBN(needle.isbn)){
  rows=await read(member,'?select='+FIELDS+'&barcode=eq.'+encodeURIComponent(needle.isbn)+'&limit=200');
  if(!rows.length&&needle.title)needle={title:needle.title};
 }
 if(!rows.length&&needle.title){
  // Restrict candidate retrieval at the database, never send all catalogue rows to AI.
  const parts=tokens(needle.title).sort((a,b)=>b.length-a.length).slice(0,3);
  const terms=parts.length?parts:[norm(needle.title)].filter(Boolean);
  const clauses=terms.map(t=>'title.ilike.*'+t+'*').concat(terms.map(t=>'authors.ilike.*'+t+'*'));
  if(!clauses.length)return {status:'not-specified'};
  rows=await read(member,'?select='+FIELDS+'&or='+encodeURIComponent('('+clauses.join(',')+')')+'&limit=200');
 }
 if(!rows.length)return {status:'not-found',searched:tidy(needle.title||needle.isbn)};
 const grouped=groupRows(rows).map(group=>({group,score:Math.max(...group.map(r=>rank(r,needle)))})).filter(v=>v.score>= (needle.recordId&&!explicit?0:needle.isbn?120:42)).sort((a,b)=>b.score-a.score);
 if(!grouped.length)return {status:'not-found',searched:tidy(needle.title||needle.isbn)};
 const best=grouped[0],near=grouped.filter(g=>g.score>=best.score-8);
 if(near.length>1){return {status:'ambiguous',options:near.slice(0,5).map(x=>({title:x.group[0].title,authors:x.group[0].authors,isbn:x.group[0].barcode}))};}
 const match=best.group[0];
 // Verify all physical copies for the chosen edition before reporting availability.
 let countRows=best.group;
 if(match.barcode&&validISBN(match.barcode))countRows=await read(member,'?select='+FIELDS+'&barcode=eq.'+encodeURIComponent(match.barcode)+'&limit=1000');
 else if(match.title)countRows=await read(member,'?select='+FIELDS+'&title=eq.'+encodeURIComponent(match.title)+'&limit=1000');
 if(!countRows.length)countRows=best.group;
 // Do not combine different editions or authors that happen to share a title.
 countRows=countRows.filter(x=>norm(x.title)===norm(match.title)&&norm(x.authors)===norm(match.authors)&&digitISBN(x.barcode)===digitISBN(match.barcode));
 if(!countRows.length)countRows=best.group;
 return {status:'found',...summarize(countRows,countRows.length>=1000),matchScore:best.score};
}
function directQuestion(q){return /\b(?:how many copies|how many books|copies|available|on loan|borrowed|shelf|isbn|barcode|who wrote|author|publisher|published|what (?:year|language)|number of pages|is (?:it|this book) (?:in|available)|in (?:our|the) (?:library|inventory|catalogue)|do (?:we|you) have)\b/i.test(q);}
function answer(found){
 if(found.status==='not-found')return 'I could not verify **'+tidy(found.searched,130)+'** in the Library Manager inventory. Check the spelling or select the exact title in **Library AI → Chat options → Library book context**. I will not invent its catalogue information.';
 if(found.status==='ambiguous')return 'I found multiple possible inventory matches. Please select the exact book:\n'+found.options.map((b,i)=>(i+1)+'. **'+b.title+'**'+(b.authors?' — '+b.authors:'')+(b.isbn?' (ISBN '+b.isbn+')':'')).join('\n');
 if(found.status!=='found')return 'Please tell me the title or ISBN, or select a book under **Chat options → Library book context**.';
 const b=found.book,c=found.copies,lines=['Inventory record: **'+b.title+'**'];
 if(b.authors)lines.push('**Author(s):** '+b.authors);
 if(b.isbn)lines.push('**ISBN/barcode:** '+b.isbn);
 if(b.publisher)lines.push('**Publisher:** '+b.publisher);
 if(b.year)lines.push('**Publication year:** '+b.year);
 if(b.subject)lines.push('**Subject:** '+b.subject);
 if(b.pages)lines.push('**Pages:** '+b.pages);
 if(b.shelf)lines.push('**Shelf:** '+b.shelf);
 lines.push('**Copies recorded:** '+(c.incomplete?'At least ':'')+c.total+'; '+c.available+' available; '+c.onLoan+' on loan'+(c.unclassified?'; '+c.unclassified+' other status':'')+'.');
 lines.push('Source: authenticated Library Manager inventory (read-only).');
 return lines.join('\n');
}
module.exports={shouldLookUp,explicitTarget,lookup,directQuestion,answer,rank,normalizeTitle:norm,referencedInConversation};
