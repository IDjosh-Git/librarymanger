'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pages=['index.html','reading-guide.html','book-of-the-week.html'];
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
test('all HTML pages load the current shared theme after their base stylesheet',()=>{
 for(const page of pages){
  const html=read(page);
  const theme=html.indexOf('assets/library-theme-rc62.css?v=rc65');
  assert.ok(theme>=0,`${page}: shared theme missing`);
  const base=[...html.matchAll(/assets\/(?:library-manager-v542|reading-v542|book-of-week-v542)\.css\?v=rc65/g)].map(x=>x.index);
  assert.ok(base.length&&base.every(i=>i<theme),`${page}: theme must follow base CSS`);
  assert.ok(html.includes('assets/library-theme-rc65-contrast.css?v=rc66'),`${page}: contrast fixes missing`);
  assert.ok(html.includes('assets/library-theme-rc68-ai-layout.css?v=rc68'),`${page}: RC68 AI layout missing`);
  assert.ok(html.includes('assets/library-theme-rc67-navigation-ai.css?v=rc67'),`${page}: RC67 refinements missing`);
  assert.ok(html.includes('assets/library-theme-rc66-unified.css?v=rc66'),`${page}: unified header and hero theme missing`);
  assert.ok(!html.includes('<head>\\n'),`${page}: literal newline escape in head`);
 }
});
test('referenced local script, stylesheet and image paths exist',()=>{
 for(const page of pages){
  const html=read(page);
  for(const match of html.matchAll(/(?:src|href)\s*=\s*["'](assets\/[^"']+)["']/g)){
   const asset=match[1].split('?')[0].split('#')[0];
   assert.ok(fs.existsSync(path.join(root,asset)),`${page}: missing ${asset}`);
  }
 }
});
test('service worker uses RC72 caches and precaches shared theme',()=>{
 const sw=read('sw.js');
 assert.match(sw,/lm-app-shell-rc75/);
 assert.match(sw,/lm-libraries-rc75/);
 assert.match(sw,/\/assets\/library-theme-rc62\.css\?v=rc66/);
 assert.doesNotMatch(sw,/\?v=rc59|lm-app-shell-v59/);
 for(const m of sw.matchAll(/['"](\/assets\/[^'"?#]+)(?:\?[^'"]+)?['"]/g)){
  assert.ok(fs.existsSync(path.join(root,m[1].slice(1))),`missing precache ${m[1]}`);
 }
});
test('release metadata is current',()=>assert.equal(JSON.parse(read('package.json')).version,'6.0.0-rc75'));

test('responsive stylesheet is loaded last on every page and cached',()=>{
 for(const page of pages){const html=read(page);const a=html.indexOf('assets/library-theme-rc68-ai-layout.css?v=rc68');const b=html.indexOf('assets/library-theme-rc69-responsive.css?v=rc69');assert.ok(b>a,`${page}: responsive stylesheet must follow RC68`)}
 assert.ok(read('sw.js').includes('/assets/library-theme-rc69-responsive.css?v=rc69'));
});

test('RC70 notification hero fix loads after responsive styles and is scoped',()=>{
 const css=read('assets/library-theme-rc70-notification-hero.css');
 assert.match(css,/#notifications \.notification-hero/);
 for(const page of pages){const html=read(page);assert.ok(html.indexOf('library-theme-rc70-notification-hero.css?v=rc70')>html.indexOf('library-theme-rc69-responsive.css?v=rc69'));}
 assert.ok(read('sw.js').includes('/assets/library-theme-rc70-notification-hero.css?v=rc70'));
});

test('RC71 AI icon contrast and SVG controls are included',()=>{
 const js=read('assets/book-guide.js'),css=read('assets/library-theme-rc71-ai-icons.css'),html=read('index.html');
 assert.match(js,/book-guide-icon-closed/);assert.match(js,/book-guide-icon-open/);
 assert.match(css,/#144E58/);assert.match(css,/:focus-visible/);
 assert.ok(html.indexOf('library-theme-rc71-ai-icons.css?v=rc71')>html.indexOf('library-theme-rc70-notification-hero.css?v=rc70'));
 assert.ok(read('sw.js').includes('/assets/library-theme-rc71-ai-icons.css?v=rc71'));
});

test('RC72 contrast tokens, paired surfaces and SVG colors on all pages',()=>{
 const css=read('assets/library-theme-rc72-ai-contrast.css');
 for(const token of ['--ai-fg','--ai-bg','--ai-surface','--ai-border']) assert.ok(css.includes(token));
 assert.match(css,/:root\[data-theme="dark"\] \.book-guide-root/);
 assert.match(css,/stroke:currentColor!important/);
 for(const page of pages) assert.ok(read(page).includes('assets/library-theme-rc72-ai-contrast.css?v=rc72'));
 assert.ok(read('sw.js').includes('/assets/library-theme-rc72-ai-contrast.css?v=rc72'));
});

test('RC73 premium header, wider panel and sidebar icon layer are loaded and cached',()=>{
 const css=read('assets/library-theme-rc73-ai-premium.css');
 for(const snippet of ['book-guide-panel','book-guide-head','book-guide-delete-chat','book-guide-thread-delete']) assert.ok(css.includes(snippet));
 for(const page of pages) assert.ok(read(page).includes('assets/library-theme-rc73-ai-premium.css?v=rc73'));
 assert.ok(read('sw.js').includes('/assets/library-theme-rc73-ai-premium.css?v=rc73'));
 assert.match(read('assets/book-guide.js'),/book-guide-delete-chat/);
 assert.match(read('assets/book-guide.js'),/book-guide-thread-delete/);
});


test('RC74 collapse releases sidebar width and lets chat flex',()=>{
 const css=read('assets/library-theme-rc74-ai-sidebar-collapse.css');
 assert.match(css, /:not\(\.sidebar-open\) \.book-guide-sidebar/);
 assert.match(css, /flex-basis:0px!important/);
 assert.match(css, /\.book-guide-chat-main/);
 for(const page of pages) assert.ok(read(page).includes('assets/library-theme-rc74-ai-sidebar-collapse.css?v=rc74'));
 assert.ok(read('sw.js').includes('/assets/library-theme-rc74-ai-sidebar-collapse.css?v=rc74'));
});


test('RC75 Library AI composer remains one-row height across themes',()=>{
 const css=read('assets/library-theme-rc75-ai-compact-compose.css');
 assert.match(css,/height:54px!important/);
 assert.match(css,/textarea#bookGuideInput/);
 assert.match(css,/height:26px!important/);
 assert.match(read('assets/book-guide.js'),/box\.style\.height='26px'/);
 for(const page of pages) assert.ok(read(page).includes('assets/library-theme-rc75-ai-compact-compose.css?v=rc75'));
 assert.ok(read('sw.js').includes('/assets/library-theme-rc75-ai-compact-compose.css?v=rc75'));
});
