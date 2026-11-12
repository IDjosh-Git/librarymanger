/* Book Guide: bibliographic answers free of charge; generative replies require an optional server key.
   The public page passes only already-published featured-book metadata; never borrower records. */
(function(root){
'use strict';
let books=[],current=null,visible=true,ready=false,busy=false,publicCatalogCache=null,publicCatalogPromise=null,featured=null;
let activeSession=null,cloudLoaded=false,cloudLoading=null,chatEpoch=0,cloudUser=null;
let lockedPage=null,returnFocus=null;
const $=id=>document.getElementById(id);
const norm=s=>String(s||'').trim().slice(0,350);
function safeBook(b){return {title:norm(b?.title),authors:norm(b?.authors),isbn:norm(b?.isbn),shelf:norm(b?.shelf),publisher:norm(b?.publisher),year:norm(b?.year),subject:norm(b?.subject),pages:norm(b?.pages),recordId:norm(b?.recordId),description:norm(b?.description).slice(0,1200)};}
function init(){if(ready)return;ready=true;
 const node=document.createElement('div');node.className='book-guide-root';node.innerHTML=`
 <div class="book-guide-backdrop" id="bookGuideBackdrop" hidden aria-hidden="true"></div>
 <button type="button" class="book-guide-fab" id="bookGuideFab" aria-controls="bookGuidePanel" aria-expanded="false" aria-label="Open Library AI assistant" title="Chat with Library AI"><span class="book-guide-fab-symbol" aria-hidden="true">✦</span><span class="book-guide-fab-glow" aria-hidden="true"></span></button>
 <section class="book-guide-panel" id="bookGuidePanel" aria-labelledby="bookGuideTitle" role="dialog" aria-modal="false" hidden>
  <header class="book-guide-head"><div class="book-guide-icon" aria-hidden="true">✦</div><div class="book-guide-title-wrap"><h2 id="bookGuideTitle">Library AI <span id="bookGuideCloudStatus" class="book-guide-cloud-status" data-connected="false" role="status" aria-label="Supabase disconnected" title="Supabase disconnected"><span class="book-guide-cloud-dot" aria-hidden="true"></span></span></h2><p id="bookGuideProvider">Private AI assistant</p></div><div class="book-guide-head-actions"><button class="book-guide-new-chat" type="button" id="bookGuideNewChat" aria-label="Reset cloud conversation" title="Reset conversation saved in Supabase">↻ <span>Reset</span></button><button class="book-guide-close" type="button" id="bookGuideClose" aria-label="Close book assistant">×</button></div></header>
  <details class="book-guide-settings" id="bookGuideSettings"><summary>⚙ <span>Chat options</span><small>Web search · Book context</small></summary><div class="book-guide-settings-body"><details class="book-guide-context" id="bookGuideContext"><summary><span>Library book context <small>Optional</small></span><span id="bookGuideContextLabel">Add a book</span></summary><div class="book-guide-selection"><div class="book-guide-selection-top"><label for="bookGuideSelect">OPTIONAL BOOK CONTEXT</label><span class="book-guide-count" id="bookGuideCount" role="status" aria-live="polite">Loading books…</span></div><label class="sr-only" for="bookGuideSearch">Search the library catalogue</label><input type="search" id="bookGuideSearch" autocomplete="off" placeholder="Find a library title (optional)…" aria-label="Search library titles and authors"><select id="bookGuideSelect" aria-label="Select optional book context"><option value="">No book selected — ask anything</option></select><p id="bookGuideDetails" class="book-guide-book-note">No book required. Select a title only when you want the AI to use its catalogue details.</p></div></details>
  <div class="book-guide-capabilities"><span class="book-guide-live"><span aria-hidden="true">●</span> Provider selected automatically</span><label for="bookGuideWebSearch" class="book-guide-web-switch"><input id="bookGuideWebSearch" type="checkbox"><span class="book-guide-web-slider" aria-hidden="true"></span><span class="book-guide-web-copy"><strong>Search the web</strong><small>External book-catalogue matching runs automatically for inventory questions. Turn this on for broader web research (AI provider required).</small></span></label></div></div></details>
  <div id="bookGuideMessages" class="book-guide-messages" role="log" aria-live="polite" aria-relevant="additions text"></div>
  <div class="book-guide-prompts" id="bookGuidePrompts"><button type="button" data-prompt="What is the current Book of the Week?">This week’s book</button><button type="button" data-prompt="How do I use Library Manager?">App guide</button><button type="button" data-prompt="How do I scan, review and save a book?">Scan workflow</button><button type="button" data-prompt="How do I lend or return a library book?">Lend &amp; return</button><button type="button" data-prompt="How do I check in, record books read, and check out of the library?">Visit log</button><button type="button" data-prompt="Recommend three beginner-friendly books about data analysis.">Book ideas</button><button type="button" data-prompt="Explain the difference between a novel and a biography.">Ask a question</button><button type="button" data-prompt="What are some current developments in digital libraries?">Current research</button><button type="button" data-prompt="What is this book about?">Selected book</button></div>
  <form class="book-guide-compose" id="bookGuideForm"><label for="bookGuideInput" class="sr-only">Ask Library AI anything</label><textarea id="bookGuideInput" rows="1" maxlength="1200" autocomplete="off" placeholder="Message Library AI…" required></textarea><button type="submit" id="bookGuideSend" aria-label="Send question" title="Send question"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button></form>
  <p class="book-guide-disclaimer" id="bookGuideDisclaimer">AI may make mistakes. Check important information.</p>
 </section>`;document.body.appendChild(node);
 $('bookGuideFab').addEventListener('click',()=>open());$('bookGuideClose').addEventListener('click',close);
 $('bookGuideNewChat').addEventListener('click',()=>{void resetConversation();});
 $('bookGuideBackdrop').addEventListener('click',close);
 $('bookGuideSelect').addEventListener('change',e=>{const index=Number(e.target.value);if(e.target.value!==''&&books[index])selectBook(books[index]);else{current=null;$('bookGuideContextLabel').textContent='Add a book';$('bookGuideDetails').textContent='General questions are welcome. No library title is needed.';}});
 $('bookGuideSearch').addEventListener('input',renderOptions);
 $('bookGuidePrompts').addEventListener('click',e=>{const b=e.target.closest('[data-prompt]');if(b)void ask(b.dataset.prompt);});
 $('bookGuideForm').addEventListener('submit',e=>{e.preventDefault();const v=$('bookGuideInput').value.trim();if(v){$('bookGuideInput').value='';fitComposer();void ask(v);}});
 $('bookGuideInput').addEventListener('input',fitComposer);
 $('bookGuideInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('bookGuideForm').requestSubmit();}});
 document.addEventListener('keydown',e=>{
  const panel=$('bookGuidePanel');if(panel.hidden)return;
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(e.key==='Tab'&&lockedPage){
   const tabbable=[...panel.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')].filter(x=>x.getClientRects().length);
   if(!tabbable.length)return;const first=tabbable[0],last=tabbable[tabbable.length-1];
   if(e.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){e.preventDefault();first.focus();}
  }
 });
 document.addEventListener('touchmove',e=>{if(lockedPage&&!e.target.closest('.book-guide-panel'))e.preventDefault()},{passive:false});
 window.visualViewport?.addEventListener('resize',syncSheetViewport);window.visualViewport?.addEventListener('scroll',syncSheetViewport);
 window.addEventListener('resize',()=>{if($('bookGuidePanel')?.hidden)return;if(isMobileSheet())lockBackground();else unlockBackground();
 $('bookGuideSettings').open=false;syncSheetViewport();});
 renderOptions();setVisible(visible);
}
function fitComposer(){const box=$('bookGuideInput');if(!box)return;box.style.height='auto';box.style.height=Math.min(box.scrollHeight,126)+'px';}
function renderOptions(){
 if(!ready)return;
 const select=$('bookGuideSelect'),query=norm($('bookGuideSearch')?.value).toLowerCase();
 const selectedIndex=current?books.findIndex(b=>b.title===current.title&&b.isbn===current.isbn&&b.authors===current.authors):-1;
 const fragment=document.createDocumentFragment();
 fragment.appendChild(new Option('No book selected — ask anything',''));
 let matches=0;
 books.forEach((b,i)=>{
  if(query&&!([b.title,b.authors,b.isbn].some(v=>String(v||'').toLowerCase().includes(query))))return;
  fragment.appendChild(new Option(b.title+(b.authors?' · '+b.authors:''),String(i)));
  matches++;
 });
 select.replaceChildren(fragment);
 if(selectedIndex>=0&&(!query||select.querySelector(`option[value="${selectedIndex}"]`)))select.value=String(selectedIndex);
 $('bookGuideCount').textContent=books.length?query?matches+' of '+books.length+' titles':books.length+' library titles':'General AI mode';
}

function setMessageText(messageNode,text){
 const body=messageNode.querySelector('.book-guide-message-body');
 if(!body)return;
 const value=String(text??'');messageNode.dataset.messageText=value;
 if(messageNode.classList.contains('assistant')&&root.LibraryBookGuideFormat?.render){root.LibraryBookGuideFormat.render(body,value)}
 else{body.replaceChildren();body.textContent=value}
}
function addMessage(role,message){
 const m=document.createElement('div');m.className='book-guide-message '+role;
 const avatar=document.createElement('span');avatar.className='book-guide-message-avatar';avatar.textContent=role==='assistant'?'✦':'You';
 const body=document.createElement('div');body.className='book-guide-message-body';m.append(avatar,body);
 setMessageText(m,message);$('bookGuideMessages').appendChild(m);
 if(role==='user'){$('bookGuidePanel').classList.add('has-conversation');$('bookGuideSettings').open=false;}
 $('bookGuideMessages').scrollTop=$('bookGuideMessages').scrollHeight;return m;
}
function selectBook(value){current=safeBook(value);if(!ready)init();$('bookGuideSettings').open=true;$('bookGuideContext').open=true;$('bookGuideContextLabel').textContent=current.title.slice(0,34);$('bookGuideDetails').textContent=[current.authors?'By '+current.authors:'Author unknown',current.shelf?'Shelf '+current.shelf:'Shelf not listed'].join(' · ')+' · Book context applies to your next question only.';renderOptions();}
function openGeneral({search=false}={}){
 if(!ready)init();
 current=null;$('bookGuideSettings').open=false;
 $('bookGuideContextLabel').textContent='No book selected';
 $('bookGuideContext').open=false;
 $('bookGuideDetails').textContent='Ask about any topic; no library title is required.';
 $('bookGuideWebSearch').checked=!!search;
 renderOptions();open();
}
function addSources(messageNode,answer){
 messageNode.querySelector('.book-guide-sources')?.remove();
 const raw=Array.isArray(answer?.sources)?answer.sources:[];
 const safe=raw.filter(x=>x&&typeof x.url==='string').map(x=>{
  try{const url=new URL(x.url);if(url.protocol!=='https:'&&url.protocol!=='http:')return null;
   return {url:url.href,title:String(x.title||url.hostname).slice(0,100)};}catch{return null;}
 }).filter(Boolean).slice(0,6);
 const node=document.createElement('div');node.className='book-guide-sources';
 if(answer?.searchRequested){
  const status=document.createElement('span');status.className='book-guide-grounding';
  status.textContent=answer.searchUnavailable?'Broader web search unavailable':safe.length?'Verified external sources':'Web search enabled · no verified source links';node.append(status);
 }
 if(safe.length){
  const title=document.createElement('span');title.className='book-guide-source-heading';title.textContent='Sources';node.appendChild(title);
  for(const item of safe){const link=document.createElement('a');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=item.title;node.appendChild(link);}
 }
 if(node.childNodes.length)messageNode.querySelector('.book-guide-message-body')?.appendChild(node);
 // Search suggestions supplied by Google are hosted in a sandboxed frame: untrusted
 // provider HTML can never execute scripts in the application origin.
 if(answer?.grounded&&typeof answer.searchSuggestions==='string'&&answer.searchSuggestions.length){
  const suggestions=document.createElement('iframe');suggestions.className='book-guide-search-suggestions';
  suggestions.title='Google Search suggestions';suggestions.loading='lazy';suggestions.referrerPolicy='no-referrer';
  suggestions.setAttribute('sandbox','allow-popups allow-popups-to-escape-sandbox');
  suggestions.srcdoc=answer.searchSuggestions.slice(0,10000);messageNode.querySelector('.book-guide-message-body')?.appendChild(suggestions);
 }
}
const greeting='Hi! I can guide you through Library Manager, help you scan books, manage inventory, or explore a title. Your AI conversation is saved privately in Supabase.';
// A quiet, accessible connection indicator: green for confirmed cloud access,
// grey when signed out, loading, offline, or a cloud operation has failed.
function setCloudConnected(connected){
 if(!ready)return;
 const node=$('bookGuideCloudStatus'),up=!!connected && navigator.onLine!==false;
 node.dataset.connected=up?'true':'false';
 const label=up?'Supabase connected':'Supabase disconnected';
 node.setAttribute('aria-label',label);node.title=label;
}
function clearChatView(){
 if(!ready)return;$('bookGuideMessages').replaceChildren();$('bookGuidePanel').classList.remove('has-conversation');
}
function authNotice(){
 clearChatView();setCloudConnected(false);
 $('bookGuideProvider').textContent='Private AI assistant';
 addMessage('assistant','Sign in on the Library Manager homepage to use this assistant. Conversations are stored in Supabase, never in this browser.');
 $('bookGuideSend').disabled=true;
}
async function cloudRequest(method,path,payload){
 if(!activeSession?.access_token)throw Error('Sign in with your Library Manager account to use cloud AI.');
 const headers={'Authorization':'Bearer '+activeSession.access_token};
 if(payload!==undefined)headers['Content-Type']='application/json';
 let response;
 try{response=await fetch(path,{method,headers,cache:'no-store',...(payload===undefined?{}:{body:JSON.stringify(payload)}),signal:AbortSignal.timeout(60000)});}
 catch{const error=Error('Connection to Supabase unavailable.');error.code='AI_CLOUD_UNAVAILABLE';throw error;}
 const data=await response.json().catch(()=>({error:'Unexpected server response'}));
 if(!response.ok){
  const error=Error(data.error||'The Supabase conversation is unavailable.');
  error.code=data.code||'AI_REQUEST_FAILED';error.userSaved=data.userSaved===true;throw error;
 }
 return data;
}
async function loadCloud(){
 if(!ready)init();if(!activeSession?.user?.id){authNotice();return;}
 if(cloudLoading)return cloudLoading;
 const epoch=chatEpoch;
 setCloudConnected(false);$('bookGuideSend').disabled=true;
 cloudLoading=(async()=>{
  try{
   const data=await cloudRequest('GET','/api/library-ai-history');
   if(epoch!==chatEpoch)return;
   clearChatView();for(const m of data.messages||[]){
    const node=addMessage(m.role,m.content);
    if(m.role==='assistant' && Array.isArray(m.sources)&&m.sources.length)addSources(node,{sources:m.sources});
   }
   if(!(data.messages||[]).length)addMessage('assistant',greeting);
   cloudLoaded=true;setCloudConnected(true);
   $('bookGuideProvider').textContent='Private AI assistant';
   $('bookGuideSend').disabled=false;
  }catch(err){
   if(epoch!==chatEpoch)return;
   cloudLoaded=false;setCloudConnected(false);
   $('bookGuideProvider').textContent='Private AI assistant';
   clearChatView();addMessage('assistant','I could not load your Supabase chat. Please check the connection and reopen this panel. Chat is paused to avoid losing messages.');
   $('bookGuideSend').disabled=true;
  }
 })().finally(()=>{cloudLoading=null;});
 return cloudLoading;
}
function setSession(next){
 const oldId=cloudUser,nowId=next?.user?.id||null;
 activeSession=next?.user?.id&&next?.access_token?next:null;
 cloudUser=activeSession?.user?.id||null;
 if(oldId!==cloudUser){chatEpoch++;cloudLoaded=false;cloudLoading=null;busy=false;
  if(ready){$('bookGuideSend').disabled=true;clearChatView();}
  if(cloudUser){void loadCloud();}else if(ready){authNotice();}
 }else if(cloudUser&&!cloudLoaded&&!cloudLoading){void loadCloud();}
}
async function resetConversation(){
 if(!activeSession?.user){authNotice();return;}
 if(busy)return;
 if(!root.confirm('Reset Library AI conversation? This will permanently delete your AI chat history from Supabase on all devices. Your library books and loans will not be affected.'))return;
 const epoch=chatEpoch;
 $('bookGuideNewChat').disabled=true;$('bookGuideSend').disabled=true;
 // Retain the last confirmed connection state while the reset is in flight.
 try{
  await cloudRequest('DELETE','/api/library-ai-history');if(epoch!==chatEpoch)return;chatEpoch++;cloudLoaded=true;
  clearChatView();current=null;$('bookGuideContextLabel').textContent='Add a book';
  $('bookGuideDetails').textContent='No book selected. Choose a title to add context.';
  $('bookGuideProvider').textContent='Private AI assistant';
  setCloudConnected(true);
  addMessage('assistant',greeting);$('bookGuideSend').disabled=false;$('bookGuideInput').focus({preventScroll:true});
 }catch(err){setCloudConnected(false);cloudLoaded=false;addMessage('assistant','Unable to reset this conversation. Please reconnect and try again.');$('bookGuideSend').disabled=true;}
 finally{$('bookGuideNewChat').disabled=false;}
}
async function ask(question){
 if(!ready)init();if(busy)return;question=String(question||'').trim().slice(0,1200);if(!question)return;
 if(!activeSession?.user){authNotice();return;}
 if(!cloudLoaded){await loadCloud();if(!cloudLoaded)return;}
 const epoch=chatEpoch;
 addMessage('user',question);
 const searchRequested=!!$('bookGuideWebSearch')?.checked;
 const pending=addMessage('assistant',searchRequested?'Searching and preparing your answer…':'Thinking…');
 busy=true;$('bookGuideSend').disabled=true;$('bookGuideNewChat').disabled=true;
 try{
  const response=await cloudRequest('POST','/api/book-chat',{book:current||null,question,searchWeb:searchRequested});
  if(epoch!==chatEpoch)return;
  if(!response.cloud||typeof response.reply!=='string')throw Error('Cloud persistence was not confirmed.');
  setMessageText(pending,response.reply);addSources(pending,response);
  const names={gemini:'Gemini',openrouter:'OpenRouter',groq:'Groq','app-help':'Verified app guide','live-catalogue':'Live library spotlight','inventory':'Live inventory','inventory-research':'Inventory + verified external catalogues'};
  $('bookGuideProvider').textContent='Answered with '+(names[response.mode]||'Library AI');
  setCloudConnected(true);
 }catch(error){
  if(epoch!==chatEpoch)return;
  const saved=error?.userSaved===true;
  const cloudFailure=['AI_CLOUD_ERROR','AI_CLOUD_UNAVAILABLE','AUTH_REQUIRED'].includes(error?.code);
  setMessageText(pending,saved?'Your question was saved in Supabase, but I could not finish the reply. You can retry.':'I could not confirm this message was saved. Reconnect to restore your conversation before retrying.');
  setCloudConnected(saved&&!cloudFailure);
  if(cloudFailure)cloudLoaded=false;
 }finally{
  busy=false;$('bookGuideNewChat').disabled=false;$('bookGuideSend').disabled=!cloudLoaded;
  if($('bookGuidePanel')&&!$('bookGuidePanel').hidden)$('bookGuideInput').focus({preventScroll:true});
 }
}
function isMobileSheet(){return root.matchMedia('(max-width: 899px)').matches;}
function syncSheetViewport(){
 if(!ready)return;
 const vv=root.visualViewport;
 $('bookGuidePanel').style.setProperty('--guide-vv-height',Math.round(vv?.height||root.innerHeight)+'px');
 $('bookGuidePanel').style.setProperty('--guide-vv-top',Math.round(vv?.offsetTop||0)+'px');
}
function lockBackground(){
 if(!ready||!isMobileSheet())return;
 if(!lockedPage){
  const body=document.body,html=document.documentElement;
  lockedPage={y:root.scrollY||html.scrollTop||0,bodyPosition:body.style.position,bodyTop:body.style.top,bodyLeft:body.style.left,bodyRight:body.style.right,bodyWidth:body.style.width,bodyOverflow:body.style.overflow,htmlOverflow:html.style.overflow};
  body.style.position='fixed';body.style.top='-'+lockedPage.y+'px';body.style.left='0';body.style.right='0';body.style.width='100%';body.style.overflow='hidden';html.style.overflow='hidden';
  body.classList.add('book-guide-sheet-open');
 }
 $('bookGuideBackdrop').hidden=false;$('bookGuidePanel').setAttribute('aria-modal','true');
 syncSheetViewport();
}
function unlockBackground(){
 if(!ready)return;
 $('bookGuideBackdrop').hidden=true;$('bookGuidePanel').setAttribute('aria-modal','false');
 if(!lockedPage)return;
 const state=lockedPage;lockedPage=null;const body=document.body,html=document.documentElement;
 body.style.position=state.bodyPosition;body.style.top=state.bodyTop;body.style.left=state.bodyLeft;body.style.right=state.bodyRight;body.style.width=state.bodyWidth;body.style.overflow=state.bodyOverflow;html.style.overflow=state.htmlOverflow;
 body.classList.remove('book-guide-sheet-open');root.scrollTo(0,state.y);
}
function open(){
 if(!ready)init();if(!visible)return;
 returnFocus=document.activeElement;
 $('bookGuidePanel').hidden=false;$('bookGuideFab').setAttribute('aria-expanded','true');
 if(isMobileSheet())lockBackground();else unlockBackground();
 $('bookGuideSettings').open=false;
 if(!activeSession?.user)authNotice();else if(!cloudLoaded&&!cloudLoading)void loadCloud();
 (isMobileSheet() ? $('bookGuideClose') : $('bookGuideInput')).focus({preventScroll:true});
}
function close(){
 if(!ready)return;
 $('bookGuidePanel').hidden=true;$('bookGuideFab').setAttribute('aria-expanded','false');
 unlockBackground();
 const target=returnFocus?.isConnected?returnFocus:$('bookGuideFab');returnFocus=null;
 if(!target.hidden)target.focus({preventScroll:true});
}
function setVisible(value){visible=!!value;document.body.dataset.bookGuideVisible=visible?'true':'false';if(!ready)return;$('bookGuideFab').hidden=!visible;if(!visible)close();}
function setBooks(list){
 books=Array.isArray(list)?list.filter(b=>b&&String(b.title||'').trim()).map(safeBook)
  .filter((b,i,a)=>a.findIndex(v=>v.title===b.title&&v.isbn===b.isbn&&v.authors===b.authors)===i)
  .sort((a,b)=>a.title.localeCompare(b.title)):[];
 if(!books.length){current=null;if(ready){$('bookGuideContextLabel').textContent='Add a book';$('bookGuideDetails').textContent='Ask any question, or select a library title for context.';}}
 if(featured&&document.body.dataset.publicSpotlight==='true'&& !books.some(b=>b.title===featured.title&&b.isbn===featured.isbn))books.unshift(featured);
 if(!ready)init();renderOptions();
}
function addBook(value){const book=safeBook(value);if(!book.title)return;
 featured=book;const i=books.findIndex(b=>b.title===book.title&&b.isbn===book.isbn);
 if(i<0){books.push(book);books.sort((a,b)=>a.title.localeCompare(b.title));}renderOptions();
}
function openBook(book){if(!ready)init();const b=safeBook(book);
 if(b.title&&!books.some(x=>x.title===b.title&&x.isbn===b.isbn))books.unshift(b);
 if(b.title)selectBook(b);setVisible(true);open();
}
// A public, read-only RPC returns only bibliographic fields; never account or loan records.
// Keep this separate from the authenticated workspace inventory fetch.
async function loadPublicCatalog(){
 if(document.body.dataset.account==='in'&&document.body.dataset.publicSpotlight!=='true')return;
 if(publicCatalogCache){setBooks(publicCatalogCache);return;}
 if(publicCatalogPromise)return publicCatalogPromise;
 publicCatalogPromise=(async()=>{
  if(!root.supabase?.createClient)return;
  const db=root.supabase.createClient('https://hotysnqorkqbiconjskl.supabase.co','sb_publishable_OL7r2hmR6n7OOWY5m-3bRw_Peft2X9q',
   {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const accumulated=[];
  try{
   for(let offset=0;offset<20000;offset+=1000){
    const {data,error}=await db.rpc('library_public_guide_books',{p_offset:offset,p_limit:1000});
    if(error)throw error;
    if(!Array.isArray(data))break;
    accumulated.push(...data);
    if(data.length<1000)break;
   }
   publicCatalogCache=accumulated;
   if(document.body.dataset.account!=='in'||document.body.dataset.publicSpotlight==='true')setBooks(accumulated);
  }catch{
   // On sites where the new SQL upgrade is not yet installed, keep the featured-book
   // fallback rather than trying to read protected library_books in the browser.
   if(ready&&!books.length)$('bookGuideCount').textContent='Catalogue needs setup';
  }
 })().finally(()=>{publicCatalogPromise=null;});
 return publicCatalogPromise;
}
root.LibraryBookGuide={setVisible,setBooks,addBook,openBook,openGeneral,loadPublicCatalog,setSession};
root.addEventListener('offline',()=>{setCloudConnected(false);cloudLoaded=false;if(ready)$('bookGuideSend').disabled=true;});
root.addEventListener('online',()=>{if(activeSession?.user && !busy && !cloudLoading)void loadCloud();});
document.addEventListener('DOMContentLoaded',()=>{init();setVisible(true);
 if(document.body.dataset.publicSpotlight==='true' && root.supabase?.createClient){
  const db=root.supabase.createClient('https://hotysnqorkqbiconjskl.supabase.co','sb_publishable_OL7r2hmR6n7OOWY5m-3bRw_Peft2X9q',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  db.auth.onAuthStateChange((_event,next)=>setSession(next));
  void db.auth.getSession().then(({data})=>setSession(data?.session||null)).catch(()=>setSession(null));
 }else if(!activeSession)authNotice();
});
})(window);
