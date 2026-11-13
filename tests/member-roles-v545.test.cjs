'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sql=fs.readFileSync(path.join(root,'database','11_library_self_healing_role_resolution.sql'),'utf8');
function extract(start,end){const i=html.indexOf(start); assert.ok(i>=0,start+' exists'); const j=html.indexOf(end,i);assert.ok(j>i,end+' exists');return html.slice(i,j)}
const signup=extract('async function signUp(){','let resendConfirmationBusy=false');
const resolver=extract('async function lookupVerifiedMemberRole(uid){','async function ensureMemberRole(){');
const ensure=extract('async function ensureMemberRole(){','function setAuthMode(mode){');
const roleUI=extract('function setAuthMode(mode){','function readPendingAdminAccess(){');

function signupContext(role,code=''){
 const calls=[],events=[];
 const nodes={email:{value:'reader@example.com',checkValidity:()=>true},password:{value:'validpassword456'},confirmPassword:{value:'validpassword456'},signupAccessRole:{value:role},signupInviteCode:{value:code},authSubmit:{disabled:false},resendConfirmation:{hidden:true},authEmailHelp:{hidden:true}};
 const ctx={authBusy:false,$:id=>nodes[id],sb:{auth:{signUp:async args=>{calls.push(args);return {data:{user:{id:'user-id'},session:null},error:null}}}},authRedirectOptions:()=>({emailRedirectTo:'https://books.example/app'}),msg:(text,kind)=>events.push([text,kind]),authError:e=>e.message,readPendingAdminInvite:()=>null,savePendingAdminAccess:(...args)=>events.push(['saved-admin-code',args]),savePendingAdminInvite:()=>events.push(['saved-admin-invite']),clearPendingAdminAccess:()=>events.push(['cleared-code']),clearPendingAdminInvite:()=>events.push(['cleared-invite']),session:null,authUI:()=>{},reloadAll:async()=>{},memberRole:null,isAdmin:()=>false};
 vm.createContext(ctx);vm.runInContext(signup+'\nthis.signUp=signUp',ctx);
 return {ctx,calls,events,nodes};
}

test('original User and Admin registration choices are restored, and User is the default',()=>{
 assert.match(html,/id="accessRoleControl"/);
 assert.match(html,/data-select-role="user"/);
 assert.match(html,/data-select-role="admin"/);
 assert.match(html,/<option value="user">/);
 assert.match(html,/id="signupAdminInvite"[^>]*hidden/);
 assert.match(roleUI,/\$\('accessRoleControl'\)\.hidden=!creating/);
 assert.match(roleUI,/\$\('signupInviteCode'\)\.required=admin&&authMode==='signup'/);
 assert.match(roleUI,/if\(!admin\)clearPendingAdminAccess\(\)/);
});
test('ordinary User can register without an access code or privileged role metadata',async()=>{
 const {ctx,calls,events}=signupContext('user');await ctx.signUp();
 assert.equal(calls.length,1);assert.equal(calls[0].email,'reader@example.com');
 assert.deepEqual(Object.keys(calls[0]).sort(),['email','options','password']);
 assert.equal(events.some(x=>x[0]==='cleared-code'),true);
 assert.equal(events.some(x=>x[0]==='saved-admin-code'),false);
 assert.match(events.at(-1)[0],/check|confirmation|sign in/i);
});
test('Admin registration refuses to proceed without a private code',async()=>{
 const {ctx,calls,events}=signupContext('admin');await ctx.signUp();
 assert.equal(calls.length,0);assert.match(events.at(-1)[0],/administrator access code/i);
});
test('Admin signup stores code only for later server-side verification; does not grant client role',async()=>{
 const {ctx,calls,events}=signupContext('admin','limited-admin-code');await ctx.signUp();
 assert.equal(calls.length,1);assert.deepEqual(Object.keys(calls[0]).sort(),['email','options','password']);
 const save=events.find(x=>x[0]==='saved-admin-code');assert.ok(save);assert.equal(save[1][1],'limited-admin-code');
 assert.match(events.at(-1)[0],/after confirmation/i);
});

test('role resolver calls an authenticated-only RPC; never relies on .single()',async()=>{
 const calls=[];const ctx={sb:{rpc:async name=>{calls.push(name);return {data:'user',error:null}}},console};
 vm.createContext(ctx);vm.runInContext(resolver+'\nthis.run=lookupVerifiedMemberRole',ctx);
 assert.equal(await ctx.run('member-uuid'),'user');assert.deepEqual(calls,['library_resolve_my_role']);
 assert.doesNotMatch(resolver,/\.single\(/);
});
test('role resolver preserves an Admin role',async()=>{
 const ctx={sb:{rpc:async()=>({data:'admin',error:null})}};vm.createContext(ctx);vm.runInContext(resolver+'\nthis.run=lookupVerifiedMemberRole',ctx);
 assert.equal(await ctx.run('admin-uuid'),'admin');
});
test('on an older server, maybeSingle reads an existing role without failing on a missing row',async()=>{
 const calls=[];
 const ctx={sb:{rpc:async()=>({error:{code:'PGRST202',message:'missing function'}}),from:table=>{calls.push(['table',table]);return {select:()=>({eq:()=>({maybeSingle:async()=>({data:{role:'user'},error:null})})})}}}};
 vm.createContext(ctx);vm.runInContext(resolver+'\nthis.run=lookupVerifiedMemberRole',ctx);
 assert.equal(await ctx.run('own-uuid'),'user');assert.equal(calls[0][1],'library_member_roles');
});
test('missing account role without recovery migration produces an actionable error, not a JSON coercion failure',async()=>{
 const ctx={sb:{rpc:async()=>({error:{code:'PGRST202',message:'missing function'}}),from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})})}};
 vm.createContext(ctx);vm.runInContext(resolver+'\nthis.run=lookupVerifiedMemberRole',ctx);
 await assert.rejects(ctx.run('own-uuid'),/recovery upgrade is not installed/i);
});
test('role lookups repair a missing member assignment before applying any Admin code',()=>{
 assert.ok(ensure.indexOf('let verifiedRole=await lookupVerifiedMemberRole(uid)') < ensure.indexOf('await redeemPendingAdminInvite(uid)'));
 assert.match(ensure,/if\(invited\|\|promoted\)verifiedRole=await lookupVerifiedMemberRole\(uid\)/);
 assert.match(ensure,/generation!==authGeneration/);
 assert.match(ensure,/Unable to load account permissions/);
 assert.match(html,/id="roleGateRetry"/);
});
test('self-healing SQL permits only signed-in self-role and preserves Admin',()=>{
 assert.match(sql,/current_user_id uuid := \(select auth\.uid\(\)\)/);
 assert.match(sql,/where u\.id = current_user_id/);
 assert.match(sql,/on conflict \(user_id\) do nothing/i);
 assert.match(sql,/where r\.user_id = current_user_id/);
 assert.match(sql,/revoke all on function public\.library_resolve_my_role\(\) from public, anon/i);
 assert.match(sql,/grant execute on function public\.library_resolve_my_role\(\) to authenticated/i);
 assert.doesNotMatch(sql,/update\s+public\.library_member_roles/i);
});
