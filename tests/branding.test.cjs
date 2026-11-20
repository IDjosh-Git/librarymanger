'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const luminance = color => [1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255)
 .map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4)
 .reduce((total,value,i)=>total+value*[.2126,.7152,.0722][i],0);
function ratio(a,b){
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}

function node(value = '') {
 const handlers = new Map();
 const style = new Map();
 style.removeProperty = key => style.delete(key);
 return {
  value, textContent:'', hidden:false, disabled:false, dataset:{}, attributes:{},
  style, files:[], focus(){},
  setAttribute(name,value){this.attributes[name]=value;},
  addEventListener(name,listener){handlers.set(name,listener);},
  fire(name){return handlers.get(name)?.({preventDefault(){}});}
 };
}

function studio({readOnly=false, storage=new Map()}={}) {
 const ids = Object.fromEntries(('brandStatus brandAppName brandPrimary brandSecondary brandContrast brandButtonStyle brandLogoFile '+
 'appearancePreview appearanceCorners appearancePreviewTheme appearancePreviewLogo appearancePreviewName appearanceContrast '+
 'brandDiscard brandFields brandForm brandRemoveLogo brandReset').split(' ').map(id=>[id,node()]));
 ids.appearanceCorners.value='rounded';
 const documentElement=node();
 if(readOnly){
  delete ids.brandForm;
  documentElement.dataset.libraryPageTitle='Reading Guide';
 }
 for(const el of [documentElement,ids.appearancePreview])el.style.setProperty=el.style.set.bind(el.style);
 const brandLabel=node(), brandLogo=node(), preset=node();
 preset.dataset={primary:'#6246a5',secondary:'#9c79d6',contrast:'#ece0ff'};
 const document={
  documentElement,
  getElementById:id=>ids[id],
  querySelectorAll:selector=>({
   '.appearance-preset':[preset],
   '[data-library-brand-name]':[brandLabel],
   '[data-library-brand-logo]':[brandLogo]
  })[selector]||[]
 };
 const server={
  settings:{app_name:'Library One',primary_color:'#144e58',secondary_color:'#1d727a',contrast_color:'#c7f5ec',
   button_style:'gradient',logo_url:'https://example.test/current.png'},
  writes:0, fail:false
 };
 const sb={
  from(){
   const query={
    select(){return query;},eq(){return query;},
    update(payload){query.payload=payload;server.writes++;return query;},
    async maybeSingle(){return {data:{...server.settings}};},
    async single(){
     if(server.fail)return {error:Error('Database unavailable')};
     server.settings={...query.payload};
     return {data:{...server.settings}};
    }
   };
   return query;
  }
 };
 const window={addEventListener(){}};
 let themeChanged;
 vm.runInNewContext(read('assets/library-branding.js'),{
  window,document,
  fetch:async()=>({ok:true,text:async()=>read('assets/book-logo.svg')}),
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  URL:{createObjectURL:()=> 'blob:preview',revokeObjectURL(){}},
  MutationObserver:class {constructor(callback){themeChanged=callback;}observe(){}}
 });
 const controller=window.LibraryBranding;
 const admin={user:{id:'owner'}};
 return {ids,documentElement,brandLabel,brandLogo,preset,server,controller,admin,sb,themeChanged:()=>themeChanged()};
}

test('branding controls start after the deferred script and lookup uses a native disclosure',()=>{
 const html=read('index.html');
 assert.match(html,/<script defer src="assets\/library-branding.js\?v=rc80">/);
 assert.match(html,/document\.addEventListener\('DOMContentLoaded',\(\)=>\{\s*const activeRole=[^\n]+\n\s*window\.LibraryBranding\?\.init\(sb,activeRole\?session:null,activeRole\)/);
 assert.match(html,/<details class="lookupbox">\s*<summary class="lookuphead">[^\n]+sidebar-settings-chevron/);
 assert.match(read('assets/library-sidebar-rc77.css'),/\.lookupbox\)\[open\] > summary .*sidebar-settings-chevron::before/);
});

test('shared branding CSS and the read-only loader are wired into both public pages',()=>{
 const css=read('assets/library-brand-rc78.css');
 for(const selector of ['.dashboard-hero','.spotlight-intro','.guide-hero','.book-guide-head','.workspace-nav-section']){
  assert(css.includes(selector),selector);
 }
 assert.match(css,/background:var\(--library-action\)!important/);
 assert.match(css,/color:var\(--library-action-text\)!important/);
 for(const page of ['book-of-the-week','reading-guide']){
  const html=read(page+'.html');
  assert(html.includes('data-library-brand-name'));
  assert(html.includes('data-library-brand-logo'));
  assert(html.includes('library-brand-rc78.css?v=rc82'));
  assert(html.includes('library-appearance-rc84.css?v=rc84'));
  assert(html.includes('library-appearance-rc85.css?v=rc85'));
  assert(html.indexOf('library-branding.js?v=rc80')<html.indexOf(page+'.js?v=rc78'));
  assert.match(read('assets/'+page+'.js'),/LibraryBranding\?\.init\(window\.supabase\?\.createClient/);
 }
});

test('dark-theme icons and labels receive readable foregrounds for extreme branding palettes',()=>{
 const {documentElement,controller}=studio();
 documentElement.dataset.theme='dark';
 const css=read('assets/library-brand-rc78.css');
 const html=read('index.html');
 assert.match(html,/:root\[data-theme="dark"\] body #accountCard \.premium-settings-card > summary \.premium-settings-emblem \{background:var\(--app-brand-secondary[^}]*color:var\(--app-on-secondary,/);
 assert.match(html,/premium-settings-emblem :is\(svg,\.app-icon\) \{color:inherit!important/);
 assert.match(css,/\.lookuphead-icon,\.sidebar-settings-chevron\s*\)\s*\{\s*background:var\(--app-brand-soft\)!important;\s*color:var\(--app-on-soft\)!important;/);
 assert.match(css,/\.bottomnav button.active[\s\S]*?color:var\(--library-action-text\)!important/);
 for(const color of ['#111014','#000000','#ffffff','#6543b0','#004002','#fbca00']){
  controller.apply({primary_color:color,secondary_color:'#8ab4f8',button_style:'solid'});
  const value=key=>documentElement.style.get(key);
  assert(ratio(value('--app-brand-secondary'),value('--app-on-secondary'))>=4.5,color+' secondary icon contrast');
  assert(ratio(value('--app-brand-soft'),value('--app-on-soft'))>=4.5,color);
  assert(ratio(value('--app-brand-soft-strong'),value('--app-on-soft-strong'))>=4.5,color);
  assert(ratio(value('--app-brand-soft'),value('--app-on-dark-layer'))>=4.5,
   color+' soft surface and dark-layer text/icon');
  assert(ratio(value('--app-brand-soft-strong'),value('--library-brand-ink'))>=4.5,
   color+' on '+value('--app-brand-soft-strong')+' with '+value('--library-brand-ink'));
  assert(ratio(value('--app-brand-soft-strong'),value('--app-on-dark-layer'))>=4.5,
   color+' elevated surface and dark-layer text/icon');
  assert(ratio(value('--library-action'),value('--library-action-text'))>=4.5,color);
  assert(ratio('#14212e',value('--app-on-dark-layer'))>=4.5,color+' dark-layer text/icon contrast');
  assert(ratio('#364354',value('--app-on-dark-layer'))>=4.5,color+' elevated dark-layer contrast');
 }
});

test('contrast colour is saved, previewed, and applied to dark-surface text and icons',async()=>{
 const {ids,documentElement,server,controller,admin,sb}=studio();
 controller.init(sb,admin,'admin');
 await tick();
 ids.brandContrast.value='#dbeafe';
 ids.brandContrast.fire('input');
 assert.equal(ids.appearancePreview.style.get('--preview-on-dark'),'#dbeafe');
 await ids.brandForm.fire('submit');
 assert.equal(server.settings.contrast_color,'#dbeafe');
 assert.equal(documentElement.style.get('--app-on-dark-layer'),'#dbeafe');
 assert.match(read('assets/library-appearance-rc84.css'),/--workspace-ink:var\(--app-on-dark-layer/);
 assert.match(read('supabase/migrations/20261120000000_add_contrast_color_to_library_app_settings.sql'),/add column if not exists contrast_color/);
});

test('default library logo colors follow the saved brand palette',async()=>{
 const {brandLogo,controller}=studio();
 controller.apply({primary_color:'#6246a5',secondary_color:'#9c79d6',contrast_color:'#ece0ff',logo_url:null});
 await tick();
 assert.match(brandLogo.src,/^data:image\/svg\+xml;charset=utf-8,/);
 const svg=decodeURIComponent(brandLogo.src.split(',')[1]);
 assert(svg.includes('stop-color="#6246a5"'));
 assert(svg.includes('stop-color="#9c79d6"'));
 assert(!svg.includes('stop-color="#144E58"'));
});

test('inventory table uses content-based columns and the shared theme tokens',()=>{
 const css=read('assets/library-appearance-rc84.css');
 assert.match(css,/#inventory #bookTable\.tablewrap:not\(\.grid-wrap\) table\s*\{[^}]*table-layout:auto!important/);
 assert.match(css,/#inventory #bookTable\.tablewrap:not\(\.grid-wrap\) :is\(th,td\)\s*\{[^}]*min-width:0!important/);
 assert.match(css,/#inventory #bookTable thead th\s*\{[^}]*background:var\(--app-brand-soft\)!important/);
 assert.match(css,/#inventory #bookTable tbody tr:hover > td\s*\{[^}]*background:var\(--app-brand-soft\)!important/);
 assert.match(css,/background:var\(--app-brand-soft,var\(--theme-surface-soft\)\)!important/);
 assert(read('index.html').includes('library-appearance-rc84.css?v=rc84'));
 assert(read('index.html').includes('library-appearance-rc85.css?v=rc85'));
 assert(read('sw.js').includes('/assets/library-appearance-rc84.css?v=rc84'));
 assert(read('sw.js').includes('/assets/library-appearance-rc85.css?v=rc85'));
 assert.match(css,/--workspace-ink:var\(--app-on-dark-layer/);
 const refinements=read('assets/library-appearance-rc85.css');
 assert.match(refinements,/#inventory \.book-card\s*\{\s*padding:14px!important/);
 assert.match(refinements,/book-card-actions \.card-primary\s*\{[^}]*color:var\(--app-on-dark-layer\)!important/);
});

test('review dark-mode states, fields and surfaces use explicit contrasting pairs',()=>{
 const css=read('assets/library-dark-rc81.css');
 const palette=new Map([...css.matchAll(/(--state-[a-z-]+):(#[\da-f]{6})/gi)].map(match=>match.slice(1)));
 for(const state of ['success','warning','error','info']){
  assert(ratio(palette.get('--state-'+state+'-bg'),palette.get('--state-'+state+'-ink'))>=4.5,state);
 }
 assert.match(css,/#libraryArea #review :is\(\s*\.review-editor-section,\.scan-title-review-card,[^}]+background:var\(--workspace-panel\)!important;\s*color:var\(--workspace-ink\)!important/);
 assert.match(css,/\.batch-book-field input[^}]+background:var\(--workspace-field\)!important;\s*color:var\(--workspace-ink\)!important/);
 assert.match(css,/\.review-save-feedback\[data-status="error"\][^}]+background:var\(--state-error-bg\)!important;color:var\(--state-error-ink\)!important/);
 for(const page of ['index','reading-guide','book-of-the-week']){
  const html=read(page+'.html');
  assert(html.indexOf('library-dark-rc81.css?v=rc81')>html.indexOf('library-brand-rc78.css?v=rc82'));
 }
});

test('legacy brand tokens inherit the custom palette and semantic status colors stay fixed',()=>{
 const css=read('assets/library-color-tokens.css');
 const names=section=>[...section.matchAll(/(--legacy-color-\d+):/g)].map(match=>match[1]);
 const palette=names(css.split('/* brand-or-info:')[1].split('/* status-success:')[0]);
 const statuses=names(css.split('/* status-success:')[1].split('/* RC57:')[0]);
 const dynamic=css.slice(css.indexOf(':root[data-brand-custom]'));
 const overrides=new Set(names(dynamic));
 assert(palette.length>1800);
 assert(statuses.length>400);
 assert.deepEqual(overrides,new Set(palette));
 assert(statuses.every(name=>!overrides.has(name)));
 assert.match(dynamic,/oklch\(from var\(--library-primary\)/);
 assert.match(dynamic,/oklch\(from var\(--library-secondary\)/);
 for(const page of ['index','reading-guide','book-of-the-week']){
  assert(read(page+'.html').includes('library-color-tokens.css?v=rc79'));
 }
 assert(read('sw.js').includes('/assets/library-color-tokens.css?v=rc79'));
});

test('reading pages load a published palette without requiring admin form controls',async()=>{
 const storage=new Map();
 const publicPage=studio({readOnly:true,storage});
 publicPage.server.settings={app_name:'Reading Library',primary_color:'#2548a0',secondary_color:'#5685d8',
  button_style:'gradient',logo_url:'https://example.test/reading.png'};
 publicPage.controller.init(publicPage.sb);
 await tick();
 assert.equal(publicPage.brandLabel.textContent,'Reading Library');
 assert.equal(publicPage.brandLogo.src,'https://example.test/reading.png');
 assert.equal(publicPage.documentElement.dataset.brandCustom,'');
 assert.match(publicPage.documentElement.style.get('--library-action'),/^linear-gradient/);
 assert.equal(publicPage.server.writes,0);
 const offline=studio({readOnly:true,storage});
 offline.controller.init(null);
 assert.equal(offline.brandLabel.textContent,'Reading Library');
 assert.equal(offline.brandLogo.src,'https://example.test/reading.png');
});

test('name, presets, surface style and preview theme stay local until saved',async()=>{
 const {ids,documentElement,brandLabel,preset,server,controller,admin,sb,themeChanged}=studio();
 controller.init(sb,admin,'admin');
 await tick();
 assert.equal(brandLabel.textContent,'Library One');
 assert(!('brandCustom' in documentElement.dataset));
 ids.brandAppName.value='New name';
 ids.brandAppName.fire('input');
 preset.fire('click');
 ids.brandButtonStyle.value='solid';
 ids.brandButtonStyle.fire('input');
 ids.appearancePreviewTheme.value='dark';
 ids.appearancePreviewTheme.fire('change');
 ids.appearanceCorners.value='soft';
 ids.appearanceCorners.fire('change');
 assert.equal(ids.appearancePreviewName.textContent,'New name');
 assert.equal(ids.appearancePreview.style.get('--preview-action'),'#6246a5');
 assert.equal(ids.appearancePreview.style.get('--preview-on-dark'),'#ece0ff');
 assert.equal(ids.appearancePreview.dataset.previewTheme,'dark');
 assert.equal(ids.appearancePreview.dataset.corners,'soft');
 assert.equal(preset.attributes['aria-pressed'],'true');
 assert.equal(brandLabel.textContent,'Library One');
 assert.equal(server.writes,0);
 await controller.refresh();
 assert.equal(ids.brandAppName.value,'New name');
 await ids.brandForm.fire('submit');
 assert.equal(brandLabel.textContent,'New name');
 assert.equal(server.settings.primary_color,'#6246a5');
 assert.equal(server.settings.contrast_color,'#ece0ff');
 assert.equal(documentElement.dataset.brandCustom,'');
 assert.equal(server.writes,1);
 documentElement.dataset.theme='dark';
 themeChanged();
 assert.equal(brandLabel.textContent,'New name');
 assert.equal(documentElement.style.get('--library-action'),'#6246a5');
});

test('logo removal is staged, failed saves retain drafts, and members cannot publish',async()=>{
 const {ids,brandLogo,server,controller,admin,sb}=studio();
 controller.init(sb,admin,'admin');
 await tick();
 const previous=brandLogo.src;
 ids.brandRemoveLogo.fire('click');
 assert.equal(brandLogo.src,previous);
 assert.equal(ids.appearancePreviewLogo.src,'assets/book-logo.svg');
 ids.brandDiscard.fire('click');
 assert.equal(ids.appearancePreviewLogo.src,previous);
 ids.brandRemoveLogo.fire('click');
 server.fail=true;
 await ids.brandForm.fire('submit');
 assert.match(ids.brandStatus.textContent,/Unable to save/);
 assert.equal(brandLogo.src,previous);
 assert.equal(ids.brandDiscard.hidden,false);
 server.fail=false;
 await ids.brandForm.fire('submit');
 assert.equal(server.settings.logo_url,null);
 assert.match(brandLogo.src,/^data:image\/svg\+xml;charset=utf-8,/);
 controller.setContext({user:{id:'member'}},'user');
 assert.equal(ids.brandFields.disabled,true);
 await ids.brandForm.fire('submit');
 assert.equal(server.writes,2);
});
