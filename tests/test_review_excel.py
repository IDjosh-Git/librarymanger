"""Browser test: Excel export -> correction -> import -> database save -> reimport without duplicate insertion."""
import asyncio,sys
from pathlib import Path
from playwright.async_api import async_playwright
sys.path.insert(0,str(Path(__file__).resolve().parent))
from test_circulation import ROOT,MOCK

FAKE_XLSX=r'''
window.XLSX={
 utils:{
  book_new(){return {Sheets:{},SheetNames:[]}},
  aoa_to_sheet(a){return {_matrix:JSON.parse(JSON.stringify(a))}},
  book_append_sheet(w,s,n){w.Sheets[n]=s;w.SheetNames.push(n)},
  sheet_to_json(s){return JSON.parse(JSON.stringify(s._matrix))}
 },
 writeFile(w,n){window.__lastWorkbook=w;window.__lastWorkbookName=n},
 read(){return window.__nextWorkbook||window.__lastWorkbook}
};
'''

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1160,'height':880})
  issues=[]
  page.on('pageerror',lambda e:issues.append(str(e)))
  await page.evaluate(MOCK)
  await page.route('https://cdn.jsdelivr.net/**',lambda route:route.fulfill(status=200,content_type='application/javascript',body=''))
  html=(ROOT/'index.html').read_text().replace('<script src="assets/inventory-grouping.js"></script>','<script>'+(ROOT/'assets/inventory-grouping.js').read_text()+'</script>').replace('<script src="assets/dashboard-metrics.js"></script>','<script>'+(ROOT/'assets/dashboard-metrics.js').read_text()+'</script>').replace('<script src="assets/inventory-column-filters.js"></script>','<script>'+(ROOT/'assets/inventory-column-filters.js').read_text()+'</script>').replace('<head>','<head><base href="https://test-excel.invalid/">',1)
  helper=(ROOT/'assets/review-excel.js').read_text()
  html=html.replace('<script src="assets/review-excel.js"></script>','<script>'+helper+'</script>')
  html=html.replace('<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>', '<script>'+FAKE_XLSX+'</script>')
  html=html.replace('\n})();\n</script>','\nwindow.__seedBatchForTest=rows=>{batchItems=rows;renderBatch()};window.__getBatchForTest=()=>batchItems;\n})();\n</script>',1)
  await page.set_content(html,wait_until='domcontentloaded')
  await page.add_style_tag(content=(ROOT/'assets/app.css').read_text())
  await page.wait_for_function("document.getElementById('totalBooks').textContent==='3'",timeout=10000)
  await page.locator('[data-tab="inventory"]').click()
  assert not issues,issues
  # Include two copies with matching ISBN and a title-less copy that needs editing.
  scanrows=[
    {'fileName':'barcode_1.jpg','path':'Shelf A/barcode_1.jpg','barcode':'9780140328721','title':'First scanned book','authors':'','shelf':'Shelf A','selected':False,'saved':False,'error':'','duplicate':False},
    {'fileName':'barcode_2.jpg','path':'Shelf B/barcode_2.jpg','barcode':'9780140328721','title':'','authors':'','shelf':'','selected':False,'saved':False,'error':'Missing title','duplicate':False}
  ]
  await page.evaluate('rows=>window.__seedBatchForTest(rows)',scanrows)
  await page.locator('#batchExportExcel').click()
  sheet=await page.evaluate("window.__lastWorkbook.Sheets['Books to Review']._matrix")
  assert len(sheet)==3,sheet
  keys=[r[0] for r in sheet[1:]]
  assert len(set(keys))==2 and all(len(s)==36 for s in keys),keys
  assert sheet[1][3]=='9780140328721' and sheet[2][3]=='9780140328721',sheet
  assert (await page.evaluate('window.__lastWorkbookName')).endswith('.xlsx')
  # Correct title, then add another intentional physical copy (blank Review_Key).
  await page.evaluate('''() => {
    const rows=window.__lastWorkbook.Sheets['Books to Review']._matrix;
    const col=Object.fromEntries(rows[0].map((c,i)=>[c,i]));
    rows[2][col.Title]='Corrected title';rows[2][col.Authors]='Mary Author';rows[2][col.Shelf_Number]='Shelf C';
    const extra=[...rows[2]];extra[col.Review_Key]='';extra[col.Title]='Third physical copy';extra[col.Photo_File]='third.jpg';rows.push(extra);
  }''')
  await page.locator('#batchExcelFile').set_input_files({'name':'Library_Review.xlsx','mimeType':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','buffer':b'fake test data'})
  await page.wait_for_function("document.getElementById('batchStatus').textContent.includes('Excel loaded')",timeout=10000)
  rows=await page.evaluate('window.__getBatchForTest().map(r=>({record:r.saveRecordId,selected:r.selected,title:r.title,barcode:r.barcode,shelf:r.shelf}))')
  assert len(rows)==3 and all(r['selected'] for r in rows),rows
  assert rows[1]['title']=='Corrected title' and rows[2]['title']=='Third physical copy',rows
  assert len(set(r['record'] for r in rows))==3,rows
  await page.locator('#batchSave').click()
  await page.wait_for_function("window.__getBatchForTest().every(x=>x.saved)",timeout=10000)
  inventory=await page.evaluate("window.__db.data.library_books.filter(x=>x.barcode==='9780140328721')")
  assert len(inventory)==3,inventory
  assert len(set(x['book_id'] for x in inventory))==3,inventory
  assert len(set(x['record_id'] for x in inventory))==3,inventory
  assert any(x['title']=='Corrected title' and x['shelf_location']=='Shelf C' for x in inventory)
  # Re-import original two rows into a fresh review session: already saved records must be skipped.
  await page.evaluate("window.__seedBatchForTest([])")
  await page.locator('#batchExcelFile').set_input_files({'name':'Library_Review.xlsx','mimeType':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','buffer':b'fake data second import'})
  await page.wait_for_function("document.getElementById('batchStatus').textContent.includes('already saved')",timeout=10000)
  assert len(await page.evaluate('window.__getBatchForTest()'))==1,'Blank-key new row correctly adds a fresh copy on every reimport (documented)'
  # Reimport each keyed original, never duplicate. Blank-key row is a new copy by design.
  assert not issues,issues
  await browser.close()
  print('PASS export preserves distinct Review Keys; import corrects existing rows, appends new copy, saves to mock Supabase; reimport skips already-saved keyed copies')

if __name__=='__main__': asyncio.run(main())
