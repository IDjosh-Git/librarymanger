/* Renders administrator-published public contact details; no user data is read. */
(() => {
  'use strict';
  const SUPABASE_URL='https://hotysnqorkqbiconjskl.supabase.co';
  const SUPABASE_KEY='sb_publishable_OL7r2hmR6n7OOWY5m-3bRw_Peft2X9q';
  const ITEMS=[
    {key:'website',label:'Website',icon:'⌂',hosts:null},
    {key:'whatsapp',label:'WhatsApp',icon:'☎',hosts:['wa.me','api.whatsapp.com','www.whatsapp.com','whatsapp.com']},
    {key:'facebook',label:'Facebook',icon:'f',hosts:['facebook.com','www.facebook.com','m.facebook.com','fb.com']},
    {key:'instagram',label:'Instagram',icon:'◎',hosts:['instagram.com','www.instagram.com']},
    {key:'youtube',label:'YouTube',icon:'▶',hosts:['youtube.com','www.youtube.com','youtu.be']},
    {key:'tiktok',label:'TikTok',icon:'♪',hosts:['tiktok.com','www.tiktok.com']},
    {key:'x_url',label:'X / Twitter',icon:'𝕏',hosts:['x.com','www.x.com','twitter.com','www.twitter.com']},
  ];
  const LABELS={email:'Email',phone:'Call',location:'Visit',hours:'Opening hours'};
  function safeLink(v,hosts){
    try {const u=new URL(String(v||''));
      return u.protocol==='https:'&&!u.username&&!u.password&& (!hosts||hosts.includes(u.hostname.toLowerCase())) ? u.href : '';
    }catch{return ''}
  }
  function addAnchor(parent,href,text,css){
    const a=document.createElement('a');a.href=href;a.textContent=text;if(css)a.className=css;
    if(href.startsWith('https:')){a.target='_blank';a.rel='noopener noreferrer';}
    parent.appendChild(a);return a;
  }
  function render(data){
    const name=String(data?.library_name||'').trim();
    document.querySelectorAll('[data-contact-detail="summary"]').forEach(el=>{
      el.textContent=name?`Connect with ${name} or follow us online for reading updates.`:
        'Connect with the library through the contact information and official links below.';
    });
    for(const [key,label] of Object.entries(LABELS)){
      document.querySelectorAll(`[data-contact-detail="${key}"]`).forEach(el=>{
        el.replaceChildren();const value=String(data?.[key]||'').trim();el.hidden=!value;
        if(!value)return;
        const t=document.createElement('strong');t.textContent=label;el.append(t);
        if(key==='email'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))addAnchor(el,'mailto:'+value,value);
        else if(key==='phone'&&/^[+0-9()\s.\-]{6,40}$/.test(value))addAnchor(el,'tel:'+value.replace(/[^+0-9]/g,''),value);
        else {const span=document.createElement('span');span.textContent=value;el.appendChild(span);}
      });
    }
    document.querySelectorAll('[data-public-socials]').forEach(container=>{
      container.replaceChildren();let shown=0;
      for(const item of ITEMS){
        const url=safeLink(data?.[item.key],item.hosts);if(!url)continue;
        const a=document.createElement('a');a.href=url;a.className='public-social-link';a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',`Visit the library on ${item.label}`);
        const i=document.createElement('span');i.className='public-social-icon';i.textContent=item.icon;i.setAttribute('aria-hidden','true');
        const label=document.createElement('span');label.textContent=item.label;a.append(i,label);container.appendChild(a);shown++;
      }
      if(!shown&&data?.email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)){
        const a=addAnchor(container,'mailto:'+data.email,'✉  Email the library','public-social-link');a.setAttribute('aria-label','Email the library');
      }
      container.hidden=!container.children.length;
    });
  }
  async function load(){
    if(!document.querySelector('[data-public-socials]')||!window.supabase?.createClient)return;
    try{
      const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      const {data,error}=await db.from('library_public_contact')
        .select('library_name,email,phone,location,hours,website,whatsapp,facebook,instagram,youtube,tiktok,x_url')
        .eq('id',1).maybeSingle();
      if(!error)render(data||{});
    }catch{/* Missing migration or network: retain honest placeholder. */}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
  window.addEventListener('library-contact-updated',load);
})();
