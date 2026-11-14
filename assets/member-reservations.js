/* RC5: member reservation self-service; Supabase RLS enforces ownership. */
(function(root){'use strict';
 const byId=id=>document.getElementById(id);
 function init(ctx){
  const anchor=byId('automationBackdrop');if(!anchor)return;
  const btn=document.createElement('button');btn.type='button';btn.id='memberReservationsOpen';btn.className='light';btn.textContent='My book reservations';btn.style.cssText='position:fixed;right:16px;bottom:82px;z-index:60;max-width:210px';btn.hidden=true;
  const modal=document.createElement('div');modal.id='memberReservationsBackdrop';modal.className='automation-backdrop';modal.hidden=true;
  const dialog=document.createElement('section');dialog.className='automation-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','My book reservations');
  const title=document.createElement('h2');title.textContent='My book reservations';
  const info=document.createElement('p');info.textContent='Reserve a physical copy ID. Reservations are processed in order when copies are returned.';
  const form=document.createElement('form');const input=document.createElement('input');input.required=true;input.maxLength=120;input.placeholder='Physical copy ID';input.setAttribute('aria-label','Physical copy ID');
  const submit=document.createElement('button');submit.textContent='Join waiting list';submit.type='submit';submit.className='green';form.append(input,submit);
  const status=document.createElement('p');status.setAttribute('role','status');const list=document.createElement('div');const close=document.createElement('button');close.type='button';close.textContent='Close';close.className='light';
  dialog.append(title,info,form,status,list,close);modal.append(dialog);document.body.append(btn,modal);
  const session=async()=>{const {data,error}=await ctx.supabase.auth.getUser();if(error)throw error;return data?.user?.id||null};
  async function refresh(){const {data,error}=await ctx.supabase.rpc('library_my_reservations');if(error)throw error;list.replaceChildren();for(const r of data||[]){const row=document.createElement('p');row.textContent=`${r.book_record_id} — ${r.status} (${new Date(r.created_at).toLocaleDateString()}) `;if(r.status==='waiting'){const cancel=document.createElement('button');cancel.type='button';cancel.className='light';cancel.textContent='Cancel';cancel.addEventListener('click',async()=>{try{const {data:ok,error:e}=await ctx.supabase.rpc('library_cancel_my_reservation',{p_id:r.id});if(e)throw e;status.textContent=ok?'Reservation cancelled.':'Reservation can no longer be cancelled.';await refresh()}catch(e){status.textContent=String(e.message||e)}});row.append(cancel)}list.append(row)}if(!data?.length)list.textContent='You have no reservations.'}
  async function visibility(){try{btn.hidden=!(await session())}catch{btn.hidden=true}}
  btn.addEventListener('click',async()=>{modal.hidden=false;try{await refresh()}catch(e){status.textContent=String(e.message||e)}});
  close.addEventListener('click',()=>modal.hidden=true);modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true});
  form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{const user=await session();if(!user)throw Error('Sign in to reserve books.');const {error}=await ctx.supabase.from('library_reservations').insert({member_user_id:user,book_record_id:input.value.trim(),status:'waiting'});if(error)throw error;input.value='';status.textContent='Reservation added to the waiting list.';await refresh()}catch(e){status.textContent='Could not reserve: '+String(e.message||e)}finally{submit.disabled=false}});
  ctx.supabase.auth.onAuthStateChange(()=>{void visibility()});void visibility();
 }
 root.LibraryMemberReservations={init};
})(typeof window!=='undefined'?window:globalThis);
