/* Public reading guide: bibliographic facts + explicitly identified editorial recommendation.
 * No service role credentials, inventory/borrower records, or unfounded book descriptions.
 */
(()=>{
 'use strict';
 const URL='https://hotysnqorkqbiconjskl.supabase.co';
 const KEY='sb_publishable_OL7r2hmR6n7OOWY5m-3bRw_Peft2X9q';
 const $=id=>document.getElementById(id);
 const put=(id,value)=>{const el=$(id);if(el)el.textContent=String(value||'')};
 const normalize=value=>String(value||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
 const keyString=s=>normalize(s).slice(0,160);
 function matchesTitle(a,b){
  const x=normalize(a),y=normalize(b);
  if(!x||!y)return false;
  if(x===y)return true;
  const aWords=new Set(x.split(' ').filter(w=>w.length>2));
  const bWords=new Set(y.split(' ').filter(w=>w.length>2));
  if(!aWords.size||!bWords.size)return false;
  const common=[...aWords].filter(w=>bWords.has(w)).length;
  return common/Math.max(aWords.size,bWords.size)>=.65;
 }
 function withinOpenLibrary(url){
  try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='openlibrary.org'?u.href:null}catch{return null}
 }
 async function getJSON(url,ms=5300){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);
  try{
   const res=await fetch(url,{headers:{Accept:'application/json'},signal:controller.signal});
   if(!res.ok)throw new Error('Metadata unavailable');return await res.json();
  }finally{clearTimeout(timer)}
 }
 function description(value){return typeof value==='string'?value:typeof value?.value==='string'?value.value:''}
 function isbnValue(isbn){const n=String(isbn||'').replace(/[^0-9Xx]/g,'');return /^(?:97[89]\d{10}|\d{9}[\dXx])$/.test(n)?n:''}
 function matchesAuthor(a,b){
  const aa=normalize(a).split(' ').filter(x=>x.length>1),bb=normalize(b).split(' ').filter(x=>x.length>1);
  if(!aa.length||!bb.length)return false;
  if(aa.length===1||bb.length===1)return aa.some(x=>bb.includes(x));
  // A shared first name is not enough to identify the same author.
  return aa.filter(x=>bb.includes(x)).length>=2;
 }
 function safeGoogleBookLink(raw){
  try{const u=new URL(raw);return u.protocol==='https:'&&['books.google.com','play.google.com'].includes(u.hostname)?u.href:null}catch{return null}
 }
 async function catalogue(book){
  const isbn=isbnValue(book.isbn);
  let edition=null,work=null,link=null,subjects=[],summary='';
  if(isbn){
   try{
    edition=await getJSON('https://openlibrary.org/isbn/'+encodeURIComponent(isbn)+'.json');
    if(matchesTitle(edition.title,book.title)){
     link=withinOpenLibrary('https://openlibrary.org/isbn/'+isbn);
     const k=edition.works?.[0]?.key;
     if(typeof k==='string'&&/^\/works\/OL\d+W$/.test(k))work=await getJSON('https://openlibrary.org'+k+'.json');
    }else edition=null;
   }catch(_){/* An ISBN is not guaranteed to exist in Open Library. */}
  }
  if(!work){
   try{
    const params=new URLSearchParams({title:book.title,limit:'2',fields:'key,title,author_name,first_publish_year,subject'});
    if(book.authors&&book.authors!=='Unknown author')params.set('author',book.authors);
    const json=await getJSON('https://openlibrary.org/search.json?'+params);
    const doc=(json.docs||[]).find(r=>matchesTitle(r.title,book.title)&&(!book.authors||book.authors==='Unknown author'||(r.author_name||[]).some(a=>matchesAuthor(a,book.authors))));
    if(doc&&/^\/works\/OL\d+W$/.test(doc.key||'')){
     link=withinOpenLibrary('https://openlibrary.org'+doc.key);
     subjects=(doc.subject||[]).filter(x=>typeof x==='string').slice(0,8);
     try{work=await getJSON('https://openlibrary.org'+doc.key+'.json')}catch(_){/* Search metadata still useful. */}
    }
   }catch(_){/* All reading-guide sections remain usable offline. */}
  }
  let summarySource='';
  if(work){
   summary=description(work.description).replace(/\s+/g,' ').trim().slice(0,1100);
   if(summary)summarySource='Open Library';
   subjects=(Array.isArray(work.subjects)?work.subjects:subjects).filter(s=>typeof s==='string').slice(0,8);
  }
  // Some editions have no Open Library synopsis. Query Google Books only in that case;
  // this never blocks the weekly pick or the initial reading-guide render.
  if(!summary){
   try{
    const q=isbn?'isbn:'+isbn:'intitle:'+book.title;
    const payload=await getJSON('https://www.googleapis.com/books/v1/volumes?'+new URLSearchParams({q,maxResults:'3'}),4500);
    const candidate=(payload.items||[]).map(x=>x.volumeInfo||{}).find(v=>matchesTitle(v.title,book.title)&&(!book.authors||book.authors==='Unknown author'||(v.authors||[]).some(a=>matchesAuthor(a,book.authors))));
    if(candidate){
     summary=String(candidate.description||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,1100);
     if(summary)summarySource='Google Books';
     if(!subjects.length)subjects=(candidate.categories||[]).filter(x=>typeof x==='string').slice(0,7);
     if(!link)link=safeGoogleBookLink(candidate.infoLink);
    }
   }catch(_){/* Keep the source transparent when catalogue enrichment fails. */}
  }
  return {summary,summarySource,subjects,link};
 }
 function linkButton(el,url,label){if(!el)return;el.href=url;el.textContent=label;el.hidden=false}
 function render(book){
  const title=String(book.title||'').trim();if(!title)return;
  const authors=String(book.authors||'Unknown author').trim();
  const why=String(book.why_selected||book.description||'Our library selected this title for readers to discover.').trim();
  const hook=String(book.reading_hook||'').trim(),who=String(book.ideal_for||'').trim();
  put('guideTitle',title);put('guideByline','By '+authors);
  put('guideIntro',hook||'Explore this week’s featured library selection.');
  put('guideReason',why);
  put('guideAudience',who||'Readers interested in this author or subject.');
  put('guideQuestion',book.discussion_question||'What new question did this book raise for you?');
  put('guideShelf',book.shelf||'Ask the library');put('guideIsbn',book.isbn||'Not recorded');
  put('guideSource',book.selection_source==='ai'?'AI-assisted, checked against catalogue':book.selection_source==='manual'?'Library editor':'Catalogue selection');
  $('guideCover').src=book.cover_url||'assets/book-stack-fallback.jpg';
  $('guideCover').alt='Cover for '+title;
  $('guideCover').onerror=()=>{$('guideCover').onerror=null;$('guideCover').src='assets/book-stack-fallback.jpg';$('guideCover').alt='Books on a shelf'};
  const week=book.week_start?new Date(book.week_start+'T00:00:00Z'):null;
  put('guideEdition',week&&!Number.isNaN(week.getTime())?'Week of '+week.toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}):'Current library spotlight');
  const fallbackLink='https://openlibrary.org/search?'+new URLSearchParams({q:title+' '+authors});
  linkButton($('guideSourceLink'),fallbackLink,'Find verified book details ↗');
  linkButton($('guideSearchLink'),fallbackLink,'Browse editions and descriptions ↗');
  const share=$('guideShare');share?.addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:'Reading guide: '+title,url:location.href});else await navigator.clipboard.writeText(location.href);share.textContent='Link copied ✓'}catch(_){}});
  return {title,authors};
 }
 async function load(){
  try{
   if(!window.supabase?.createClient)throw new Error('Connection unavailable');
   const client=window.supabase.createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
   let result=await client.rpc('library_public_weekly_spotlight_v2');
   if(result.error)result=await client.rpc('library_public_featured_book');
   if(result.error||!result.data?.[0])throw new Error('No featured book yet');
   const book=result.data[0];
   const info=render(book);if(!info)throw new Error('No title found');
   put('guideStatus','Book selected from the library catalogue.');
   // External information is optional; do not block the first meaningful paint.
   catalogue(book).then(meta=>{
    const summary=$('guideSummary'),subjects=$('guideSubjects');
    if(meta.summary){summary.textContent=meta.summary;put('guideEvidence','Book description from '+(meta.summarySource||'a public catalogue')+'. Check the linked source for edition details.');}
    else {summary.textContent='The library catalogue does not contain a full synopsis for this edition. The editorial note below explains its recommendation without inventing plot details.';put('guideEvidence','Read the original catalogue record for a verified description.');}
    if(meta.subjects.length){subjects.replaceChildren();meta.subjects.slice(0,7).forEach(s=>{const chip=document.createElement('span');chip.className='guide-subject-chip';chip.textContent=s;subjects.append(chip)})}
    else{subjects.textContent='Explore the themes and reading prompts below.'}
    if(meta.link)linkButton($('guideSourceLink'),meta.link,'Read the Open Library record ↗');
    put('guideStatus','Guide ready');
   }).catch(()=>{put('guideStatus','Guide ready · external sources unavailable')});
  }catch(_){
   put('guideStatus','The featured title could not be loaded. Try refreshing this page.');
   put('guideSummary','The weekly reading guide will appear when a book is selected.');
  }
 }
 const theme=$('guideTheme');theme?.addEventListener('click',()=>{const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';try{localStorage.setItem('library_manager_theme_v2',dark?'dark':'light')}catch(_){}});
 load();
})();
