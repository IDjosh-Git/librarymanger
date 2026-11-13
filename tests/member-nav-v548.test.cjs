'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/library-manager-v542.css'),'utf8');

test('Member navigation retains only sign-out; old admin activation panel is entirely removed',()=>{
  const memberFooter=html.match(/<div id="memberAccountFooter"[\s\S]*?<\/div>/)?.[0]||'';
  assert.match(memberFooter,/id="memberSignOut"/);
  assert.doesNotMatch(html,/id="activateAdminPanel"|id="existingAdminInviteCode"|id="activateAdminInvite"|Activate admin access/i);
  assert.doesNotMatch(html,/function activateAdminInvite\(|\$\('activateAdminPanel'\)/);
  assert.match(html,/\$\('memberAccountFooter'\)\.hidden=!ready\|\|isAdmin\(\)/);
  assert.match(html,/id="mobileMemberSignOut"/);
  assert.match(html,/\$\('mobileMemberSignOut'\)\.addEventListener\('click'/);
});

test('Admin enrollment and code generator are retained for verified administrators',()=>{
  assert.match(html,/id="signupAccessRole"/);
  assert.match(html,/data-select-role="admin"/);
  assert.match(html,/id="signupInviteCode"/);
  assert.match(html,/function createAdminInvite\(/);
  assert.match(html,/id="createAdminInvite"/);
  assert.match(html,/\$\('createAdminInvite'\)\.onclick=createAdminInvite/);
  assert.match(html,/sb\.rpc\('library_claim_admin_access_code'/);
  assert.match(html,/sb\.rpc\('library_redeem_admin_invite'/);
  assert.match(html,/if\(!session\?\.user\|\|!isAdmin\(\)\)return msg\('Only an existing administrator/);
});

test('No obsolete member-only activation styling remains',()=>{
  assert.doesNotMatch(css,/#accountCard \.admin-invite-panel\b/);
  assert.match(css,/body\[data-account="in"\]\[data-role="user"\] #accountCard \.member-signout-button/);
});
