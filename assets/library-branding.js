/* Shared library branding. The database is the source of truth; browser defaults are fallbacks. */
(()=>{'use strict';
 const DEFAULT={app_name:'Library Manager',primary_color:'#144e58',secondary_color:'#1d727a',button_style:'gradient',logo_url:null};
 const $=id=>document.getElementById(id);
 const validHex=v=>/^#[0-9a-fA-F]{6}$/.test(String(v||''));
 const safeName=v=>String(v||'').trim().slice(0,70);
 const safeLogo=v=>typeof v==='string'&&/^https:\/\//i.test(v)?v:null;
 const state={...DEFAULT};
 const columns='app_name,primary_color,secondary_color,button_style,logo_url';
 const logoTypes={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
 let client=null,session=null,role=null,revision=0,busy=false;
 let published={...DEFAULT},dirty=false,removeLogo=false,previewUrl=null;
 function luminance(hex){
  return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
   .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
   .reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 }
 function contrast(x,y){
  const a=luminance(x),b=luminance(y);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 }
 const ink=color=>contrast(color,'#ffffff')>=4.5?'#ffffff':'#000000';
 function actionColors(a,b,style){
  if(style==='solid')return {background:a,foreground:ink(a),fallback:false};
  const foreground=['#ffffff','#000000'].find(color=>[a,b].every(stop=>contrast(stop,color)>=4.5));
  return foreground?{background:`linear-gradient(125deg, ${a}, ${b})`,foreground,fallback:false}
   :{background:a,foreground:ink(a),fallback:true};
 }
 function apply(v){Object.assign(state,{...DEFAULT,...v});const root=document.documentElement;
 const a=validHex(state.primary_color)?state.primary_color:DEFAULT.primary_color,b=validHex(state.secondary_color)?state.secondary_color:DEFAULT.secondary_color;
 root.style.setProperty('--library-primary',a);root.style.setProperty('--library-secondary',b);
 // Derive the visual system from the saved palette; fixed values below are only initial fallbacks.
 const hexRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
 const toHex=arr=>'#'+arr.map(n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0')).join('');
 const blend=(c,d,weight)=>toHex(hexRgb(c).map((v,i)=>v*(1-weight)+hexRgb(d)[i]*weight));
 const gradient=actionColors(a,b,'gradient');
 const action=actionColors(a,b,state.button_style);
 const brandGradient=gradient.fallback?`linear-gradient(125deg, ${a}, ${a})`:gradient.background;
 const dark=root.dataset.theme==='dark';
 const surface=dark?'#182b3b':'#ffffff';
 const tint=blend(b,surface,dark?.20:.10);
 const soft=blend(a,surface,dark?.24:.08);
 const border=blend(a,surface,dark?.44:.25);
 const hover=blend(a,dark?'#ffffff':'#000000',dark?.18:.13);
 const semantic={
 '--app-brand':a,'--app-brand-secondary':b,'--app-brand-hover':hover,
 '--app-brand-soft':soft,'--app-brand-soft-strong':blend(a,surface,dark?.32:.16),
 '--app-brand-border':border,'--app-brand-gradient':brandGradient,
 '--app-on-brand':ink(a),'--app-on-secondary':ink(b),'--app-on-gradient':gradient.foreground,
 '--app-focus-ring':blend(b,surface,.45),'--app-brand-contrast':ink(a),
 '--library-action':action.background,'--library-action-text':action.foreground,
 '--library-brand-ink':dark?blend(a,'#ffffff',.65):blend(a,'#000000',.25),
 '--library-brand-tint':tint,
 '--navy':a,'--navy2':b,'--navy3':blend(a,'#000000',.28),
 '--accent':a,'--accent2':b,'--ring':b,
 '--primary':a,'--primary-color':a,'--secondary':b,'--secondary-color':b,
 '--brand':a,'--brand2':b,'--brand-primary':a,'--brand-secondary':b,
 '--brand-hover':hover,'--brand-soft':soft,'--brand-border':border,
 '--brand-dark-gradient':brandGradient
 };
 for(const [key,value] of Object.entries(semantic))root.style.setProperty(key,value);
 root.dataset.brandButtons=state.button_style==='solid'?'solid':'gradient';
 const name=safeName(state.app_name)||DEFAULT.app_name;
 document.querySelectorAll('[data-library-brand-name]').forEach(el=>el.textContent=name);
 document.querySelectorAll('[data-library-brand-logo]').forEach(img=>{img.src=safeLogo(state.logo_url)||'assets/book-logo.svg';});
 document.title=name+' | Library Workspace';
 }
 function setStatus(message){$('brandStatus').textContent=message;}
 function selectColor(id,fallback){const value=$(id).value;return validHex(value)?value.toLowerCase():fallback;}
 function draftValues(){
  return {
   app_name:safeName($('brandAppName').value),
   primary_color:selectColor('brandPrimary',DEFAULT.primary_color),
   secondary_color:selectColor('brandSecondary',DEFAULT.secondary_color),
   button_style:$('brandButtonStyle').value,
   logo_url:removeLogo?null:safeLogo(published.logo_url)
  };
 }
 function clearLogoFile(){
  if(previewUrl)URL.revokeObjectURL(previewUrl);
  previewUrl=null;
  $('brandLogoFile').value='';
 }
 function renderPreview(){
  const el=$('appearancePreview');
  const draft=draftValues();
  const {primary_color:a,secondary_color:b,button_style:style}=draft;
  const action=actionColors(a,b,style);
  el.style.setProperty('--preview-primary',a);
  el.style.setProperty('--preview-secondary',b);
  el.style.setProperty('--preview-action',action.background);
  el.style.setProperty('--preview-on-brand',action.foreground);
  el.dataset.corners=$('appearanceCorners').value;
  el.dataset.previewTheme=$('appearancePreviewTheme').value;
  const badge=$('appearancePreviewLogo');
  badge.src=previewUrl||draft.logo_url||'assets/book-logo.svg';
  $('appearancePreviewName').textContent=draft.app_name||DEFAULT.app_name;
  for(const preset of document.querySelectorAll('.appearance-preset')){
   const selected=preset.dataset.primary===a&&preset.dataset.secondary===b;
   preset.setAttribute('aria-pressed',String(selected));
  }
  const status=$('appearanceContrast');
  status.textContent=action.fallback
   ?'These colours use a solid action background for readable text.'
   :'The preview action uses readable text contrast.';
  status.dataset.warning=String(action.fallback);
 }
 function writeFields(settings){
  $('brandAppName').value=safeName(settings.app_name)||DEFAULT.app_name;
  $('brandPrimary').value=validHex(settings.primary_color)?settings.primary_color:DEFAULT.primary_color;
  $('brandSecondary').value=validHex(settings.secondary_color)?settings.secondary_color:DEFAULT.secondary_color;
  $('brandButtonStyle').value=settings.button_style==='solid'?'solid':'gradient';
  renderPreview();
 }
 function resetDraft(settings=published){
  clearLogoFile();
  dirty=false;
  removeLogo=false;
  $('brandDiscard').hidden=true;
  writeFields(settings);
 }
 function queueDraft(message='Preview updated. Save shared branding to publish.'){
  dirty=true;
  $('brandDiscard').hidden=false;
  renderPreview();
  setStatus(message);
 }
 function canEdit(){return role==='admin'&&Boolean(session?.user);}
 function syncAccess(){$('brandFields').disabled=busy||!canEdit();}
 async function refresh(){
  if(!client||busy)return;
  const request=++revision;
  try {
   const {data,error}=await client.from('library_app_settings').select(columns).eq('id',1).maybeSingle();
   if(request!==revision)return;
   if(error)throw error;
   if(!data)throw Error('Missing shared branding settings.');
   published={...DEFAULT,...data};
   apply(published);
   if(!dirty){
    resetDraft();
    setStatus('Branding is shared across accounts.');
   }
  }catch{
   if(request===revision&&canEdit()&&!dirty)setStatus('Shared branding is unavailable. Reload this page to retry.');
  }
 }
 function setContext(nextSession,nextRole){
  const changed=session?.user?.id!==nextSession?.user?.id||role!==nextRole;
  session=nextSession;role=nextRole;
  if(!changed||!client)return;
  revision++;
  resetDraft();
  syncAccess();
  setStatus('Branding is shared across accounts.');
  void refresh();
 }
 async function save(event){
  event.preventDefault();
  if(busy||!canEdit())return;
  const draft=draftValues();
  if(!draft.app_name||!['solid','gradient'].includes(draft.button_style)){
   setStatus('Enter a name and choose an appearance.');
   return;
  }
  const file=$('brandLogoFile').files?.[0];
  const actor=session.user.id;
  const saveRequest=++revision;
  busy=true;syncAccess();
  setStatus('Saving shared branding…');
  try {
   if(file){
    if(!logoTypes[file.type]||file.size>1024*1024)throw Error('Use a PNG, JPG, or WebP logo no larger than 1 MB.');
    const path='branding/library-logo-'+Date.now()+'.'+logoTypes[file.type];
    const bucket=client.storage.from('library-branding');
    const uploaded=await bucket.upload(path,file,{contentType:file.type,upsert:false});
    if(uploaded.error)throw uploaded.error;
    draft.logo_url=safeLogo(bucket.getPublicUrl(path).data?.publicUrl);
    if(!draft.logo_url)throw Error('The uploaded logo has no public URL.');
   }
   if(revision!==saveRequest||!canEdit()||session.user.id!==actor)return;
   const {data,error}=await client.from('library_app_settings').update(draft).eq('id',1).select(columns).single();
   if(revision!==saveRequest)return;
   if(error)throw error;
   const matches=data&&Object.entries(draft).every(([key,value])=>
    (key.endsWith('_color')?String(data[key]).toLowerCase():data[key])===value);
   if(!matches)throw Error('Saved settings could not be verified.');
   published={...DEFAULT,...data};
   apply(published);
   resetDraft();
   setStatus('Branding saved and applied across the app.');
  }catch(error){
   if(revision===saveRequest)setStatus('Unable to save: '+(error.message||String(error)));
  }finally{
   busy=false;syncAccess();
   if(revision!==saveRequest)void refresh();
  }
 }
 function init(sb,currentSession=null,currentRole=null){
  if(client)return;
  client=sb;session=currentSession;role=currentRole;
  apply(DEFAULT);
  $('appearancePreviewTheme').value=document.documentElement.dataset.theme==='dark'?'dark':'light';
  resetDraft();
  syncAccess();
  new MutationObserver(()=>apply(state)).observe(document.documentElement,{attributeFilter:['data-theme']});
  $('brandForm').addEventListener('submit',save);
  for(const id of ['brandAppName','brandPrimary','brandSecondary','brandButtonStyle']){
   $(id).addEventListener('input',()=>queueDraft());
  }
  for(const preset of document.querySelectorAll('.appearance-preset')){
   preset.addEventListener('click',()=>{
    $('brandPrimary').value=preset.dataset.primary;
    $('brandSecondary').value=preset.dataset.secondary;
    queueDraft();
   });
  }
  for(const id of ['appearanceCorners','appearancePreviewTheme'])$(id).addEventListener('change',renderPreview);
  $('brandLogoFile').addEventListener('change',()=>{
   if(previewUrl)URL.revokeObjectURL(previewUrl);
   previewUrl=null;
   const file=$('brandLogoFile').files?.[0];
   if(file&&(!logoTypes[file.type]||file.size>1024*1024)){
    $('brandLogoFile').value='';
    renderPreview();
    setStatus('Use a PNG, JPG, or WebP logo no larger than 1 MB.');
    return;
   }
   if(file){
    removeLogo=false;
    previewUrl=URL.createObjectURL(file);
   }
   queueDraft();
  });
  $('brandRemoveLogo').addEventListener('click',()=>{
   clearLogoFile();
   removeLogo=true;
   queueDraft('Default logo previewed. Save shared branding to publish.');
  });
  $('brandReset').addEventListener('click',()=>{
   clearLogoFile();
   removeLogo=true;
   writeFields(DEFAULT);
   queueDraft('Default branding previewed. Save shared branding to publish.');
  });
  $('brandDiscard').addEventListener('click',()=>{
   resetDraft();
   setStatus('Unsaved branding changes discarded.');
   $('brandAppName').focus();
  });
  void refresh();
 }
 window.LibraryBranding={init,setContext,refresh,apply};
})();
