'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=f=>fs.readFileSync(require('node:path').join(__dirname,'..',f),'utf8');
const app=read('index.html'),book=read('book-of-the-week.html'),contact=read('assets/public-contact.js');
test('public and staff entry points coexist with original auth controls',()=>{
 for(const id of ['uxStaffSignIn','showSignIn','showSignUp','signupAccessRole','signupInviteCode','accountForm'])assert.ok(app.includes(`id="${id}"`));
 assert.match(app,/class="ux-explore" href="book-of-the-week.html"/);
});
test('staff and reader labels do not change permission values',()=>{
 assert.match(app,/data-select-role="user"/);assert.match(app,/data-select-role="admin"/);
 assert.match(app,/<span>Reader<small>/);assert.match(app,/<span>Staff<small>/);
});
test('featured book reading guide remains the primary action',()=>{
 assert.ok(book.indexOf('class="spotlight-primary-cta"')<book.indexOf('id="askFeaturedBook"'));
});
test('contact links are hidden until published actionable contact details load',()=>{
 assert.match(app,/class="showcase-contact-link" hidden/);
 assert.match(book,/class="spotlight-contact-link" hidden/);
 assert.match(contact,/el\.hidden=!actionable/);
});
test('loan history stays tracking-only and existing controls remain',()=>{
 for(const id of ['loanPageSize','notificationSearch','reviewPendingCount','bookSearch','batchResults'])assert.ok(app.includes(`id="${id}"`));
});
