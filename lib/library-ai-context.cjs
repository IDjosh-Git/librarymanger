'use strict';
/* Verified, public-safe app data. This is retrieval at request time, NOT model training.
   Never pass private inventory, borrowers, or loan rows into an AI prompt. */
const cloud=require('./library-ai-cloud.cjs');
const fields=['title','authors','isbn','description','shelf','published_at','selection_source','why_selected','reading_hook','ideal_for','discussion_question','week_start'];
function text(value,max=700){return typeof value==='string'?value.replace(/[\x00-\x1f<>]/g,' ').trim().slice(0,max):'';}
function weeklyTopic(q){return /\b(?:book\s+of\s+(?:the\s+)?week|book\s+for\s+(?:the\s+)?week|this\s+week'?s\s+(?:book|read|pick|selection)|weekly\s+(?:book|pick|feature|spotlight|selection|read)|featured\s+(?:book|title|read)|current\s+(?:featured\s+)?(?:book|spotlight|weekly\s+pick)|spotlight\s+book|(?:book|title|read)\s+(?:is|was)\s+(?:being\s+)?featured\s+this\s+week)\b/i.test(q)||/\bthis\s+week\b/i.test(q)&&/\b(?:book|featured|pick|spotlight|read)\b/i.test(q);}
function weeklyManagement(q){return /\b(?:how\s+(?:do|can|should)\s+i|steps\s+to|where\s+do\s+i|how\s+does\s+the\s+app)\b.{0,80}\b(?:set|publish|manage|update|change|edit|replace|select|generate|schedule|configure)\b/i.test(q)||/\b(?:admin|administrator)\b.{0,30}\b(?:set|publish|manage|update|change|edit|replace|select|generate|schedule|configure)\b/i.test(q);}
function referencesWeekly(question,history=[],selectedBook=false){
 const q=text(question,1200);
 if(weeklyTopic(q))return !weeklyManagement(q);
 if(selectedBook)return false;
 const short=/^(?:and\s+)?(?:who\s+(?:wrote|is\s+the\s+author\s+of)|what(?:'s|\s+is)\s+(?:its|the)\s+(?:author|title|isbn|shelf|genre|subject)|why\s+(?:was|is)\s+it\s+(?:chosen|featured|selected)|where\s+is\s+it|is\s+it\s+available|tell\s+me\s+more\s+about\s+it|what\s+is\s+it\s+about|what\s+should\s+i\s+know\s+about\s+it|can\s+you\s+summarize\s+it|what\s+about\s+(?:its|the)\s+(?:author|isbn|shelf))\b/i.test(q);
 if(!short)return false;
 const recentAssistant=(history||[]).slice().reverse().find(x=>x?.role==='assistant');
 if(recentAssistant&&/^Inventory record:\s*\*\*/.test(String(recentAssistant.content||'')))return false;
 return (history||[]).slice(-3).some(x=>weeklyTopic(String(x?.content||'')));
}
function normalizeSpotlight(row){
 if(!row||typeof row!=='object'||!text(row.title,200))return null;
 const safe={};for(const field of fields)safe[field]=text(row[field],field==='description'||field==='why_selected'?1000:300);
 return safe;
}
async function loadSpotlight(member){
 // The public-facing pages consume exactly this RPC, so Library AI sees the same
 // manual override, weekly recommendation, and catalogue fallback as visitors.
 try{
  const items=await cloud.rest(member,'rpc/library_public_weekly_spotlight_v2',{method:'POST',body:{},prefer:''});
  return {book:normalizeSpotlight(Array.isArray(items)?items[0]:null),origin:'library_public_weekly_spotlight_v2'};
 }catch(primary){
  // Backward compatibility for deployments that have not installed the v2 RPC.
  try{
   const items=await cloud.rest(member,'rpc/library_public_featured_book',{method:'POST',body:{},prefer:''});
   return {book:normalizeSpotlight(Array.isArray(items)?items[0]:null),origin:'library_public_featured_book'};
  }catch(_){throw primary;}
 }
}
function dateLabel(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return '';
 const start=new Date(value+'T00:00:00Z');if(Number.isNaN(+start))return '';
 const end=new Date(start);end.setUTCDate(end.getUTCDate()+6);
 const fmt=d=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(d);
 return fmt(start)+' – '+fmt(end);
}
function selectionLabel(source){return source==='manual'?'chosen by the library team':source==='ai'?'recommended with AI using catalogue details':source==='automatic'?'selected by the weekly catalogue rotation':'featured by the library';}
function directWeeklyQuestion(question){
 const q=text(question,1200).toLowerCase();
 if(/\b(?:compare|themes|interpret|critique|lesson|insight|explain\s+in\s+depth|write\s+(?:an?\s+)?(?:essay|review|poem)|analy[sz]e|create|draft|prepare|generate\s+(?:questions|quiz)|recommend\s+similar|suggest\s+similar|chapter|plot\s+summary|detailed\s+summary|discussion\s+guide)\b/.test(q))return false;
 // Concise bibliographic and editorial lookups can be answered exactly without a model.
 return true;
}
function answerWeekly(question,spotlight){
 const book=spotlight?.book;
 if(!book)return 'No Book of the Week is currently published in Library Manager. You can check the **Book of the Week** page; an administrator may need to publish a selection.';
 const q=text(question,1200).toLowerCase();
 const title='**'+book.title+'**',authors=book.authors||'Author not listed';
 const source='This information comes from Library Manager’s published Book of the Week record.';
 const why=book.why_selected||book.description;
 if(/\b(?:available|availability|in\s+stock|checked\s+out|on\s+loan)\b/.test(q))return `${title} is the published weekly feature. The spotlight lists shelf **${book.shelf||'not specified'}**, but Library AI does not read current loan or copy availability. Use the authorized Inventory or lending screen to confirm whether a copy is available.`;
 if(/\b(?:who\s+(?:wrote|is\s+the\s+author)|author|written\s+by)\b/.test(q))return `${title} is by **${authors}**. ${source}`;
 if(/\b(?:isbn|barcode)\b/.test(q))return `${title} has ${book.isbn?'ISBN **'+book.isbn+'**':'no ISBN listed in the published record'}. ${source}`;
 if(/\b(?:shelf|location|where\s+(?:is|can\s+i\s+find))\b/.test(q))return `${title} is listed at **${book.shelf||'an unspecified shelf'}** in the published spotlight. This is a shelf reference, **not** a live check of borrowing availability.`;
 if(/\b(?:why|reason|chosen|selected|featured)\b/.test(q)&&!/(?:what|which)\s+(?:is|book)/.test(q))return `${title}, by ${authors}, is this week’s selection (${selectionLabel(book.selection_source)}). ${why||'The published record does not yet include a detailed selection reason.'}`;
 if(/\b(?:about|synopsis|summary|describe|subject|topic)\b/.test(q))return `${title} by ${authors}. ${book.description||why||'The library has not published a synopsis for this title.'}\n\nThis is the library’s published description, not a verified full-book summary. Open **Book of the Week → Read the full book guide** for more reading information.`;
 if(/\b(?:when|which\s+week|date|period)\b/.test(q))return `${title} is the featured Book of the Week${book.week_start?' for **'+dateLabel(book.week_start)+'**':''}. ${source}`;
 const parts=[`**Book of the Week${book.week_start?' · '+dateLabel(book.week_start):''}**`,`**Title:** ${title}`,`**Author${book.authors?.includes(';')?'s':''}:** ${authors}`];
 if(why)parts.push(`**Why it’s featured:** ${why}`);
 if(book.reading_hook)parts.push(`**Reading hook:** ${book.reading_hook}`);
 if(book.ideal_for)parts.push(`**Recommended for:** ${book.ideal_for}`);
 if(book.discussion_question)parts.push(`**Discussion question:** ${book.discussion_question}`);
 if(book.isbn)parts.push(`**ISBN:** ${book.isbn}`);
 if(book.shelf)parts.push(`**Shelf:** ${book.shelf}`);
 parts.push(`**Selection:** ${selectionLabel(book.selection_source)}.`);
 parts.push('You can find the featured title and reading guide under **Book of the Week** in Library Manager. These are published catalogue details, not real-time inventory availability.');
 return parts.join('\n\n');
}
const APP_CAPABILITIES=[
 'Library Manager is a web application for managing physical library books, ISBN/barcodes and distinct copy IDs, library visits, lending/returns, curated reading content and reporting.',
 'Administrators manage Scan books, Review books, Inventory, Book of the Week, notifications, monitoring/reports and member access; standard library users can perform authorized lending and returning, and check in/out via the daily usage page.',
 'Scan books imports photographs, folders and ZIPs. OCR is suggested metadata; Review books lets administrators correct it and save physical copies to Supabase. Exact image duplicates may be skipped, but distinct copies may share an ISBN.',
 'Inventory offers search and filters by title, author, ISBN or shelf; copy status and lending depend on authenticated collection records, which this assistant does not read.',
 'Lend a book records a loan for a specific available physical copy and due date; Return a book records the return of the borrowed copy. Never invent current book availability or an individual loan.',
 'For visits, library members use Check in / out, then Save books read and Check out. Signing into the website is not an attendance check-in. Administrators view Daily usage log under Monitor & Reports.',
 'The public Book of the Week and reading guide show published, public-safe book information. The chat API CAN fetch the live published weekly spotlight through library_public_weekly_spotlight_v2. The authenticated chat API can also read verified bibliographic and copy-status data from library_books, but never borrower identities, loan transactions or other private user records.',
 'Library AI chat is restricted to signed-in Library Manager members. Messages and curated help articles are stored in Supabase; Reset clears the signed-in member’s cloud AI conversation. The AI cannot change app records or assign permissions.',
 'For app instructions, use the curated Supabase app knowledge articles in addition to these verified capabilities. Distinguish confirmed product features from guesses and permissions.'
].join('\n');
module.exports={referencesWeekly,weeklyTopic,weeklyManagement,normalizeSpotlight,loadSpotlight,dateLabel,directWeeklyQuestion,answerWeekly,APP_CAPABILITIES};
