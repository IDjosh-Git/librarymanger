/* Book Guide: bibliographic answers free of charge; generative replies require an optional server key.
   The public page passes only already-published featured-book metadata; never borrower records. */
(function(root){
'use strict';
let books=[],current=null,visible=false,ready=false,busy=false,history=[];
const $=id=>document.getElementById(id);
const norm=s=>String(s||'').trim().slice(0,350);
function safeBook(b){return {title:norm(b?.title),authors:norm(b?.authors),isbn:norm(b?.isbn),shelf:norm(b?.shelf),publisher:norm(b?.publisher),year:norm(b?.year),subject:norm(b?.subject),pages:norm(b?.pages),description:norm(b?.description).slice(0,1200)};}
function init(){if(ready)return;ready=true;
 const node=document.createElement('div');node.className='book-guide-root';node.innerHTML=`
 <button type="button" class="book-guide-fab" id="bookGuideFab" aria-controls="bookGuidePanel" aria-expanded="false" aria-label="Open book assistant"><span class="book-guide-fab-symbol" aria-hidden="true">✦</span><span class="book-guide-fab-label">Ask about a book</span><span class="book-guide-fab-glow" aria-hidden="true"></span></button>
 <section class="book-guide-panel" id="bookGuidePanel" aria-labelledby="bookGuideTitle" role="dialog" aria-modal="false" hidden>
  <header class="book-guide-head"><div class="book-guide-icon" aria-hidden="true">✦</div><div class="book-guide-title-wrap"><span class="book-guide-eyebrow">YOUR READING COMPANION</span><h2 id="bookGuideTitle">Book Guide</h2><p>Explore a title, ask anything you are curious about.</p></div><button class="book-guide-close" type="button" id="bookGuideClose" aria-label="Close book assistant">×</button></header>
  <div class="book-guide-selection"><label for="bookGuideSelect">BOOK TO EXPLORE</label><select id="bookGuideSelect" aria-label="Choose a book"><option value="">Choose a book from the library…</option></select><p id="bookGuideDetails" class="book-guide-book-note">Choose a title to get started.</p></div>
  <div id="bookGuideMessages" class="book-guide-messages" role="log" aria-live="polite" aria-relevant="additions text"></div>
  <div class="book-guide-prompts" id="bookGuidePrompts"><button type="button" data-prompt="What is this book about?">What is it about?</button><button type="button" data-prompt="Who wrote it?">Author</button><button type="button" data-prompt="Where can I find it?">Location</button><button type="button" data-prompt="What should I know before reading?">Reading tips</button></div>
  <form class="book-guide-compose" id="bookGuideForm"><label for="bookGuideInput" class="sr-only">Ask a question about the selected book</label><input id="bookGuideInput" maxlength="500" autocomplete="off" placeholder="Ask about this book…" required><button type="submit" id="bookGuideSend" aria-label="Send question" title="Send question"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button></form>
  <p class="book-guide-disclaimer" id="bookGuideDisclaimer"><span class="book-guide-note-icon" aria-hidden="true">✦</span><span><strong>Reading tip:</strong> Ask questions, compare ideas, and check key details in the book or with your librarian.</span></p>
 </section>`;document.body.appendChild(node);
 $('bookGuideFab').addEventListener('click',()=>open());$('bookGuideClose').addEventListener('click',close);
 $('bookGuideSelect').addEventListener('change',e=>{const index=Number(e.target.value);if(e.target.value!==''&&books[index])selectBook(books[index]);});
 $('bookGuidePrompts').addEventListener('click',e=>{const b=e.target.closest('[data-prompt]');if(b)void ask(b.dataset.prompt);});
 $('bookGuideForm').addEventListener('submit',e=>{e.preventDefault();const v=$('bookGuideInput').value.trim();if(v){$('bookGuideInput').value='';void ask(v);}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('bookGuidePanel').hidden)close()});
 renderOptions();setVisible(visible);
}
function renderOptions(){if(!ready)return;const select=$('bookGuideSelect'),last=select.value;select.replaceChildren();select.add(new Option(books.length?'Choose a book…':'No books available yet',''));
 books.forEach((b,i)=>select.add(new Option(b.title+(b.authors?' · '+b.authors:''),String(i))));if(books[Number(last)]&&last!=='')select.value=last;
 if(current){const index=books.findIndex(b=>b.title===current.title&&b.isbn===current.isbn);if(index>=0)select.value=String(index);}
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
 $('bookGuideMessages').scrollTop=$('bookGuideMessages').scrollHeight;return m;
}
function selectBook(value){current=safeBook(value);history=[];if(!ready)init();$('bookGuideMessages').replaceChildren();$('bookGuideDetails').textContent=[current.authors?'By '+current.authors:'Author unknown',current.shelf?'Shelf '+current.shelf:'Ask the library for its shelf'].join(' · ');addMessage('assistant','Let’s explore “'+(current.title||'this title')+'”. You can ask about its author, edition, location, topics or reading suggestions.');renderOptions();}
function localAnswer(question){const q=question.toLowerCase(),b=current;if(!b)return'Choose a book above and I’ll help you explore its available catalogue details.';const intro=b.title+(b.authors?' by '+b.authors:'');
 if(/(author|wrote|writer|who.*(write|wrote|written))/.test(q))return b.authors?'The catalogue credits '+b.authors+' as the author of “'+b.title+'”.':'The author is not listed in the available catalogue data. Check the title page to confirm.';
 if(/(isbn|edition|barcode|identifier)/.test(q))return b.isbn?'The listed ISBN or barcode is '+b.isbn+'. Check the physical copy for the exact edition.':'There is no verified ISBN or barcode on file for this book.';
 if(/(where|shelf|location|find|available|borrow|loan)/.test(q))return b.shelf?'The recorded shelf is '+b.shelf+'. Availability can change, so confirm with the librarian.':'The shelf is not specified. Please ask the library team for its location and borrowing availability.';
 if(/(page|length|how long)/.test(q))return b.pages?'The catalogue lists '+b.pages+' pages.':'The catalogue does not specify a page count.';
 if(/(publisher|publish|year|when)/.test(q))return [b.publisher?'Publisher: '+b.publisher:null,b.year?'Year: '+b.year:null].filter(Boolean).join('. ')||'Publisher and publication year are not verified in the current catalogue.';
 if(/(topic|subject|genre|category|about|summary|plot|story|describe|theme)/.test(q))return b.description?'The published description says: '+b.description:(b.subject?'The catalogue lists these subjects: '+b.subject+'.':'There is no book summary in the catalogue for '+intro+'. I can share verified details, but I won’t invent its plot or topics.');
 if(/(recommend|read|tip|before|start|difficulty|good for)/.test(q))return'To decide if '+intro+' suits you, read the introduction or first chapter, check the subject or edition, and ask the librarian for a preview. '+(b.subject?'Its listed subject is '+b.subject+'.':'The catalogue does not list a subject yet.');
 return'I can help with '+intro+' using catalogue information: author, title, ISBN, shelf, publisher, year and subjects. For deeper discussion, try a specific question about this title or consult your librarian.';
}
async function ask(question){if(!ready)init();if(busy)return;if(!current){addMessage('assistant','Select a book from the dropdown first.');return;}question=norm(question).slice(0,500);if(!question)return;
 addMessage('user',question);const pending=addMessage('assistant','Thinking about the catalogue details…');busy=true;$('bookGuideSend').disabled=true;
 try{
  const body={book:current,question,history:history.slice(-6)};const response=await fetch('/api/book-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('AI model not available');const json=await response.json();if(!json.reply||typeof json.reply!=='string')throw new Error('Missing response');
  setMessageText(pending,json.reply);
 }catch{setMessageText(pending,localAnswer(question));}
 finally{history.push({role:'user',text:question},{role:'assistant',text:pending.dataset.messageText||''});history=history.slice(-8);busy=false;$('bookGuideSend').disabled=false;}
}
function open(){if(!ready)init();if(!visible)return;$('bookGuidePanel').hidden=false;$('bookGuideFab').setAttribute('aria-expanded','true');$('bookGuideInput').focus({preventScroll:true});if(!$('bookGuideMessages').children.length)addMessage('assistant','Hello! Pick a book to explore its details, get guidance, or start a conversation.');}
function close(){if(!ready)return;$('bookGuidePanel').hidden=true;$('bookGuideFab').setAttribute('aria-expanded','false');$('bookGuideFab').focus({preventScroll:true});}
function setVisible(value){visible=!!value;document.body.dataset.bookGuideVisible=visible?'true':'false';if(!ready)return;$('bookGuideFab').hidden=!visible;if(!visible)close();}
function setBooks(list){books=Array.isArray(list)?list.filter(b=>b&&String(b.title||'').trim()).map(safeBook).filter((b,i,a)=>a.findIndex(v=>v.title===b.title&&v.isbn===b.isbn)===i).sort((a,b)=>a.title.localeCompare(b.title)).slice(0,5000):[];if(!ready)init();renderOptions();}
function openBook(book){if(!ready)init();const b=safeBook(book);if(b.title&&!books.some(x=>x.title===b.title&&x.isbn===b.isbn)){books.unshift(b)}if(b.title)selectBook(b);setVisible(true);open();}
root.LibraryBookGuide={setVisible,setBooks,openBook};document.addEventListener('DOMContentLoaded',()=>{init();if(document.body.dataset.publicSpotlight==='true')setVisible(true);});
})(window);
