/* Library Manager: real app-use-only administrator directory. No privileged writes in the browser. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { rows: [], client: null, viewer: null, target: null, busy: false, pending: null, lastRecordId: null, lastRecordAt: 0 };
  const record = async (client, viewer) => {
    if (!client || !viewer) return;
    if (state.lastRecordId === viewer && Date.now() - state.lastRecordAt < 60000) return;
    state.lastRecordId = viewer;
    state.lastRecordAt = Date.now();
    try {
      const { error } = await client.rpc('library_admin_mark_app_visit');
      if (error) { state.lastRecordAt = 0; console.warn('Admin visit tracking not available:', error.message); }
    } catch (error) { state.lastRecordAt = 0; console.warn('Admin visit tracking unavailable:', error); }
  };
  const humanDate = value => {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not recorded';
    return new Intl.DateTimeFormat(undefined, {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);
  };
  const setStatus = (text, error=false) => {
    if (!$('lamStatus')) return;
    $('lamStatus').hidden = false;
    $('lamStatus').textContent = text;
    $('lamStatus').classList.toggle('is-error',error);
  };
  const initials = text => String(text || 'A').trim().split(/\s+/).slice(0,2).map(word => word.slice(0,1)).join('').toUpperCase().slice(0,2);
  const make = (tag,className,text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  };
  function render() {
    const term = ($('lamSearch')?.value || '').trim().toLocaleLowerCase();
    const filtered = state.rows.filter(r => `${r.email || ''} ${r.display_name || ''}`.toLocaleLowerCase().includes(term));
    const list = $('lamList');
    if (!list) return;
    list.replaceChildren();
    const cutoff = Date.now() - 30*24*60*60*1000;
    $('lamTotal').textContent = state.rows.length;
    $('lamRecent').textContent = state.rows.filter(r => new Date(r.last_seen_at).getTime() >= cutoff).length;
    $('lamCount').textContent = `${filtered.length} ${filtered.length === 1 ? 'administrator' : 'administrators'} shown of ${state.rows.length} verified app users`;
    if (!filtered.length) {
      list.append(make('div','lam-empty',state.rows.length ? 'No administrators match your search.' : 'No app administrators recorded yet. A verified admin will appear here after signing in to this release.'));
      return;
    }
    for (const admin of filtered) {
      const entry = make('article','lam-person');
      entry.setAttribute('role','listitem');
      const avatar = make('span','lam-avatar',initials(admin.display_name || admin.email));
      avatar.setAttribute('aria-hidden','true');
      const details = make('div','lam-person-info');
      const top = make('div','lam-person-top');
      top.append(make('strong','lam-person-name',admin.display_name || admin.email || 'Administrator'));
      const isMe = !!admin.is_self || admin.user_id === state.viewer;
      top.append(make('span',isMe ? 'lam-person-tag is-me' : 'lam-person-tag',isMe ? 'You' : 'Verified admin'));
      details.append(top, make('span','lam-person-email',admin.email || 'Email unavailable'));
      const meta = make('div','lam-person-meta');
      meta.append(make('span','',`Last seen: ${humanDate(admin.last_seen_at)}`));
      meta.append(make('span','',`First used: ${humanDate(admin.first_seen_at)}`));
      details.append(meta);
      const actions = make('div','lam-person-actions');
      if (isMe) {
        actions.append(make('span','lam-current-label','Protected account'));
      } else {
        const removeButton = make('button','lam-remove','Remove access');
        removeButton.type = 'button';
        removeButton.setAttribute('aria-label',`Remove administrator access for ${admin.display_name || admin.email}`);
        removeButton.addEventListener('click',()=>confirmRemoval(admin));
        actions.append(removeButton);
      }
      entry.append(avatar,details,actions);
      list.append(entry);
    }
  }
  async function load(client, viewer) {
    if (!client || !viewer || !$('lamList')) return;
    state.client = client;
    state.viewer = viewer;
    if (state.pending) return state.pending;
    state.pending = (async () => {
      state.busy = true;
      const btn = $('lamRefresh'); if (btn) btn.disabled = true;
      setStatus('Verifying access and loading the administrator directory…');
      try {
        await record(client, viewer);
        const { data, error } = await client.rpc('library_admin_app_directory');
        if (error) throw error;
        state.rows = Array.isArray(data) ? data : [];
        $('lamStatus').hidden = true;
        render();
      } catch (error) {
        state.rows = [];
        render();
        const message = String(error?.message || 'Unable to load the directory');
        setStatus(/could not find the function|schema cache|does not exist|404/i.test(message)
          ? 'Admin Management needs the included Supabase migration. Apply library_admin_management_upgrade.sql, then refresh this page.'
          : `Unable to load verified administrators: ${message}`,true);
      } finally { state.busy = false; if (btn) btn.disabled=false; state.pending=null; }
    })();
    return state.pending;
  }
  function confirmRemoval(admin) {
    if (!state.client || !state.viewer || state.busy || admin.user_id===state.viewer) return;
    const dialog=$('lamRemoveDialog');
    if (!dialog?.showModal) { setStatus('Your browser does not support the secure confirmation dialog.',true);return; }
    state.target=admin;
    $('lamConfirmDetail').textContent = `This removes ${admin.display_name || admin.email} (${admin.email || 'no email'}) from the administrator role. Their account and book history stay intact, but administrator tools become unavailable.`;
    $('lamConfirmInput').value='';
    $('lamConfirm').disabled=true;
    $('lamRemoveError').hidden=true;
    dialog.showModal();
    $('lamConfirmInput').focus();
  }
  async function remove() {
    if (!state.target || state.busy || !$('lamConfirmInput') || $('lamConfirmInput').value.trim()!=='REMOVE') return;
    const target=state.target;
    if (target.user_id===state.viewer) return;
    state.busy=true;
    $('lamConfirm').disabled=true;
    $('lamCancel').disabled=true;
    $('lamConfirm').textContent='Removing…';
    try {
      const {data,error}=await state.client.rpc('library_admin_remove_member',{p_user_id:target.user_id});
      if (error) throw error;
      if (data !== true) throw new Error('The database did not confirm the role change.');
      $('lamRemoveDialog').close();
      state.target=null;
      await load(state.client,state.viewer);
      setStatus('Administrator access removed. The user account remains available.');
    } catch (error) {
      const notice=$('lamRemoveError');
      notice.textContent=String(error?.message||'Could not remove administrator access.');
      notice.hidden=false;
    } finally {
      state.busy=false;
      $('lamCancel').disabled=false;
      $('lamConfirm').textContent='Remove admin access';
      $('lamConfirm').disabled=$('lamConfirmInput').value.trim()!=='REMOVE';
    }
  }
  window.LibraryAdminManagement={record,load};
  document.addEventListener('DOMContentLoaded',() => {
    $('lamSearch')?.addEventListener('input',render);
    $('lamRefresh')?.addEventListener('click',() => load(state.client,state.viewer));
    $('lamConfirmInput')?.addEventListener('input',() => { $('lamConfirm').disabled=$('lamConfirmInput').value.trim()!=='REMOVE'||state.busy; });
    $('lamConfirmInput')?.addEventListener('keydown',e => { if (e.key==='Enter'){ e.preventDefault(); void remove(); } });
    $('lamConfirm')?.addEventListener('click',remove);
    $('lamCancel')?.addEventListener('click',() => $('lamRemoveDialog').close());
    $('lamRemoveDialog')?.addEventListener('close',() => {state.target=null;});
  });
})();
