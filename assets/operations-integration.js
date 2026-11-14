/* v6 RC4 — admin operational workflows. No notification is represented as sent. */
(function(root){'use strict';
 const $=id=>document.getElementById(id);
 function init(ctx){const panel=$('automationBackdrop');if(!panel)return;
 const status=$('automationStatus');
 const say=msg=>{status.textContent=msg};
 const guarded=async(fn)=>{if(!ctx.isAdmin()){say('Administrator access required.');return;}try{await fn()}catch(e){say('Operation failed: '+String(e.message||e))}};
 async function snapshot(){await guarded(async()=>{const {data,error}=await ctx.supabase.rpc('library_admin_operations_snapshot');if(error)throw error;const keys=[['inventory_total','Inventory copies'],['pending_review','Pending Review'],['open_loans','Open loans'],['overdue_loans','Overdue loans'],['waiting_reservations','Waiting reservations'],['pending_notifications','Queued notifications'],['weekly_spotlight_current','Current weekly picks']];const node=$('operationsSnapshot');node.replaceChildren(...keys.map(([key,label])=>{const div=document.createElement('div');div.className='automation-stat';const strong=document.createElement('strong');strong.textContent=String(data?.[key]??'—');const small=document.createElement('small');small.textContent=label;div.append(strong,small);return div}));say('Live operations snapshot loaded from Supabase.')})}
 async function queue(){await guarded(async()=>{const {data,error}=await ctx.supabase.rpc('library_queue_due_notices');if(error)throw error;say(`${Number(data)||0} new due-date notices queued. Delivery requires a configured notification worker; no emails or SMS have been sent.`);await snapshot()})}
 async function reservations(){await guarded(async()=>{const {data,error}=await ctx.supabase.from('library_reservations').select('book_record_id,status,created_at,member_user_id').in('status',['waiting','notified']).order('created_at',{ascending:true}).limit(100);if(error)throw error;const node=$('operationsReservations');node.replaceChildren();if(!data?.length){node.textContent='No waiting reservations.';return;}for(const r of data){const p=document.createElement('p');p.textContent=`${r.book_record_id} · ${r.status} · ${new Date(r.created_at).toLocaleDateString()} · member ${String(r.member_user_id).slice(0,8)}…`;node.append(p)}say(`Showing ${data.length} reservation records.`)})}
 $('operationsRefresh')?.addEventListener('click',snapshot);$('operationsQueue')?.addEventListener('click',queue);$('operationsReservationsButton')?.addEventListener('click',reservations);
 $('openAutomationCenter')?.addEventListener('click',()=>{if(ctx.isAdmin())void snapshot()});
 }
 root.LibraryOperationsIntegration={init};
})(typeof window!=='undefined'?window:globalThis);
