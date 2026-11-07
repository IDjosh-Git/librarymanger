/* Public-facing editorial: reads only the public-safe Supabase RPC. */
(()=>{
 'use strict';
 const SUPABASE_URL='https://hotysnqorkqbiconjskl.supabase.co';
 const SUPABASE_KEY='sb_publishable_OL7r2hmR6n7OOWY5m-3bRw_Peft2X9q';
 const $=id=>document.getElementById(id);
 const theme=$('spotlightThemeToggle');
 theme?.addEventListener('click',()=>{
  const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
  document.documentElement.dataset.theme=next;
  try{localStorage.setItem('library_manager_theme_v2',next)}catch(_){ }
  theme.setAttribute('aria-pressed',String(next==='dark'));
 });
 theme?.setAttribute('aria-pressed',String(document.documentElement.dataset.theme==='dark'));
 function validImageUrl(url){try{const p=new URL(url);return p.protocol==='https:'?p.href:''}catch(_){return ''}}
 function weekLabel(value){
  const d=new Date(String(value||'')+'T00:00:00Z');
  if(Number.isNaN(d.getTime()))return 'A fresh selection every week';
  const end=new Date(d);end.setUTCDate(end.getUTCDate()+6);
  const format=x=>x.toLocaleDateString(undefined,{day:'numeric',month:'short',timeZone:'UTC'});
  return format(d)+' – '+format(end)+' · Weekly edition';
 }
 function setText(id,text){const node=$(id);if(node)node.textContent=String(text||'')}
 function updateSpotlight(data){
  const title=String(data?.title||'').trim();if(!title)return;
  const authors=String(data.authors||'Unknown author').trim()||'Unknown author';
  const ai=data.selection_source==='ai',manual=data.selection_source==='manual';
  const why=String(data.why_selected||data.description||'A title from our library collection worth discovering.').trim();
  const hook=String(data.reading_hook||'').trim(),audience=String(data.ideal_for||'').trim(),question=String(data.discussion_question||'').trim();
  setText('spotlightTitle',title);
  setText('spotlightAuthor','By '+authors);
  setText('spotlightIsbn',data.isbn||'Not listed');
  setText('spotlightShelf',data.shelf||'Ask the library');
  setText('spotlightSource',ai?'AI + library catalogue':manual?'Library editorial':'Weekly catalogue rotation');
  setText('spotlightEdition',ai?'A fresh AI recommendation from our own shelves':manual?'An editor\'s choice from the library':'A new discovery from the shelves');
  setText('spotlightOverline',ai?'CURATED WITH AI · FROM REAL INVENTORY':manual?'CURATED BY THE LIBRARY':'SELECTED FROM OUR COLLECTION');
  setText('spotlightRibbonLabel',ai?'AI WEEKLY BOOK PICK':manual?'EDITOR\'S BOOK OF THE WEEK':'BOOK OF THE WEEK');
  setText('spotlightDescription',hook||'A selected title from our library. Find out why it deserves this week\'s spotlight below.');
  setText('spotlightWhy',why);
  setText('weeklyReasonTitle',ai?'The reason behind the AI pick':'The reason for this week\'s pick');
  setText('spotlightWeek',weekLabel(data.week_start));
  setText('weeklyEditionTag',ai?'✦ AI-assisted selection':manual?'✦ Chosen by the library':'✦ Weekly catalogue pick');
  setText('weeklyReasonFoot',ai?'AI recommendation grounded in catalogue details. Not a review of the full book.':manual?'Selected and published by the library team.':'A consistent weekly selection from titles in our library.');
  setText('spotlightAudience',audience||'Readers looking to explore this subject.');
  setText('spotlightHook',hook||'Discover this week’s recommendation.');
  setText('spotlightQuestion',question||'What would you like to learn from this book?');
  const date=data.published_at&&Date.parse(data.published_at);
  setText('spotlightPublished',date?'Featured '+new Date(date).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'}):'This week’s featured read');
  const cover=validImageUrl(String(data.cover_url||''));
  const img=$('spotlightCover');if(img){
   img.onerror=()=>{img.onerror=null;img.src='assets/book-stack-fallback.jpg';img.alt='Books from the library collection'};
   img.src=cover||'assets/book-stack-fallback.jpg';
   img.alt=cover?'Book cover of '+title+' by '+authors:'Books from the library collection';
  }
  try{window.LibraryBookGuide?.addBook({title,authors,isbn:data.isbn,shelf:data.shelf,description:why})}catch(_){}
 }
 async function loadFeaturedBook(){
  if(!window.supabase?.createClient)return;
  try{
   const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
   void window.LibraryBookGuide?.loadPublicCatalog();
   let result=await db.rpc('library_public_weekly_spotlight_v2');
   // Existing installations continue to work without migration, but AI picks
   // require the dedicated v5.19 migration.
   if(result.error)result=await db.rpc('library_public_featured_book');
   if(!result.error&&Array.isArray(result.data)&&result.data[0])return updateSpotlight(result.data[0]);
   const fallback=await db.from('library_featured_books').select('title,authors,isbn,description,cover_url,shelf,published_at').eq('id',1).maybeSingle();
   if(!fallback.error&&fallback.data)updateSpotlight({...fallback.data,selection_source:'manual'});
  }catch(_){/* Page keeps a truthful placeholder if Supabase is offline. */}
 }
 $('askFeaturedBook')?.addEventListener('click',()=>{
  const title=$('spotlightTitle')?.textContent;
  if(!title||title==='Your next great read awaits.')return;
  window.LibraryBookGuide?.openBook({title,authors:($('spotlightAuthor')?.textContent||'').replace(/^By /,''),isbn:$('spotlightIsbn')?.textContent,shelf:$('spotlightShelf')?.textContent,description:$('spotlightWhy')?.textContent});
 });
 const share=$('shareSpotlight');
 share?.addEventListener('click',async()=>{
  const name=$('spotlightTitle')?.textContent||'Book of the Week',message=name+' — Library Manager Book of the Week';
  try{
   if(navigator.share)await navigator.share({title:message,text:message,url:location.href});
   else if(navigator.clipboard){await navigator.clipboard.writeText(location.href);share.textContent='Link copied ✓'}
   else share.textContent='Copy the address to share';
  }catch(_){}
 });
 loadFeaturedBook();
})();
