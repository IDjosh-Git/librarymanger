const test=require('node:test'),assert=require('node:assert/strict');
const {normalize,fromPoints,pixels}=require('../assets/isbn-crop.js');
test('crop bounds stay within the photo including reverse and outside drags',()=>{for(const b of [{x:2,y:-1,w:3,h:0},{x:.9,y:.9,w:1,h:1},fromPoints({x:.8,y:.7},{x:.2,y:.1})]){const r=normalize(b);assert.ok(r.x>=0&&r.y>=0&&r.w>0&&r.h>0);assert.ok(r.x+r.w<=1&&r.y+r.h<=1)}assert.deepEqual(fromPoints({x:.8,y:.7},{x:.2,y:.1}),{x:.2,y:.1,w:.6000000000000001,h:.6})});
test('crop maps displayed selection to original-resolution pixels',()=>{assert.deepEqual(pixels({x:.25,y:.5,w:.5,h:.25},4000,3000),{x:1000,y:1500,w:2000,h:750})});
