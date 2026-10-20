// Run with Playwright installed and TEST_BROWSER_PATH pointing to a Chromium browser.
// All network requests are blocked; saves use the existing in-memory Supabase mock.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_BROWSER_PATH});
 try{
 const page=await browser.newPage({viewport:{width:1200,height:850}}),issues=[],dialogs=[];
 page.on('pageerror',e=>issues.push(e.message));
 let accept=true;
 page.on('dialog',async d=>{dialogs.push(d.message());await (accept?d.accept():d.dismiss())});
 await page.route('**/*',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 const mock=fs.readFileSync(path.join(__dirname,'test_circulation.py'),'utf8').split("MOCK = r'''")[1].split("'''" )[0]
 .replace('BOOKS_LITERAL',JSON.stringify([{record_id:'original',barcode:'9780140328721',title:'Matilda',shelf_location:'Shelf A',book_status:'Available',user_id:'u-test'}])).replace('LOANS_LITERAL','[]');
 await page.evaluate(mock);
 let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/\r\n/g,'\n');
 html=html.replace(/<script src="(assets\/[^"]+)"><\/script>/g,(_,file)=>'<script>'+fs.readFileSync(path.join(root,file),'utf8')+'</script>');
 html=html.replace('})();\n</script>','window.__seed=rows=>{batchItems=rows;renderBatch()};window.__rows=()=>batchItems;window.__cropTest=()=>{decodeBatchBarcode=async file=>{const image=await createImageBitmap(file);window.__cropSize=[image.width,image.height];image.close();return "9780140328721"};lookupISBN=async()=>({title:"Matilda",_sources:["test"]})};})();\n</script>');
 await page.setContent(html,{waitUntil:'domcontentloaded'});
 await page.addStyleTag({content:fs.readFileSync(path.join(root,'assets/app.css'),'utf8')});
 await page.waitForFunction(()=>document.getElementById('totalBooks').textContent==='1');
 await page.locator('[data-tab="inventory"]').click();
 await page.evaluate(()=>window.__seed([
 {saveRecordId:'copy-a',fileName:'a.jpg',title:'Matilda',barcode:'9780140328721',shelf:'Shelf A',selected:true,saved:false},
 {saveRecordId:'copy-b',fileName:'b.jpg',title:'Unverified',shelf:'Shelf B',selected:true,saved:false},
 {saveRecordId:'copy-c',fileName:'c.jpg',title:'',shelf:'Shelf C',selected:true,saved:false}
 ]));
 assert.equal(await page.locator('#batchSave').isDisabled(),true);
 await page.locator('[data-batch-approve="0"]').check();
 // Shelf edits revoke approval; the chosen shelf is included in the save dialog.
 await page.locator('[data-batch-field="shelf"][data-batch-index="0"]').selectOption('Shelf B');
 assert.equal(await page.locator('#batchSave').isDisabled(),true);
 await page.locator('[data-batch-approve="0"]').check();
 accept=false;await page.locator('#batchSave').click();
 assert.equal(await page.evaluate(()=>window.__db.data.library_books.length),1);
 accept=true;await page.locator('#batchSave').click();
 await page.waitForFunction(()=>window.__rows()[0].saved===true);
 assert.match(dialogs.at(-1),/Shelf B: 1/);assert.match(dialogs.at(-1),/2 book\(s\) will remain/);
 const pending=await page.evaluate(()=>window.__rows().filter(x=>!x.saved).map(x=>[x.saveRecordId,x.shelf]));
 assert.deepEqual(pending,[['copy-b','Shelf B'],['copy-c','Shelf C']]);
 assert.equal(await page.evaluate(()=>window.__db.data.library_books.length),2);
 // Explicit incomplete save includes the remaining records and requires another dialog.
 await page.locator('#batchSaveIncomplete').click();
 await page.waitForFunction(()=>window.__rows().every(x=>x.saved));
 assert.match(dialogs.at(-1),/incomplete details/);
 const records=await page.evaluate(()=>window.__db.data.library_books);
 assert.equal(records.length,4);assert.equal(new Set(records.map(x=>x.record_id)).size,4);
 // Cropping on a phone-sized viewport preserves the original, shelf and copy identity.
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(async()=>{
  window.__cropTest();const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=800;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1200,800);ctx.fillStyle='black';ctx.fillText('ISBN 9780140328721',300,500);
  const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));window.__original=new File([blob],'original.png',{type:'image/png'});
  window.__seed([{saveRecordId:'crop-copy',fileName:'original.png',file:window.__original,title:'Matilda',shelf:'Shelf C',barcode:'',selected:true,saved:false}]);
 });
 await page.locator('[data-batch-crop="0"]').click();
 await page.waitForFunction(()=>!document.querySelector('[data-crop="scan"]').disabled);
 const dialog=page.locator('.isbn-crop-dialog'),bounds=await dialog.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391);
 // Keyboard-accessible controls also allow precise selection without a drag gesture.
 for(const [label,value] of [['Left position','25'],['Top position','50'],['Selection width','50'],['Selection height','25']])await page.getByRole('slider',{name:label,exact:true}).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}))},value);
 await page.locator('[data-crop="scan"]').click();
 await page.waitForFunction(()=>!document.querySelector('.isbn-crop-dialog'));
 assert.deepEqual(await page.evaluate(()=>window.__cropSize),[1200,400]);
 const cropState=await page.evaluate(()=>{const x=window.__rows()[0];return {shelf:x.shelf,id:x.saveRecordId,barcode:x.barcode,original:x.file===window.__original,approved:!!x.reviewApproval}});
 assert.deepEqual(cropState,{shelf:'Shelf C',id:'crop-copy',barcode:'9780140328721',original:true,approved:false});
 await page.locator('[data-batch-crop="0"]').click();await page.locator('[data-crop="cancel"]').click();assert.equal(await page.locator('.isbn-crop-dialog').count(),0);
 assert.deepEqual(issues,[]);
 console.log('PASS browser: shelf edit invalidates approval; cancel writes nothing; ready-only save keeps pending shelves; explicit incomplete save; distinct physical copies; mobile crop uses original pixels and preserves shelf/photo; no runtime errors.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
