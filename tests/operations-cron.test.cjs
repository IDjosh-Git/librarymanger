const test=require('node:test');const assert=require('node:assert/strict');const handler=require('../api/operations-cron');
test('cron requires valid authorization',async()=>{const req={method:'GET',headers:{authorization:'Bearer bad'}};let code,body;const res={status(n){code=n;return this},json(x){body=x;return this}};await handler(req,res);assert.equal(code,401);assert.equal(body.error,'Unauthorized')});
test('cron rejects unsupported methods',async()=>{let code;await handler({method:'POST',headers:{}},{status(n){code=n;return this},json(){return this}});assert.equal(code,405)});
