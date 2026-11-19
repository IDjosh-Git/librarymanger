const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const handler=html.match(/\$\('bookEditorForm'\)\.onsubmit=async e=>\{([\s\S]*?)\n\};/);
test('book editor save does not reference an undefined latest record',()=>{
 assert.ok(handler,'Save handler exists');
 assert.doesNotMatch(handler[1],/\blatest\./);
 assert.match(handler[1],/if\(old\.updated_at\)request=request\.eq\('updated_at',old\.updated_at\)/);
});
test('book editor save verifies a returned row before reporting success',()=>{
 assert.match(handler[1],/if\(!data\)throw Error/);
 assert.match(handler[1],/if\(!patch\.title\)/);
 assert.match(handler[1],/finally\{btn\.disabled=false/);
});
