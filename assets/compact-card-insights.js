
/* v5.17 — Accessible + / − controls for optional card messages. */
(()=>{
  'use strict';
  const targets=[
    '#dashboard .dashboard-surface .dashboard-chart-note',
    '#dashboard .dashboard-health .dashboard-chart-note',
    '#dashboard .dashboard-due-list p',
    '#inventory .inventory-scanned-link span',
    '#shelfScan .batch-info',
    '#shelfScan .scan-review-inbox-head p',
    '#shelfScan .batch-book-hint',
    '#review .scan-review-heading p',
    '#review .review-card-lookup-status',
    '#review .batch-book-hint',
    '#review .saved-review-heading p',
    '#review .saved-review-notice',
    '#review .scan-tool-card p:not([role="status"])',
    '#review .scan-advanced-intro p',
    '#review .review-card-save-note',
    '#scanned .scanned-data-heading p',
    '#scanned .scanned-hero p',
    '#lend .circulation-hero-copy p',
    '#return .circulation-hero-copy p',
    '#history .circulation-hero-copy p',
    '#dashboard .dashboard-surface .dashboard-status-message',
    '.public-settings-card .form-help'
  ].join(',');
  let sequence=0,queued=false;
  function check(el){
    if(!(el instanceof HTMLElement)||el.closest('button,summary,label,[contenteditable="true"]'))return;
    const value=(el.textContent||'').trim();
    const long=value.length>100;
    let button=el.nextElementSibling;
    if(!el.dataset.compactNoteReady){
      if(!long)return;
      el.dataset.compactNoteReady='1';
      el.classList.add('compact-insight-text');
      if(!el.id)el.id='compact-note-'+(++sequence);
      button=document.createElement('button');
      button.type='button';button.className='compact-insight-toggle';
      button.setAttribute('aria-controls',el.id);
      button.setAttribute('aria-expanded','false');
      button.setAttribute('aria-label','Expand this card message');
      button.innerHTML='<span class="compact-insight-symbol" aria-hidden="true">+</span><span class="compact-insight-label">Read more</span>';
      el.insertAdjacentElement('afterend',button);
      return;
    }
    if(!button||!button.classList.contains('compact-insight-toggle'))return;
    if(!long){
      button.hidden=true;el.classList.add('is-expanded');
    }else if(button.hidden){
      button.hidden=false;el.classList.remove('is-expanded');
      button.setAttribute('aria-expanded','false');
      button.setAttribute('aria-label','Expand this card message');
      const icon=button.querySelector('.compact-insight-symbol'),name=button.querySelector('.compact-insight-label');
      if(icon)icon.textContent='+';
      if(name)name.textContent='Read more';
    }
  }
  function refresh(){
    queued=false;
    const root=document.querySelector('#libraryArea');
    if(!root)return;
    root.querySelectorAll(targets).forEach(check);
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(refresh)}
  function init(){
    const root=document.querySelector('#libraryArea');if(!root)return;
    root.addEventListener('click',e=>{
      const button=e.target.closest('.compact-insight-toggle');
      if(!button||!root.contains(button))return;
      const id=button.getAttribute('aria-controls');
      const content=id?document.getElementById(id):null;
      if(!content)return;
      const expanded=button.getAttribute('aria-expanded')!=='true';
      button.setAttribute('aria-expanded',String(expanded));
      button.setAttribute('aria-label',expanded?'Collapse this card message':'Expand this card message');
      content.classList.toggle('is-expanded',expanded);
      button.querySelector('.compact-insight-symbol').textContent=expanded?'−':'+';
      button.querySelector('.compact-insight-label').textContent=expanded?'Show less':'Read more';
    });
    const observer=new MutationObserver(changes=>{
      // Existing queue and inventory rendering adds DOM nodes. Update only after those changes.
      if(changes.some(c=>c.type==='childList' || (c.type==='characterData' && c.target.parentElement?.matches(targets))))schedule();
    });
    observer.observe(root,{subtree:true,childList:true,characterData:true});
    refresh();
    window.LibraryCompactInsights={refresh:schedule};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
