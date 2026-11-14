/* Shared library branding. The database is the source of truth; browser defaults are fallbacks. */
(()=>{'use strict';
 const DEFAULT={app_name:'Library Manager',primary_color:'#144e58',secondary_color:'#1d727a',button_style:'gradient',logo_url:null};
 const $=id=>document.getElementById(id);
 const validHex=v=>/^#[0-9a-fA-F]{6}$/.test(String(v||''));
 const safeName=v=>String(v||'').trim().slice(0,70);
 const safeLogo=v=>typeof v==='string'&&/^https:\/\//i.test(v)?v:null;
 const state={...DEFAULT};let client=null,session=null,role=null,ready=false;
 function apply(v){Object.assign(state,DEFAULT,v||{});const root=document.documentElement;
 const a=validHex(state.primary_color)?state.primary_color:DEFAULT.primary_color,b=validHex(state.secondary_color)?state.secondary_color:DEFAULT.secondary_color;
 root.style.setProperty('--library-primary',a);root.style.setProperty('--library-secondary',b);
 root.dataset.brandButtons=state.button_style==='solid'?'solid':'gradient';
 const name=safeName(state.app_name)||DEFAULT.app_name;
 document.querySelectorAll('[data-library-brand-name]').forEach(el=>el.textContent=name);
 document.querySelectorAll('[data-library-brand-logo]').forEach(img=>{img.src=safeLogo(state.logo_url)||'assets/book-logo.svg';});
 document.title=name+' | Library Workspace';
 const field=$('brandAppName');if(field&&document.activeElement!==field)field.value=name;
 for(const [id,color] of [['brandPrimary',a],['brandSecondary',b]]){const el=$(id);if(el&&document.activeElement!==el)el.value=color;}
 const mode=$('brandButtonStyle');if(mode)mode.value=root.dataset.brandButtons;
 }
 async function refresh(){if(!client)return;const {data,error}=await client.from('library_app_settings').select('app_name,primary_color,secondary_color,button_style,logo_url').eq('id',1).maybeSingle();if(!error&&data){apply(data);ready=true;}else if(error){const s=$('brandStatus');if(s&&role==='admin')s.textContent='Shared branding is unavailable. Apply database migration 13 to enable it.';}}
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
 const payload={id:1,app_name:name,primary_color:primary,secondary_color:secondary,button_style:style,logo_url:logo};
 const {error}=await client.from('library_app_settings').upsert(payload,{onConflict:'id'});if(error)throw error;
 apply(payload);$('brandLogoFile').value='';$('brandStatus').textContent='Branding saved for all users.';
 }catch(err){$('brandStatus').textContent='Unable to save: '+(err.message||String(err));}finally{btn.disabled=false;}}
 function init(sb){client=sb;apply(DEFAULT);$('brandForm')?.addEventListener('submit',save);
 $('brandReset')?.addEventListener('click',()=>{apply(DEFAULT);$('brandStatus').textContent='Default values loaded. Select Save to publish them.';});
 $('brandRemoveLogo')?.addEventListener('click',async()=>{if(role!=='admin')return;const {error}=await client.from('library_app_settings').update({logo_url:null}).eq('id',1);if(error){$('brandStatus').textContent=error.message;return;}apply({...state,logo_url:null});$('brandStatus').textContent='Default logo restored.';});
 void refresh();}
 window.LibraryBranding={init,setContext,refresh,apply};
})();
