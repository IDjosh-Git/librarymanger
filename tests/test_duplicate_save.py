"""Check copy-level duplicate saves with mocked Supabase; does not modify live inventory."""
import asyncio,sys
from pathlib import Path
from playwright.async_api import async_playwright
sys.path.insert(0,str(Path(__file__).resolve().parent))
from test_circulation import ROOT,MOCK

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1200,'height':850})
  issues=[];dialog_count=[]
  page.on('pageerror',lambda e:issues.append(str(e)))
  page.on('dialog',lambda d:dialog_count.append(d.message)) # unexpected dialogs auto-dismiss
  await page.evaluate(MOCK)
  await page.route('https://cdn.jsdelivr.net/**',lambda route:route.fulfill(status=200,content_type='application/javascript',body=''))
  html=(ROOT/'index.html').read_text().replace('<script src="assets/inventory-grouping.js"></script>','<script>'+(ROOT/'assets/inventory-grouping.js').read_text()+'</script>').replace('<script src="assets/dashboard-metrics.js"></script>','<script>'+(ROOT/'assets/dashboard-metrics.js').read_text()+'</script>').replace('<script src="assets/inventory-column-filters.js"></script>','<script>'+(ROOT/'assets/inventory-column-filters.js').read_text()+'</script>').replace('<head>','<head><base href="https://book-test.invalid/">',1)
  html=html.replace('\n})();\n</script>','\nwindow.__seedBatchForTest=rows=>{batchItems=rows;renderBatch()};window.__getBatchForTest=()=>batchItems;\n})();\n</script>',1)
  await page.set_content(html,wait_until='domcontentloaded')
  await page.add_style_tag(content=(ROOT/'assets/app.css').read_text())
  await page.wait_for_function("document.getElementById('totalBooks').textContent==='3'")
  await page.locator('[data-tab="inventory"]').click()
  rows=[
   {'fileName':'copy1.jpg','path':'Shelf A/copy1.jpg','barcode':'9781234567897','title':'Practical Data Analysis','authors':'Ada Okoye','shelf':'Shelf A','selected':False,'saved':False,'error':'','duplicate':False},
   {'fileName':'copy2.jpg','path':'Shelf B/copy2.jpg','barcode':'9781234567897','title':'','authors':'','shelf':'','selected':False,'saved':False,'error':'Title not identified yet','duplicate':False},
   {'fileName':'unknown.jpg','path':'unknown.jpg','barcode':'','title':'','authors':'','shelf':'','selected':False,'saved':False,'error':'No barcode or text detected','duplicate':False},
  ]
  await page.evaluate('rows=>window.__seedBatchForTest(rows)',rows)
  assert await page.locator('#batchDuplicateCount').inner_text()=='2'
  await page.locator('#batchSelectDuplicates').click()
  states=await page.evaluate('window.__getBatchForTest().map(x=>x.selected)')
  assert states==[True,True,False],states
  # Editing metadata while a duplicate is already checked must never de-select it.
  await page.locator('[data-batch-field="authors"][data-batch-index="1"]').fill('')
  await page.locator('[data-batch-field="authors"][data-batch-index="1"]').blur()
  assert await page.evaluate('window.__getBatchForTest()[1].selected') is True
  await page.locator('#batchSave').click()
  await page.wait_for_function('window.__getBatchForTest().filter(x=>x.saved).length===2',timeout=10000)
  assert dialog_count==[],f'Duplicate saving unexpectedly blocked by confirmation: {dialog_count}'
  saved=await page.evaluate('''() => window.__getBatchForTest().filter(x=>x.saved).map(x=>({barcode:x.barcode,book_id:x.book_id,record_id:x.saveRecordId}))''')
  assert len(saved)==2 and len(set(x['book_id'] for x in saved))==2 and len(set(x['record_id'] for x in saved))==2,saved
  db=await page.evaluate('''() => window.__db.data.library_books.filter(b=>b.barcode==='9781234567897')''')
  assert len(db)==4,db # 2 original physical copies + 2 new physical copies
  second=next(b for b in db if b['record_id']==saved[1]['record_id'])
  assert second['title'] is None and second['shelf_location'] is None,second
  # Image without barcode/title/shelf is also saveable with empty barcode (NOT NULL in production).
  await page.locator('#batchSelectAll').click()
  await page.locator('#batchSave').click()
  await page.wait_for_function('window.__getBatchForTest().every(x=>x.saved)',timeout=10000)
  unknown=await page.evaluate('''() => window.__db.data.library_books.find(b=>b.record_id===window.__getBatchForTest()[2].saveRecordId)''')
  assert unknown and unknown['barcode']=='' and unknown['title'] is None and unknown['shelf_location'] is None,unknown
  assert unknown['book_id'] not in {r['book_id'] for r in saved}
  assert await page.evaluate('window.__getBatchForTest().every(x=>!x.selected)')
  assert len(await page.evaluate('window.__db.data.library_books'))==6
  assert not issues,issues
  await browser.close()
  print('PASS duplicate ISBN rows saved unchanged; incomplete and barcode-free rows saved; separate IDs; no selection loss or confirmation')

if __name__=='__main__':asyncio.run(main())
