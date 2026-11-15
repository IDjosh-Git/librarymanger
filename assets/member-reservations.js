/* RC19: accessible title-first reservation picker, independent floating action. */
(function(root){'use strict';
 const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
 function init(ctx){if(!document.getElementById('automationBackdrop')||document.getElementById('memberReservationsOpen'))return;
  const btn=el('button','reservation-fab');btn.type='button';btn.id='memberReservationsOpen';btn.setAttribute('aria-label','Open book reservations');btn.setAttribute('title','Book reservations');btn.setAttribute('aria-haspopup','dialog');btn.innerHTML='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true"><path d="M5 4.5c2.6-1.2 5.1-.8 7 1 1.9-1.8 4.4-2.2 7-1v14c-2.6-1.2-5.1-.8-7 1-1.9-1.8-4.4-2.2-7-1v-14ZM12 5.5v14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 8v5m-2.5-2.5h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  btn.hidden=true;
  const backdrop=el('div','reservation-backdrop');backdrop.id='memberReservationsBackdrop';backdrop.hidden=true;
  const dialog=el('section','reservation-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','reservationTitle');dialog.tabIndex=-1;
  const head=el('header','reservation-head');const heading=el('div');heading.append(el('span','reservation-eyebrow','YOUR LIBRARY'),el('h2','', 'Book reservations'),el('p','','Find a book by its name and join the waiting list.'));
  heading.querySelector('h2').id='reservationTitle';const close=el('button','reservation-close','×');close.type='button';close.setAttribute('aria-label','Close reservations');head.append(heading,close);
  const form=el('form','reservation-form');const label=el('label','reservation-label','Search for a book by title');label.htmlFor='reservationTitleSearch';
  const searchWrap=el('div','reservation-search-wrap');searchWrap.innerHTML='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4.3 4.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const input=el('input');input.id='reservationTitleSearch';input.type='search';input.autocomplete='off';input.placeholder='Enter a book name…';input.minLength=2;input.maxLength=150;input.setAttribute('aria-controls','reservationMatches');searchWrap.append(input);
  const matches=el('div','reservation-matches');matches.id='reservationMatches';matches.setAttribute('aria-live','polite');
  const selected=el('div','reservation-selected');selected.hidden=true;const submit=el('button','reservation-submit','Reserve selected book');submit.type='submit';submit.disabled=true;
  const status=el('p','reservation-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  form.append(label,searchWrap,matches,selected,submit,status);
  const section=el('section','reservation-history');section.append(el('h3','','My reservations'));const list=el('div','reservation-list');section.append(list);
  dialog.append(head,form,section);backdrop.append(dialog);document.body.append(btn,backdrop);
  let selectedBook=null,searchToken=0,searchTimer=null,lastFocus=null;
  const user=async()=>{const {data,error}=await ctx.supabase.auth.getUser();if(error)throw error;return data?.user?.id||null};
  function setStatus(message){status.textContent=message||''}
  function choose(book){selectedBook=book;selected.hidden=false;selected.textContent='Selected: '+book.title;submit.disabled=false;matches.replaceChildren();input.value=book.title;setStatus('')}
  async function findBooks(query){const token=++searchToken;selectedBook=null;selected.hidden=true;submit.disabled=true;matches.textContent='Searching library…';try{
    const escaped=query.replace(/[%,_\\]/g,c=>'\\'+c);
    const {data,error}=await ctx.supabase.from('library_books').select('record_id,title').ilike('title','%'+escaped+'%').order('title',{ascending:true}).limit(15);
    if(error)throw error;if(token!==searchToken)return;matches.replaceChildren();const seen=new Set();
    for(const book of data||[]){if(!book.record_id||!book.title||seen.has(book.record_id))continue;seen.add(book.record_id);const option=el('button','reservation-match');option.type='button';option.textContent=book.title;option.addEventListener('click',()=>choose(book));matches.append(option)}
    if(!matches.childElementCount)matches.textContent='No matching books. Try another title.';
   }catch(e){if(token===searchToken)matches.textContent='Search unavailable: '+String(e.message||e)}}
  input.addEventListener('input',()=>{clearTimeout(searchTimer);++searchToken;selectedBook=null;selected.hidden=true;submit.disabled=true;const q=input.value.trim();if(q.length<2){matches.textContent='Type at least 2 letters to search.';return}searchTimer=setTimeout(()=>void findBooks(q),250)});
  async function refresh(){const {data,error}=await ctx.supabase.rpc('library_my_reservations');if(error)throw error;list.replaceChildren();const records=data||[];const ids=[...new Set(records.map(r=>r.book_record_id).filter(Boolean))];const titleById=new Map();
   if(ids.length){const result=await ctx.supabase.from('library_books').select('record_id,title').in('record_id',ids);if(!result.error)for(const b of result.data||[])titleById.set(b.record_id,b.title)}
   for(const r of records){const row=el('div','reservation-history-row');const name=el('strong','',titleById.get(r.book_record_id)||'Book unavailable in catalogue');const meta=el('small','',r.status+' · '+new Date(r.created_at).toLocaleDateString());const info=el('div');info.append(name,meta);row.append(info);
    if(r.status==='waiting'){const cancel=el('button','reservation-cancel','Cancel');cancel.type='button';cancel.addEventListener('click',async()=>{cancel.disabled=true;try{const {data:ok,error}=await ctx.supabase.rpc('library_cancel_my_reservation',{p_id:r.id});if(error)throw error;setStatus(ok?'Reservation cancelled.':'Reservation cannot be cancelled.');await refresh()}catch(e){setStatus(String(e.message||e))}finally{cancel.disabled=false}});row.append(cancel)}list.append(row)}
   if(!records.length)list.append(el('p','reservation-empty','You have no reservations yet.'));
  }
  async function visibility(){try{btn.hidden=!(await user())}catch{btn.hidden=true}}
  function dismiss(){backdrop.hidden=true;btn.setAttribute('aria-expanded','false');lastFocus?.focus?.()}
  btn.addEventListener('click',async()=>{lastFocus=document.activeElement;backdrop.hidden=false;btn.setAttribute('aria-expanded','true');input.focus();try{await refresh()}catch(e){setStatus(String(e.message||e))}});
  close.addEventListener('click',dismiss);backdrop.addEventListener('click',e=>{if(e.target===backdrop)dismiss()});backdrop.addEventListener('keydown',e=>{if(e.key==='Escape')dismiss();if(e.key==='Tab'){const nodes=[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled])')].filter(n=>n.getClientRects().length);if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
  form.addEventListener('submit',async e=>{e.preventDefault();if(!selectedBook)return setStatus('Choose a book from the search results.');submit.disabled=true;try{const uid=await user();if(!uid)throw Error('Sign in to reserve books.');const {error}=await ctx.supabase.from('library_reservations').insert({member_user_id:uid,book_record_id:selectedBook.record_id,status:'waiting'});if(error)throw error;input.value='';selectedBook=null;selected.hidden=true;matches.replaceChildren();setStatus('Reservation added to the waiting list.');await refresh()}catch(err){setStatus('Could not reserve: '+String(err.message||err))}finally{submit.disabled=!selectedBook}});
  ctx.supabase.auth.onAuthStateChange(()=>{void visibility()});void visibility();
 }
 function openWithTitle(title){
  const button=document.getElementById('memberReservationsOpen');if(!button||button.hidden)return false;
  button.click();const input=document.getElementById('reservationTitleSearch');
  if(input&&title){input.value=String(title).slice(0,150);input.dispatchEvent(new Event('input',{bubbles:true}));}
  return true;
 }
 root.LibraryMemberReservations={init,openWithTitle};
})(typeof window!=='undefined'?window:globalThis);
