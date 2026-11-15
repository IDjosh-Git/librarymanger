/* Shared library branding. The database is the source of truth; browser defaults are fallbacks. */
(()=>{'use strict';
 const DEFAULT={app_name:'Library Manager',primary_color:'#144e58',secondary_color:'#1d727a',button_style:'gradient',logo_url:null};
 const $=id=>document.getElementById(id);
 const validHex=v=>/^#[0-9a-fA-F]{6}$/.test(String(v||''));
 const safeName=v=>String(v||'').trim().slice(0,70);
 const safeLogo=v=>typeof v==='string'&&/^https:\/\//i.test(v)?v:null;
 const state={...DEFAULT};let client=null,session=null,role=null,ready=false,saveRevision=0;let published={...DEFAULT};
 function apply(v){Object.assign(state,DEFAULT,v||{});const root=document.documentElement;
 const a=validHex(state.primary_color)?state.primary_color:DEFAULT.primary_color,b=validHex(state.secondary_color)?state.secondary_color:DEFAULT.secondary_color;
 root.style.setProperty('--library-primary',a);root.style.setProperty('--library-secondary',b);
 // Derive the visual system from the saved palette; fixed values below are only initial fallbacks.
 const hexRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
 const toHex=arr=>'#'+arr.map(n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0')).join('');
 const blend=(c,d,weight)=>toHex(hexRgb(c).map((v,i)=>v*(1-weight)+hexRgb(d)[i]*weight));
 const luminance=h=>hexRgb(h).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const contrast=(x,y)=>{const a=luminance(x),b=luminance(y);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
 const ink=h=>contrast(h,'#ffffff')>=4.5?'#ffffff':'#10212b';
 const onGradient=contrast(a,'#ffffff')>=4.5&&contrast(b,'#ffffff')>=4.5?'#ffffff':contrast(a,'#10212b')>=4.5&&contrast(b,'#10212b')>=4.5?'#10212b':ink(a);
 const dark=root.dataset.theme==='dark';
 const surface=dark?'#182b3b':'#ffffff';
 const tint=blend(b,surface,dark?.20:.10);
 const soft=blend(a,surface,dark?.24:.08);
 const border=blend(a,surface,dark?.44:.25);
 const hover=blend(a,dark?'#ffffff':'#000000',dark?.18:.13);
 const semantic={
 '--app-brand':a,'--app-brand-secondary':b,'--app-brand-hover':hover,
 '--app-brand-soft':soft,'--app-brand-soft-strong':blend(a,surface,dark?.32:.16),
 '--app-brand-border':border,'--app-brand-gradient':`linear-gradient(125deg, ${a}, ${b})`,
 '--app-on-brand':ink(a),'--app-on-secondary':ink(b),'--app-on-gradient':onGradient,
 '--app-focus-ring':blend(b,surface,.45),'--app-brand-contrast':ink(a),
 '--library-action':state.button_style==='solid'?a:`linear-gradient(125deg, ${a}, ${b})`,
 '--library-action-text':state.button_style==='solid'?ink(a):onGradient,
 '--library-brand-ink':dark?blend(a,'#ffffff',.65):blend(a,'#000000',.25),
 '--library-brand-tint':tint,
 '--navy':a,'--navy2':b,'--navy3':blend(a,'#000000',.28),
 '--accent':a,'--accent2':b,'--ring':b,
 '--primary':a,'--primary-color':a,'--secondary':b,'--secondary-color':b,
 '--brand':a,'--brand2':b,'--brand-primary':a,'--brand-secondary':b,
 '--brand-hover':hover,'--brand-soft':soft,'--brand-border':border,
 '--brand-dark-gradient':`linear-gradient(125deg, ${a}, ${b})`
 };
 for(const [key,value] of Object.entries(semantic))root.style.setProperty(key,value);
 root.dataset.brandButtons=state.button_style==='solid'?'solid':'gradient';
 renderPreview(a,b);
 const name=safeName(state.app_name)||DEFAULT.app_name;
 document.querySelectorAll('[data-library-brand-name]').forEach(el=>el.textContent=name);
 document.querySelectorAll('[data-library-brand-logo]').forEach(img=>{img.src=safeLogo(state.logo_url)||'assets/book-logo.svg';});
 document.title=name+' | Library Workspace';
 const field=$('brandAppName');if(field&&document.activeElement!==field)field.value=name;
 for(const [id,color] of [['brandPrimary',a],['brandSecondary',b]]){const el=$(id);if(el&&document.activeElement!==el)el.value=color;}
 const mode=$('brandButtonStyle');if(mode)mode.value=root.dataset.brandButtons;
 }
 async function refresh(){if(!client)return;const revision=saveRevision;const {data,error}=await client.from('library_app_settings').select('app_name,primary_color,secondary_color,button_style,logo_url').eq('id',1).maybeSingle();if(!error&&data){if(revision!==saveRevision)return;published={...DEFAULT,...data};apply(data);ready=true;}else if(error){const s=$('brandStatus');if(s&&role==='admin')s.textContent='Shared branding is unavailable. Apply database migration 13 to enable it.';}}
 function setContext(s,r){const changed=session?.user?.id!==s?.user?.id||role!==r;session=s;role=r;if(changed)void refresh();}
 async function save(e){e.preventDefault();if(role!=='admin'||!session?.user){$('brandStatus').textContent='Administrator access required.';return;}
 const name=safeName($('brandAppName').value),primary=$('brandPrimary').value,secondary=$('brandSecondary').value,style=$('brandButtonStyle').value;
 if(!name||!validHex(primary)||!validHex(secondary)||!['solid','gradient'].includes(style)){$('brandStatus').textContent='Enter a name and valid colors.';return;}
 const btn=$('brandSave');btn.disabled=true;$('brandStatus').textContent='Saving shared branding…';
 try{let logo=state.logo_url;const file=$('brandLogoFile').files?.[0];
 if(file){if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1024*1024)throw Error('Logo must be PNG, JPG, or WebP and no larger than 1 MB.');
 const ext=({'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/svg+xml':'svg'})[file.type];
 const path='branding/library-logo-'+Date.now()+'.'+ext;
 const uploaded=await client.storage.from('library-branding').upload(path,file,{contentType:file.type,upsert:false});if(uploaded.error)throw uploaded.error;
 logo=client.storage.from('library-branding').getPublicUrl(path).data.publicUrl;
 }
 const payload={app_name:name,primary_color:primary,secondary_color:secondary,button_style:style,logo_url:logo};
 const {data:saved,error}=await client.from('library_app_settings').update(payload).eq('id',1).select('app_name,primary_color,secondary_color,button_style,logo_url').single();if(error)throw error;
 if(!saved||saved.primary_color.toLowerCase()!==primary.toLowerCase()||saved.secondary_color.toLowerCase()!==secondary.toLowerCase()||saved.button_style!==style)throw Error('Saved settings could not be verified.');
 saveRevision++;published={...DEFAULT,...saved};apply(saved);$('brandLogoFile').value='';$('brandStatus').textContent='Appearance saved and applied across the app.';
 }catch(err){$('brandStatus').textContent='Unable to save: '+(err.message||String(err));}finally{btn.disabled=false;}}
 function renderPreview(a,b){const el=$('appearancePreview');if(!el)return;el.style.setProperty('--preview-primary',a);el.style.setProperty('--preview-secondary',b);const corners=$('appearanceCorners')?.value||'rounded';el.dataset.corners=corners;el.dataset.buttonStyle=state.button_style;const white='#ffffff',dark='#10212b';const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);const lum=h=>rgb(h).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);const ratio=(x,y)=>{const u=lum(x),v=lum(y);return (Math.max(u,v)+.05)/(Math.min(u,v)+.05);};const w=Math.min(ratio(a,white),ratio(b,white)),d=Math.min(ratio(a,dark),ratio(b,dark));const on=w>=4.5?white:dark;el.style.setProperty('--preview-on-brand',on);const contrast=$('appearanceContrast');if(contrast){contrast.textContent=Math.max(w,d)>=4.5?'Contrast check: selected palette supports readable button text.':'Contrast warning: gradient endpoints may need separate text colours; consider a darker or lighter pairing.';contrast.dataset.warning=Math.max(w,d)<4.5?'true':'false';}}
 function previewForm(){const primary=$('brandPrimary')?.value,secondary=$('brandSecondary')?.value,style=$('brandButtonStyle')?.value;if(!validHex(primary)||!validHex(secondary))return;apply({...state,primary_color:primary,secondary_color:secondary,button_style:style});$('brandStatus').textContent='Preview only — select Save shared branding to publish.';}
 function init(sb){client=sb;apply(DEFAULT);new MutationObserver(records=>{if(records.some(r=>r.attributeName==='data-theme'))apply(state);}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});$('brandForm')?.addEventListener('submit',save);
 $('brandReset')?.addEventListener('click',()=>{saveRevision++;apply(DEFAULT);$('brandStatus').textContent='Default values previewed. Select Save to publish them.';});
 for(const id of ['brandPrimary','brandSecondary','brandButtonStyle'])$(id)?.addEventListener('input',previewForm);
 document.querySelectorAll('.appearance-preset').forEach(btn=>btn.addEventListener('click',()=>{$('brandPrimary').value=btn.dataset.primary;$('brandSecondary').value=btn.dataset.secondary;previewForm();}));
 $('appearanceCorners')?.addEventListener('change',()=>renderPreview($('brandPrimary').value,$('brandSecondary').value));
 $('appearancePreviewTheme')?.addEventListener('change',()=>{$('appearancePreview').dataset.previewTheme=$('appearancePreviewTheme').value;});
 $('brandRemoveLogo')?.addEventListener('click',async()=>{if(role!=='admin')return;const {error}=await client.from('library_app_settings').update({logo_url:null}).eq('id',1);if(error){$('brandStatus').textContent=error.message;return;}apply({...state,logo_url:null});$('brandStatus').textContent='Default logo restored.';});
 void refresh();}
 window.LibraryBranding={init,setContext,refresh,apply};
})();
