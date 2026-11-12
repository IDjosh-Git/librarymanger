/* Library Manager v5.26 · Supabase daily reading room register.
 * Never stores attendance in browser storage; only authenticated cloud RPC and RLS reads.
 * Explicit check-in creates attendance; website sign-in does not.
 */
(function(root){
  'use strict';
  const ZONE='Africa/Lagos',PAGE_SIZE=20,EXPORT_LIMIT=10000,MAX_BOOKS=12;
  let sb=null,sessionGetter=()=>null,roleGetter=()=>null,booksGetter=()=>[],notify=()=>{};
  let uid=null,role=null,currentPage=null,memberRows=[],memberBooks=[],draftFor=null;
  let report={rows:[],total:0,open:0,completed:0,books:0,page:1,page_size:PAGE_SIZE};
  let busy=false,memberLoading=false,adminLoading=false,expandedId=null;
  const $=id=>document.getElementById(id);
  const escapeHtml=text=>String(text??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const num=v=>Number(v||0).toLocaleString('en-NG');
  function dateParts(value){
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return null;
    const p=new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const o=Object.fromEntries(p.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
    return {y:o.year,m:o.month,d:o.day};
  }
  function todayWat(){const p=dateParts(new Date());return p?`${p.y}-${p.m}-${p.d}`:''}
  function displayDate(value){
    if(!value)return '—';const d=new Date(value);
    if(Number.isNaN(d.getTime()))return '—';
    return new Intl.DateTimeFormat('en-NG',{day:'numeric',month:'short',year:'numeric',timeZone:ZONE}).format(d);
  }
  function displayTime(value){
    if(!value)return '—';const d=new Date(value);
    if(Number.isNaN(d.getTime()))return '—';
    return new Intl.DateTimeFormat('en-NG',{hour:'2-digit',minute:'2-digit',hour12:true,timeZone:ZONE}).format(d);
  }
  function elapsed(start,end){if(!start)return '—';const n=Date.parse(end||new Date().toISOString())-Date.parse(start);if(!Number.isFinite(n)||n<0)return '—';const min=Math.floor(n/60000);const h=Math.floor(min/60);return h?`${h}h ${String(min%60).padStart(2,'0')}m`:`${min} min`}
  function errText(error){let str=String(error?.message||error||'Unknown error');if(error?.code==='23505')return 'You already have an open visit. Check out of that visit before starting another.';if(/function.*does not exist|schema cache|PGRST202|42P01/i.test(str))return 'Daily attendance is not configured yet. Ask an administrator to run database/08_library_daily_visit_register.sql in Supabase.';return str}
  function message(kind,text,id='vlMyMessage'){const el=$(id);if(el){el.textContent=text;el.dataset.kind=kind}if(kind==='error')notify(text,'err');else if(kind==='success')notify(text,'ok')}
  function active(){return memberRows.find(v=>!v.completed&&!v.checked_out_at)||null}
  function titles(row){const b=Array.isArray(row?.library_visit_books)?row.library_visit_books:[];return b.map(x=>x.book_title).filter(Boolean)}
  function safeBooks(items){return [...new Set((items||[]).map(x=>String(x||'').trim()).filter(x=>x.length>=2&&x.length<=240).map(x=>x))].slice(0,MAX_BOOKS)}
  function renderSuggestions(){
    const el=$('vlBookSuggestions');if(!el||!booksGetter)return;
    const seen=new Set(),values=[];
    for(const b of booksGetter()||[]){const title=String(b.title||'').trim();if(title.length<2||seen.has(title.toLowerCase()))continue;seen.add(title.toLowerCase());values.push(title);if(values.length>=250)break}
    el.innerHTML=values.sort((a,b)=>a.localeCompare(b)).map(x=>`<option value="${escapeHtml(x)}"></option>`).join('');
  }
  function renderBooks(){
    const el=$('vlBookChips');if(!el)return;
    el.innerHTML=memberBooks.length?memberBooks.map((title,i)=>`<span class="vl-book"><span title="${escapeHtml(title)}">${escapeHtml(title)}</span><button type="button" data-vl-remove-book="${i}" aria-label="Remove ${escapeHtml(title)}">×</button></span>`).join(''):'<span class="vl-muted">No books added to this visit yet.</span>';
  }
  function refreshDraft(row){
    if(!row){draftFor=null;memberBooks=[];if($('vlVisitNotes'))$('vlVisitNotes').value='';return}
    if(draftFor!==row.id){draftFor=row.id;memberBooks=titles(row);if($('vlVisitNotes'))$('vlVisitNotes').value=row.check_out_notes||''}
  }
  function renderMember(){
    const inProgress=active(),now=memberRows[0];
    if($('vlCheckInCard'))$('vlCheckInCard').hidden=!!inProgress;
    if($('vlReadingCard'))$('vlReadingCard').hidden=!inProgress;
    if($('vlMyVisits'))$('vlMyVisits').textContent=num(memberRows.length);
    if($('vlMyStatus'))$('vlMyStatus').textContent=inProgress?'Checked in':'Checked out';
    if($('vlMyBooks'))$('vlMyBooks').textContent=num(memberRows.reduce((n,v)=>n+titles(v).length,0));
    if($('vlMyLast'))$('vlMyLast').textContent=now?displayDate(now.checked_in_at):'No visits';
    if($('vlSessionTitle'))$('vlSessionTitle').textContent=inProgress?'You are checked in':'Not checked in';
    if($('vlSessionDescription'))$('vlSessionDescription').textContent=inProgress?'Your visit is open. Record your books and check out before leaving.':'Start a new visit to register your attendance.';
    const panel=$('vlSessionBody');if(panel){
      panel.className=inProgress?'vl-current':'vl-empty';
      panel.innerHTML=inProgress?`<div class="vl-current-head"><strong class="vl-status"><i class="vl-status-dot"></i> CHECKED IN</strong><span class="vl-micro">Verified cloud record</span></div><div class="vl-current-steps"><div><small>Arrival · WAT</small><strong>${escapeHtml(displayTime(inProgress.checked_in_at))}</strong></div><div><small>Date</small><strong>${escapeHtml(displayDate(inProgress.checked_in_at))}</strong></div><div><small>Time elapsed</small><strong id="vlElapsed">${escapeHtml(elapsed(inProgress.checked_in_at))}</strong></div><div><small>Reason</small><strong>${escapeHtml(inProgress.visit_purpose)}</strong></div></div>`:'<strong>No active visit</strong><p>Check in using the form to start your attendance record.</p>';
    }
    const history=$('vlMyHistory');if(history){
      history.innerHTML=memberRows.length?memberRows.map(v=>{
        const bs=titles(v);return `<article class="vl-visit"><div class="vl-visit-top"><strong>${escapeHtml(displayDate(v.checked_in_at))} · ${escapeHtml(v.visit_purpose||'Library visit')}</strong><span class="vl-status ${v.completed?'finished':''}"><i class="vl-status-dot"></i>${v.completed?'CHECKED OUT':'CHECKED IN'}</span></div><div class="vl-visit-meta"><div><small>Arrival</small><b>${escapeHtml(displayTime(v.checked_in_at))}</b></div><div><small>Departure</small><b>${escapeHtml(displayTime(v.checked_out_at))}</b></div><div><small>Duration</small><b>${escapeHtml(v.completed?elapsed(v.checked_in_at,v.checked_out_at):'Open visit')}</b></div></div><div class="vl-visit-footer"><strong>Books:</strong> ${bs.length?bs.map(escapeHtml).join(' · '):'None recorded'}${v.check_out_notes?`<p>${escapeHtml(v.check_out_notes)}</p>`:''}</div></article>`
      }).join(''):'<div class="vl-empty"><strong>No visits recorded yet</strong><p>Only a completed Check in creates a record. Your personal attendance history will appear here.</p></div>';
    }
    renderBooks();renderSuggestions();
    if($('vlCheckoutConfirm'))$('vlCheckoutConfirm').hidden=true;
  }
  async function loadMember(){
    if(!sb||role!=='user'||!uid||memberLoading)return;
    memberLoading=true;const key=uid;
    try{
      message('','Loading your saved attendance…');
      const {data,error}=await sb.from('library_daily_visits').select('id,user_id,visitor_name,visitor_email,visit_purpose,checked_in_at,checked_out_at,completed,check_out_notes,library_visit_books(book_title,recorded_at)').eq('user_id',key).order('checked_in_at',{ascending:false}).limit(100);
      if(error)throw error;if(uid!==key||role!=='user')return;
      memberRows=data||[];refreshDraft(active());renderMember();message('','Your visitor record is synced with Supabase.');
    }catch(e){if(uid===key)message('error','Unable to load visit history: '+errText(e));}
    finally{memberLoading=false}
  }
  function canAct(){if(!uid||role!=='user'){message('error','Please sign in as a library user.');return false}if(busy)return false;return true}
  async function checkIn(ev){ev.preventDefault();if(!canAct())return;
    const name=String($('vlVisitorName')?.value||'').trim(),purpose=String($('vlVisitPurpose')?.value||'').trim();
    if(name.length<2||name.length>120)return message('error','Enter your full name before checking in.');
    busy=true;const btn=$('vlCheckInBtn');if(btn)btn.disabled=true;
    try{
      const {error}=await sb.rpc('library_daily_check_in',{p_name:name,p_purpose:purpose});if(error)throw error;
      message('success','You are checked in. Your arrival time has been recorded in Supabase.');
      await loadMember();
    }catch(e){message('error','Check-in failed: '+errText(e));await loadMember();}
    finally{busy=false;if(btn)btn.disabled=false}
  }
  function addBook(){if(!active())return message('error','Check in before adding books.');
    const input=$('vlBookInput'),title=String(input?.value||'').trim();
    if(title.length<2||title.length>240)return message('error','Enter a title between 2 and 240 characters.');
    if(memberBooks.some(t=>t.toLocaleLowerCase()===title.toLocaleLowerCase()))return message('error','That title has already been added to this visit.');
    if(memberBooks.length>=MAX_BOOKS)return message('error',`You can add up to ${MAX_BOOKS} books per visit.`);
    memberBooks.push(title);input.value='';renderBooks();message('','Book added to the draft. Save books or check out to store it in Supabase.');
  }
  async function saveBooks(){const row=active();if(!row||!canAct())return;
    busy=true;if($('vlSaveBooks'))$('vlSaveBooks').disabled=true;
    try{
      const {error}=await sb.rpc('library_daily_record_books',{p_visit_id:row.id,p_titles:memberBooks});if(error)throw error;
      message('success','Your reading list has been saved to Supabase.');await loadMember();
    }catch(e){message('error','Could not save books: '+errText(e))}
    finally{busy=false;if($('vlSaveBooks'))$('vlSaveBooks').disabled=false}
  }
  async function checkOut(){const row=active();if(!row||!canAct())return;
    busy=true;if($('vlConfirmCheckout'))$('vlConfirmCheckout').disabled=true;
    try{
      const notes=String($('vlVisitNotes')?.value||'').trim();
      const {error}=await sb.rpc('library_daily_check_out',{p_visit_id:row.id,p_titles:memberBooks,p_notes:notes});if(error)throw error;
      draftFor=null;message('success','Checked out successfully. Your departure time and books are saved in Supabase.');await loadMember();
    }catch(e){message('error','Check-out failed: '+errText(e))}
    finally{busy=false;if($('vlConfirmCheckout'))$('vlConfirmCheckout').disabled=false;if($('vlCheckoutConfirm'))$('vlCheckoutConfirm').hidden=true}
  }
  function adminParams(page){return {p_from:$('vlFromDate')?.value||null,p_to:$('vlToDate')?.value||null,p_status:$('vlStatusFilter')?.value||'all',p_query:($('vlSearch')?.value||'').trim(),p_page:page,p_page_size:PAGE_SIZE}}
  function setReportMessage(kind,text){message(kind,text,'vlAdminMessage')}
  function reportStatus(value){return value?'Checked out':'Checked in'}
  function renderAdmin(){
    const p=report,total=Number(p.total||0),pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
    for(const [id,v] of [['vlAdminTotal',p.total],['vlAdminOpen',p.open],['vlAdminClosed',p.completed],['vlAdminBooks',p.books]])if($(id))$(id).textContent=num(v);
    if($('vlPageInfo'))$('vlPageInfo').textContent=`Page ${p.page||1} of ${pages}`;
    if($('vlPrevPage'))$('vlPrevPage').disabled=(p.page||1)<=1;
    if($('vlNextPage'))$('vlNextPage').disabled=(p.page||1)>=pages;
    if($('vlAdminCount'))$('vlAdminCount').textContent=total?`Showing ${num(((p.page||1)-1)*PAGE_SIZE+1)}–${num(Math.min(total,(p.page||1)*PAGE_SIZE))} of ${num(total)} recorded visits.`:'No matching checked-in visits.';
    const body=$('vlAdminBody');if(!body)return;
    if(!p.rows?.length){body.innerHTML='<tr><td colspan="7" class="vl-report-empty">No library visitors have checked in for these filters. Registering an account or signing into the website alone does not create an attendance record.</td></tr>';return}
    body.innerHTML=p.rows.map(v=>{
      const books=Array.isArray(v.books)?v.books:[],details=expandedId===v.id;
      const initials=String(v.visitor_name||'?').trim().split(/\s+/).slice(0,2).map(t=>t[0]||'').join('').toUpperCase();
      const label=reportStatus(v.completed);
      return `<tr><td><div class="vl-person"><span class="vl-avatar" aria-hidden="true">${escapeHtml(initials)}</span><div><b>${escapeHtml(v.visitor_name)}</b><small>${escapeHtml(v.visitor_email)}</small></div></div></td><td class="vl-td-time">${escapeHtml(displayTime(v.checked_in_at))}<span>${escapeHtml(displayDate(v.checked_in_at))}</span></td><td class="vl-td-time">${escapeHtml(displayTime(v.checked_out_at))}<span>${v.completed?'Departure recorded':'Awaiting check-out'}</span></td><td>${escapeHtml(v.completed?elapsed(v.checked_in_at,v.checked_out_at):'Open')}</td><td>${num(books.length)} ${books.length===1?'title':'titles'}</td><td><span class="vl-status ${v.completed?'finished':''}"><i class="vl-status-dot"></i>${escapeHtml(label)}</span></td><td><button type="button" class="vl-action soft" data-vl-expand="${escapeHtml(v.id)}" aria-expanded="${details?'true':'false'}" aria-controls="vl-extra-${escapeHtml(v.id)}">${details?'Hide':'View'} details</button></td></tr>
      <tr id="vl-extra-${escapeHtml(v.id)}" class="vl-details-row" ${details?'':'hidden'}><td colspan="7"><div class="vl-details-box"><div><small>Visit purpose</small><strong>${escapeHtml(v.visit_purpose||'—')}</strong></div><div><small>Books read</small><strong>${books.length?books.map(escapeHtml).join(' · '):'No titles recorded'}</strong></div><div><small>Reading / visit notes</small><strong>${escapeHtml(v.check_out_notes||'No notes added')}</strong></div><div><small>Check-in timestamp (WAT)</small><strong>${escapeHtml(displayDate(v.checked_in_at))} · ${escapeHtml(displayTime(v.checked_in_at))}</strong></div><div><small>Check-out timestamp (WAT)</small><strong>${v.checked_out_at?escapeHtml(displayDate(v.checked_out_at))+' · '+escapeHtml(displayTime(v.checked_out_at)):'Not checked out'}</strong></div><div><small>Registered visit ID</small><strong>${escapeHtml(v.id)}</strong></div></div></td></tr>`
    }).join('');
  }
  async function fetchReport(page){const {data,error}=await sb.rpc('library_daily_admin_report',adminParams(page));if(error)throw error;return data||{rows:[],total:0,open:0,completed:0,books:0,page,page_size:PAGE_SIZE}}
  async function loadAdmin(page=1){if(!sb||role!=='admin'||!uid||adminLoading)return;
    adminLoading=true;const key=uid;if($('vlAdminSync'))$('vlAdminSync').textContent='↻ Syncing…';
    try{const data=await fetchReport(page);if(uid!==key||role!=='admin')return;report=data;expandedId=null;renderAdmin();setReportMessage('','Last refreshed from Supabase. Showing only recorded check-ins.');if($('vlAdminSync'))$('vlAdminSync').textContent='● Cloud synced'}
    catch(e){if(uid===key){setReportMessage('error','Could not retrieve attendance records: '+errText(e));if($('vlAdminSync'))$('vlAdminSync').textContent='Cloud unavailable'}}
    finally{adminLoading=false}
  }
  function csvCell(v){let s=String(v??'').replace(/[\r\n\t]+/g,' ').trim();if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
  async function exportCSV(){if(role!=='admin'||!uid||busy)return;
    busy=true;if($('vlExportCsv'))$('vlExportCsv').disabled=true;
    try{
      const results=[];let page=1,total=0;
      do{
        const {data,error}=await sb.rpc('library_daily_admin_report',{...adminParams(page),p_page_size:100});if(error)throw error;
        total=Number(data?.total||0);const batch=data?.rows||[];if(!batch.length)break;results.push(...batch);page++;
      }while(results.length<Math.min(total,EXPORT_LIMIT));
      if(!results.length)return setReportMessage('','No checked-in visits match the selected filters.');
      const lines=[['Visitor name','Email','Date (WAT)','Check in (WAT)','Check out (WAT)','Duration','Status','Purpose','Books read','Notes','Visit ID'].map(csvCell).join(',')];
      for(const v of results){lines.push([v.visitor_name,v.visitor_email,displayDate(v.checked_in_at),displayTime(v.checked_in_at),displayTime(v.checked_out_at),v.completed?elapsed(v.checked_in_at,v.checked_out_at):'',reportStatus(v.completed),v.visit_purpose,(v.books||[]).join('; '),v.check_out_notes,v.id].map(csvCell).join(','))}
      const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=`library-daily-visits-${todayWat()}.csv`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      setReportMessage('success',`Downloaded ${num(results.length)} visit records.${total>results.length?' Export limited to 10,000 visits; narrow the date range for the remainder.':''}`);
    }catch(e){setReportMessage('error','Export failed: '+errText(e))}
    finally{busy=false;if($('vlExportCsv'))$('vlExportCsv').disabled=false}
  }
  function clear(){uid=null;role=null;memberRows=[];memberBooks=[];draftFor=null;report={rows:[],total:0,open:0,completed:0,books:0,page:1,page_size:PAGE_SIZE};expandedId=null;busy=false;memberLoading=false;adminLoading=false;if($('vlMyHistory'))$('vlMyHistory').replaceChildren();if($('vlAdminBody'))$('vlAdminBody').replaceChildren()}
  function setContext(session,memberRole){
    const newUid=session?.user?.id||null,newRole=memberRole||null;
    if(newUid===uid&&newRole===role)return;
    clear();uid=newUid;role=newRole;
    if(uid&&role==='user'){
      if($('vlVisitorName')){$('vlVisitorName').value=String(session.user.user_metadata?.full_name||session.user.user_metadata?.name||'').slice(0,120)}
    }
  }
  function onTab(name){currentPage=name;
    if(name==='dailyLog'&&role==='user'){renderSuggestions();void loadMember()}
    if(name==='attendance'&&role==='admin'){if(!$('vlFromDate').value&&!$('vlToDate').value){$('vlFromDate').value=todayWat();$('vlToDate').value=todayWat()}void loadAdmin(1)}
  }
  function init(cfg){sb=cfg.supabase;sessionGetter=cfg.getSession||sessionGetter;roleGetter=cfg.getRole||roleGetter;booksGetter=cfg.getBooks||booksGetter;notify=cfg.toast||notify;
    if(!$('vlCheckInForm'))return;
    $('vlCheckInForm').addEventListener('submit',checkIn);
    $('vlAddBookBtn').onclick=addBook;
    $('vlBookInput').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();addBook()}});
    $('vlBookChips').addEventListener('click',event=>{const btn=event.target.closest('[data-vl-remove-book]');if(!btn)return;const i=Number(btn.dataset.vlRemoveBook);memberBooks.splice(i,1);renderBooks()});
    $('vlSaveBooks').onclick=()=>void saveBooks();
    $('vlCheckoutBtn').onclick=()=>{if(active()){$('vlCheckoutConfirm').hidden=false;$('vlConfirmCheckout').focus()}};
    $('vlCancelCheckout').onclick=()=>{$('vlCheckoutConfirm').hidden=true};
    $('vlConfirmCheckout').onclick=()=>void checkOut();
    $('vlRefreshMine').onclick=()=>void loadMember();
    $('vlFilterForm').onsubmit=event=>{event.preventDefault();void loadAdmin(1)};
    $('vlFilterToday').onclick=()=>{$('vlFromDate').value=todayWat();$('vlToDate').value=todayWat();void loadAdmin(1)};
    $('vlFilterAll').onclick=()=>{$('vlFromDate').value='';$('vlToDate').value='';void loadAdmin(1)};
    $('vlAdminRefresh').onclick=()=>void loadAdmin(report.page||1);
    $('vlExportCsv').onclick=()=>void exportCSV();
    $('vlPrevPage').onclick=()=>void loadAdmin((report.page||1)-1);
    $('vlNextPage').onclick=()=>void loadAdmin((report.page||1)+1);
    $('vlAdminBody').onclick=event=>{const b=event.target.closest('[data-vl-expand]');if(!b)return;expandedId=expandedId===b.dataset.vlExpand?null:b.dataset.vlExpand;renderAdmin()};
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&uid&&currentPage==='attendance'&&role==='admin')void loadAdmin(report.page||1)});
    setInterval(()=>{if(uid&&role==='user'&&currentPage==='dailyLog'&&!document.hidden&&active()&&$('vlElapsed'))$('vlElapsed').textContent=elapsed(active().checked_in_at)},60000);
  }
  root.LibraryDailyVisits={init,setContext,onTab,clear,displayTime,displayDate,todayWat,elapsed,csvCell};
})(window);
