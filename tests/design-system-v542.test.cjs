'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file),'utf8');
const app = read('index.html');
const publicBook = read('book-of-the-week.html');
const publicGuide = read('reading-guide.html');
const cssFiles = fs.readdirSync(path.join(root,'assets')).filter((f) => f.endsWith('.css')).sort();
const appCss = read('assets/library-manager-v542.css');

test('all old CSS files are removed and only current standalone bundles remain', () => {
  assert.deepEqual(cssFiles, ['book-of-week-v542.css','library-manager-v542.css','reading-v542.css']);
  for (const [html,expected] of [[app,'library-manager-v542.css'],[publicBook,'book-of-week-v542.css'],[publicGuide,'reading-v542.css']]) {
    const refs = [...html.matchAll(/href="assets\/([^"?]+\.css)(?:\?[^" ]*)?"/g)].map((x) => x[1]);
    assert.deepEqual(refs,[expected]);
  }
});

test('consolidation keeps Scan, Review, recognition Settings and manual add UI', () => {
  for(const id of ['id="shelfScan"','id="review"','id="batchUseAI"','id="batchUseOCR"','id="addManual"','id="loggedIn"']){
    assert.ok(app.includes(id), `missing ${id}`);
  }
  for(const selector of ['#shelfScan','.scan-recognition-card','.workspace-nav','.workspace-spotlight-link','#accountCard']){
    assert.ok(appCss.includes(selector),`missing ${selector}`);
  }
});

test('single modern sidebar layer is last and respects comfortable desktop widths', () => {
  assert.match(appCss, /grid-template-columns:\s*minmax\(0, 312px\) minmax\(0, 1fr\) !important/);
  assert.match(appCss, /grid-template-columns:\s*minmax\(0, 284px\) minmax\(0, 1fr\) !important/);
  assert.match(appCss, /#accountCard\.auth \.workspace-nav \.workspace-nav-section button\.tab:is\(\.active/);
  assert.match(appCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.ok(appCss.lastIndexOf('Final-state nav emphasis')>appCss.indexOf('recognition-settings-v535.css'));
});

test('all page styles retain the current key components', () => {
  const bookCss=read('assets/book-of-week-v542.css');
  const guideCss=read('assets/reading-v542.css');
  assert.ok(bookCss.includes('data-connected="true"'));
  assert.ok(guideCss.includes('reading-guide'));
  assert.ok(appCss.includes('daily-visit-register.css'));
});
