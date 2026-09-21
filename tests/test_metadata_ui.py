"""Mock-browser test. No real catalog API or Supabase writes."""
import asyncio, sys, os
from pathlib import Path
from playwright.async_api import async_playwright
sys.path.insert(0,str(Path(__file__).resolve().parent))
from test_circulation import ROOT, MOCK
ISBN='9780140328721'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in (int(os.environ.get("TEST_WIDTH","1440")),):
   page=await browser.new_page(viewport={'width':width,'height':900})
   issues=[];page.on('pageerror',lambda e:issues.append(str(e)))
   await page.evaluate(MOCK)
   await page.route('https://cdn.jsdelivr.net/**',lambda route:route.fulfill(status=200,content_type='application/javascript',body=''))
   async def api(route):
    await route.fulfill(status=200,content_type='application/json',body='{"found":true,"metadata":{"title":"Matilda","authors":"Roald Dahl","publisher":"Puffin","publication_year":"1988","language":"eng","pages":"240","subject":"Fiction"},"sources":["Google Books","Open Library Search","HathiTrust"]}')
   await page.route('https://book-test.invalid/api/book-lookup*',api)
   await page.set_content((ROOT/'index.html').read_text().replace('<head>','<head><base href="https://book-test.invalid/">',1),wait_until='domcontentloaded')
   await page.add_style_tag(content=(ROOT/'assets/app.css').read_text())
   await page.wait_for_function("document.getElementById('totalBooks').textContent==='3'")
   await page.locator('#manualBarcode').fill(ISBN)
   await page.locator('#previewMetadata').click()
   await page.wait_for_function("document.getElementById('metadataPreview').textContent.includes('Matilda')")
   assert await page.locator('#totalBooks').inner_text()=='3','preview should not write a new book'
   await page.locator('#addManual').click()
   await page.wait_for_function("document.getElementById('totalBooks').textContent==='4'")
   new=await page.evaluate("window.__db.data.library_books.find(b=>b.barcode==='9780140328721')")
   assert new['title']=='Matilda' and new['publisher']=='Puffin'
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
   assert not issues, issues
   print(f'PASS metadata preview, ISBN fill, enrichment confirmation, mismatch protection; {width}px',flush=True)
   await page.close()
  await browser.close()
if __name__=='__main__':asyncio.run(main())
