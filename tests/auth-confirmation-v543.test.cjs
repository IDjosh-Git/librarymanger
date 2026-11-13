'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const authErrMatch=html.match(/function authError\(e\)\{[\s\S]*?\n\}/);
assert.ok(authErrMatch,'authError must be present');
const errorContext={};
vm.createContext(errorContext);
vm.runInContext(`${authErrMatch[0]}; this.translate=authError`,errorContext);
test('Auth email provider errors produce actionable non-secret guidance',()=>{
 assert.match(errorContext.translate({code:'email_address_not_authorized',message:'Email address not authorized'}),/custom SMTP/);
 assert.match(errorContext.translate({code:'over_email_send_rate_limit',message:'email rate limit exceeded'}),/rate-limit/);
 assert.match(errorContext.translate({code:'email_not_confirmed',message:'Email not confirmed'}),/Resend confirmation email/);
 assert.equal(errorContext.translate({message:'Invalid login credentials'}),'Invalid login credentials');
});
test('existing registration gets safe guidance without exposing account existence',()=>{
 assert.match(html,/already-confirmed account will not receive another signup email/);
 assert.match(html,/If this is a new account/);
 assert.match(html,/if this address belongs to an account awaiting confirmation/i);
 assert.ok(!/No account exists for/.test(html));
});
test('resend control is available in signup mode and can recover an unconfirmed sign-in',()=>{
 assert.match(html,/\$\('resendConfirmation'\)\.hidden=!creating/);
 assert.match(html,/e\?\.code==="email_not_confirmed"/);
 assert.match(html,/let resendConfirmationBusy=false,lastConfirmationRequest=0/);
 assert.match(html,/lastConfirmationRequest\+60000-Date\.now\(\)/);
});
test('resend uses Supabase Auth, not a secret or client-controlled confirmation',()=>{
 assert.match(html,/sb\.auth\.resend\(\{type:"signup",email,options:authRedirectOptions\(\)\}\)/);
 assert.doesNotMatch(html,/admin\.updateUserById\(/);
 assert.doesNotMatch(html,/email_confirmed_at\s*=/);
});
