'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function node(value = '') {
 const handlers = new Map();
 return {
  value, textContent:'', hidden:false, disabled:false, dataset:{}, attributes:{},
  style:new Map(), files:[], focus(){},
  setAttribute(name,value){this.attributes[name]=value;},
  addEventListener(name,listener){handlers.set(name,listener);},
  fire(name){return handlers.get(name)?.({preventDefault(){}});}
 };
}

function studio() {
 const ids = Object.fromEntries(('brandStatus brandAppName brandPrimary brandSecondary brandButtonStyle brandLogoFile '+
 'appearancePreview appearanceCorners appearancePreviewTheme appearancePreviewLogo appearancePreviewName appearanceContrast '+
 'brandDiscard brandFields brandForm brandRemoveLogo brandReset').split(' ').map(id=>[id,node()]));
 ids.appearanceCorners.value='rounded';
 const documentElement=node();
 for(const el of [documentElement,ids.appearancePreview])el.style.setProperty=el.style.set.bind(el.style);
 const brandLabel=node(), brandLogo=node(), preset=node();
 preset.dataset={primary:'#6246a5',secondary:'#9c79d6'};
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
  settings:{app_name:'Library One',primary_color:'#144e58',secondary_color:'#1d727a',
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
 const window={};
 let themeChanged;
 vm.runInNewContext(read('assets/library-branding.js'),{
  window,document,
  URL:{createObjectURL:()=> 'blob:preview',revokeObjectURL(){}},
  MutationObserver:class {constructor(callback){themeChanged=callback;}observe(){}}
 });
 const controller=window.LibraryBranding;
 const admin={user:{id:'owner'}};
 return {ids,documentElement,brandLabel,brandLogo,preset,server,controller,admin,sb,themeChanged:()=>themeChanged()};
}

test('branding controls start after the deferred script and lookup uses a native disclosure',()=>{
 const html=read('index.html');
 assert.match(html,/<script defer src="assets\/library-branding.js\?v=rc77">/);
 assert.match(html,/document\.addEventListener\('DOMContentLoaded',\(\)=>\{\s*const activeRole=[^\n]+\n\s*window\.LibraryBranding\?\.init\(sb,activeRole\?session:null,activeRole\)/);
 assert.match(html,/<details class="lookupbox">\s*<summary class="lookuphead">[^\n]+sidebar-settings-chevron/);
 assert.match(read('assets/library-sidebar-rc77.css'),/\.lookupbox\)\[open\] > summary .*sidebar-settings-chevron::before/);
});

test('name, presets, surface style and preview theme stay local until saved',async()=>{
 const {ids,documentElement,brandLabel,preset,server,controller,admin,sb,themeChanged}=studio();
 controller.init(sb,admin,'admin');
 await tick();
 assert.equal(brandLabel.textContent,'Library One');
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
 assert.equal(brandLogo.src,'assets/book-logo.svg');
 controller.setContext({user:{id:'member'}},'user');
 assert.equal(ids.brandFields.disabled,true);
 await ids.brandForm.fire('submit');
 assert.equal(server.writes,2);
});
