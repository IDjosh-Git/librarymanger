/* Progressive enhancement only: never reads or writes production records. */
(()=>{'use strict';
 const ready=()=>{
  const staff=document.getElementById('uxStaffSignIn');
  staff?.addEventListener('click',()=>{
   const target=document.getElementById('loggedOut');
   target?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
   const signIn=document.getElementById('showSignIn');
   signIn?.click();
   document.getElementById('email')?.focus({preventScroll:true});
  });
  // Do not change signup role values, authentication handlers or admin access code checks.
  // The existing inventory/review/loan actions and state machines are untouched.
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
