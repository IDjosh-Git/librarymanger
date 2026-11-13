'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const mainCSS=fs.readFileSync(path.join(root,'assets/library-manager-v542.css'),'utf8');
const weekCSS=fs.readFileSync(path.join(root,'assets/book-of-week-v542.css'),'utf8');
test('account and lookup settings remain present for Admin but are role-hidden from Members',()=>{
 assert.match(html,/<details class="account-tools">/);
 assert.match(html,/<details class="lookupbox">/);
 assert.match(html,/adminSettingsVisible=ready&&isAdmin\(\)/);
 assert.match(html,/querySelector\('\.account-tools'\)\.hidden=!adminSettingsVisible/);
 assert.match(html,/querySelector\('\.lookupbox'\)\.hidden=!adminSettingsVisible/);
 assert.match(mainCSS,/body:not\(\[data-role="admin"\]\) #accountCard :is\(\.account-tools,\.lookupbox\)/);
});
test('Member keeps sign out, while Admin keeps account menu and shared actions',()=>{
 assert.match(html,/id="memberAccountFooter"/);
 assert.match(html,/id="memberSignOut"/);
 assert.match(html,/id="mobileMemberSignOut"/);
 assert.match(html,/id="mobileAccountJump"/);
 assert.match(html,/id="signOut"/);
 assert.doesNotMatch(html,/id="activateAdminPanel"/);
 assert.match(html,/\$\('memberSignOut'\)\.addEventListener\('click'/);
 assert.match(html,/\$\('mobileMemberSignOut'\)\.addEventListener\('click'/);
});
test('dark contrast rules cover sidebar feature and public weekly editorial cards',()=>{
 assert.match(mainCSS,/:root\[data-theme="dark"\] body\[data-account="in"\] #accountCard \.workspace-nav \.workspace-spotlight-link/);
 assert.match(weekCSS,/:root\[data-theme="dark"\] body\[data-public-spotlight="true"\] :is\(\.weekly-reason,\.weekly-detail,\.weekly-edition-tag\)/);
 assert.match(weekCSS,/\.weekly-reason-label,\.weekly-detail-symbol/);
 assert.match(weekCSS,/\.spotlight-ribbon/);
});
