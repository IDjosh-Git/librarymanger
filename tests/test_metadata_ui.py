"""Mock-browser test. No real catalog API or Supabase writes."""
import asyncio, sys, os
from pathlib import Path
from playwright.async_api import async_playwright
sys.path.insert(0,str(Path(__file__).resolve().parent))
from test_circulation import ROOT, MOCK
ISBN='9780140328721'
SCANNED_ISBN=']E0 978014032872112345'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in (int(os.environ.get("TEST_WIDTH","1440")),):
   page=await browser.new_page(viewport={'width':width,'height':900})
   issues=[];page.on('pageerror',lambda e:issues.append(str(e)))
   retry_calls=0
   await page.evaluate(MOCK)
   await page.route('https://cdn.jsdelivr.net/**',lambda route:route.fulfill(status=200,content_type='application/javascript',body=''))
   async def api(route):
    nonlocal retry_calls
    if 'code=9780061120084' in route.request.url:
     retry_calls+=1
     if retry_calls==1:
      await route.fulfill(status=429,headers={'Retry-After':'0'},content_type='application/json',body='{"error":"Too many lookups"}')
      return
    await route.fulfill(status=200,content_type='application/json',body='{"found":true,"metadata":{"title":"Matilda","authors":"Roald Dahl","publisher":"Puffin","publication_year":"1988","language":"eng","pages":"240","subject":"Fiction"},"sources":["Google Books","Open Library Search","HathiTrust"]}')
   await page.route('https://book-test.invalid/api/book-lookup*',api)
   html=(ROOT/'index.html').read_text().replace('<script src="assets/inventory-grouping.js"></script>','<script>'+(ROOT/'assets/inventory-grouping.js').read_text()+'</script>').replace('<script src="assets/dashboard-metrics.js"></script>','<script>'+(ROOT/'assets/dashboard-metrics.js').read_text()+'</script>').replace('<head>','<head><base href="https://book-test.invalid/">',1)
   html=html.replace('\n})();\n</script>','\nwindow.__seedBatchForTest=rows=>{batchItems=rows;renderBatch()};window.__getBatchForTest=()=>batchItems;window.__normalizeIsbnForTest=normalizeIsbn;window.__suggestIsbnCorrectionForTest=suggestIsbnCorrection;window.__batchLookupForTest=batchLookUp;\n})();\n</script>',1)
   await page.set_content(html,wait_until='domcontentloaded')
   await page.add_style_tag(content=(ROOT/'assets/app.css').read_text())
   await page.wait_for_function("document.getElementById('totalBooks').textContent==='3'")
   assert await page.evaluate("value => window.__normalizeIsbnForTest(value)",SCANNED_ISBN)==ISBN
   assert await page.evaluate("value => window.__suggestIsbnCorrectionForTest(value)","9780140328722")==ISBN
   assert await page.evaluate("value => window.__suggestIsbnCorrectionForTest(value)","978014032872212345")==ISBN
   assert await page.evaluate("value => window.__suggestIsbnCorrectionForTest(value)","0140328727")=="0140328726"
   assert await page.evaluate("value => window.__suggestIsbnCorrectionForTest(value)","90001001")==""
   retry_row=await page.evaluate("""async () => {const row={barcode:'9780061120084',title:'',lookup_status:'Manual'};await window.__batchLookupForTest(row);return row}""")
   assert retry_calls==2,'a rate-limited folder lookup should retry instead of becoming a false miss'
   assert retry_row['title']=='Matilda' and retry_row['lookup_status'].startswith('Found:')
   await page.locator('#manualBarcode').fill('9780140328722')
   await page.locator('#previewMetadata').click()
   assert await page.locator('[data-use-isbn-suggestion]').inner_text()=='Use verified correction'
   await page.locator('[data-use-isbn-suggestion]').click()
   await page.wait_for_function("document.getElementById('metadataPreview').textContent.includes('Matilda')")
   await page.locator('#manualBarcode').fill(SCANNED_ISBN)
   await page.locator('#previewMetadata').click()
   await page.wait_for_function("document.getElementById('metadataPreview').textContent.includes('Matilda')")
   assert await page.locator('#totalBooks').inner_text()=='3','preview should not write a new book'
   await page.locator('#manualShelf').fill('Shelf C-14')
   await page.locator('#addManual').click()
   await page.wait_for_function("document.getElementById('totalBooks').textContent==='4'")
   new=await page.evaluate("window.__db.data.library_books.find(b=>b.barcode==='9780140328721')")
   assert new['title']=='Matilda' and new['publisher']=='Puffin' and new['book_id']=='LIB-000219' and new['shelf_location']=='Shelf C-14'
   assert 'LIB-000219' in await page.locator('#status').inner_text(), 'save should show assigned ID'
   # The generated ID appears in the inventory but is not editable; shelf remains editable.
   await page.locator('#viewTable').click()
   assert await page.locator(f'[data-book="{new["record_id"]}"][data-field="book_id"]').get_attribute('contenteditable') is None
   assert await page.locator(f'[data-book="{new["record_id"]}"][data-field="shelf_location"]').count()==1
   assert 'LIB-000219' in await page.locator('#bookTable').inner_text()
   await page.locator('#viewGrid').click()
   # Refill only missing fields on an existing copy with matching ISBN and title.
   await page.evaluate("window.__db.data.library_books.find(b=>b.barcode==='9780140328721').publisher=null")
   await page.locator('#reload').click()
   new_id=new['record_id']
   page.once('dialog', lambda dialog: asyncio.create_task(dialog.accept()))
   await page.locator(f'[data-enrich-book="{new_id}"]').first.click()
   await page.wait_for_function("window.__db.data.library_books.find(b=>b.barcode==='9780140328721').publisher==='Puffin'")
   updated=await page.evaluate("window.__db.data.library_books.find(b=>b.barcode==='9780140328721')")
   assert updated['title']=='Matilda' and updated['book_status']=='Available' and updated['record_id']==new_id
   # Deliberately mismatched stored title/ISBN must not be mixed with unrelated metadata.
   await page.evaluate("window.__db.data.library_books.find(b=>b.record_id==='11111111-1111-4111-8111-111111111111').barcode='9780140328721'")
   await page.locator('#reload').click()
   await page.locator('[data-enrich-book="11111111-1111-4111-8111-111111111111"]').first.click()
   await page.wait_for_function("document.getElementById('status').textContent.includes('different title')")
   original=await page.evaluate("window.__db.data.library_books.find(b=>b.record_id==='11111111-1111-4111-8111-111111111111')")
   assert original['title']=='Practical Data Analysis' and not original.get('publisher')
   # A database-returned ID must stay bound to the right photo even if Supabase returns
   # batch insert rows in reverse order. The mock deliberately reverses responses.
   await page.evaluate("""() => {
     window.__seedBatchForTest([
      {fileName:'book-A.png',path:'Shelf 4/book-A.png',barcode:'90001001',title:'Book A',authors:'Author A',shelf:'Shelf 4',selected:true,saved:false,error:'',duplicate:false},
      {fileName:'book-B.png',path:'Shelf 4/book-B.png',barcode:'90001002',title:'Book B',authors:'Author B',shelf:'Shelf 4',selected:true,saved:false,error:'',duplicate:false}
     ]);
   }""")
   await page.locator('#batchSave').click()
   await page.wait_for_function("window.__getBatchForTest().every(x=>x.saved)")
   matched=await page.evaluate("""() => window.__getBatchForTest().map(x=>({title:x.title,id:x.book_id,db:window.__db.data.library_books.find(b=>b.title===x.title)?.book_id}))""")
   assert all(x['id']==x['db'] for x in matched),matched
   assert matched[0]['id']!=matched[1]['id'],matched
   assert 'Saved · LIB-' in await page.locator('#batchResults').inner_text()
   assert not issues, issues
   print(f'PASS metadata preview, ISBN fill, enrichment confirmation, mismatch protection; {width}px',flush=True)
   await page.close()
  await browser.close()
if __name__=='__main__':asyncio.run(main())
