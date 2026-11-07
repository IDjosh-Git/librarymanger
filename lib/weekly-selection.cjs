'use strict';
/** Inventory-only weekly editorial selection helpers (no borrower data). */
const {createHash}=require('node:crypto');
const tidy=(value,max=180)=>String(value??'').replace(/[\u0000-\u001f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const normalized=value=>tidy(value,400).toLocaleLowerCase('en').replace(/[^a-z0-9]+/g,' ').trim();
const isoWeekStart=(date=new Date())=>{
 const d=new Date(date);if(Number.isNaN(d.getTime()))throw Error('Invalid date');
 d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
 return d.toISOString().slice(0,10);
};
const hashNumber=value=>parseInt(createHash('sha256').update(value).digest('hex').slice(0,12),16);
function inventoryCandidates(rows,week,max=55){
 if(!Array.isArray(rows))return [];
 const unique=new Map();
 for(const r of rows){
  const title=tidy(r.title,180),authors=tidy(r.authors,130);
  if(!title||/^(?:untitled|unknown|unidentified|missing title|no title|test book|new book)$/i.test(title))continue;
  if(!tidy(r.record_id,120))continue;
  const status=normalized(r.book_status);
  const row={
   id:tidy(r.record_id,120),title,authors:authors||'Unknown author',
   isbn:tidy(r.barcode,32).replace(/[^0-9Xx]/g,''),
   subject:tidy(r.subject,150),year:tidy(r.publication_year,20),
   shelf:tidy(r.shelf_location,120),status,
  };
  const group=normalized(title)+'|'+normalized(row.authors);
  const old=unique.get(group);
  // Prefer complete metadata and an available physical copy when several copies exist.
  const quality=(x)=>Number(x.status==='available')*4+Number(x.authors!=='Unknown author')*2+Number(!!x.subject)*2+Number(!!x.isbn);
  if(!old||quality(row)>quality(old))unique.set(group,row);
 }
 let list=[...unique.values()];
 const available=list.filter(x=>x.status==='available');if(available.length)list=available;
 const rank=x=>{
  const relevance=Number(x.authors!=='Unknown author')+Number(!!x.subject)*2+Number(!!x.isbn);
  return (hashNumber(week+':'+normalized(x.title)+':'+normalized(x.authors))%100000)/100000+relevance*.035;
 };
 // Sample widely but deterministically, so each weekly pick comes from real books,
 // and API messages are bounded even when inventory includes thousands of copies.
 return list.sort((a,b)=>rank(b)-rank(a)||a.title.localeCompare(b.title)).slice(0,Math.max(1,Math.min(max,80)));
}
function withoutRecentlyFeatured(candidates,recent){
 const previous=new Set((Array.isArray(recent)?recent:[]).map(r=>normalized(r.title)+'|'+normalized(r.authors)));
 const unused=candidates.filter(b=>!previous.has(normalized(b.title)+'|'+normalized(b.authors)));
 return unused.length?unused:candidates;
}
function deterministicChoice(candidates,week){
 if(!candidates.length)return null;
 const idx=hashNumber('fallback:'+week)%Math.min(candidates.length,Math.max(1,Math.floor(candidates.length*.7)));
 const book=candidates[idx];
 const topic=book.subject?book.subject.split(/[,;|]/)[0].trim():'';
 const reason=topic
  ?`This week's library pick offers a chance to explore ${topic.toLowerCase()}. ${book.title} is part of our collection, making it an accessible starting point for readers interested in this subject.`
  :`${book.title}${book.authors!=='Unknown author'?' by '+book.authors:''} is our featured title this week. Selected from books currently in the library, it is an invitation to discover something new on our shelves.`;
 return {book,why:reason,hook:topic?'A fresh perspective on '+topic+'.':'Discover a title already on our shelves.',audience:topic?'Readers interested in '+topic+'.':'Curious readers looking for their next book.',question:'What idea from this book would you like to explore?',selection_source:'automatic',provider:'catalogue rotation'};
}
function parseChoice(data,candidates){
 const id=tidy(data?.book_id||data?.id,120),book=candidates.find(b=>b.id===id);
 if(!book)throw Error('AI selected a title not in the candidate inventory');
 const why=tidy(data?.reason||data?.why,620);
 if(why.length<35)throw Error('AI did not provide a useful explanation');
 return {book,why,hook:tidy(data?.reading_hook,170),audience:tidy(data?.ideal_for,140),question:tidy(data?.discussion_question,200),selection_source:'ai'};
}
function publicRecord(selection,week){
 const b=selection.book;
 // Only public bibliographic details. Never include user IDs or borrower information.
 const isbn=/^(?:97[89][0-9]{10}|[0-9]{9}[0-9Xx])$/.test(b.isbn)?b.isbn.toUpperCase():'';
 return {
  week_start:week,
  inventory_record_id:b.id,
  title:b.title,authors:b.authors,isbn,
  why_selected:tidy(selection.why,620),reading_hook:tidy(selection.hook,170),
  ideal_for:tidy(selection.audience,140),discussion_question:tidy(selection.question,200),
  cover_url:isbn?'https://covers.openlibrary.org/b/isbn/'+encodeURIComponent(isbn)+'-L.jpg?default=false':'',
  shelf:b.shelf,selection_source:selection.selection_source,
  provider:tidy(selection.provider,40)||'catalogue rotation',
  selected_at:new Date().toISOString(),
 };
}
module.exports={tidy,isoWeekStart,inventoryCandidates,withoutRecentlyFeatured,deterministicChoice,parseChoice,publicRecord};
