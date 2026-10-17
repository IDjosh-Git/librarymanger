"""Browser test: unfinished scans sync to the mocked cloud and return after a fresh Review load."""
import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright
sys.path.insert(0,str(Path(__file__).resolve().parent))
from test_circulation import MOCK, ROOT

QUEUE_MOCK=(MOCK
 .replace('  const writes=[];', '  data.library_review_queue=[]; const writes=[];')
 .replace("    insert(payload){this.action='insert';", "    upsert(payload){this.action='upsert';this.payload=deep(payload);return this;}\n    in(field,values){this.inFilter=[field,values];return this;}\n    delete(){this.action='delete';return this;}\n    insert(payload){this.action='insert';")
 .replace("      if(this.action==='insert'&&Array.isArray(this.payload)){", """      if(this.action==='upsert'){
        const rows=Array.isArray(this.payload)?this.payload:[this.payload];
        for(const row of rows){const prev=data[this.table].find(x=>x.user_id===row.user_id&&x.review_key===row.review_key);if(prev)Object.assign(prev,deep(row));else data[this.table].push(deep(row));}
        return Promise.resolve({data:null,error:null}).then(ok,bad);
      }
      if(this.action==='delete'){
        data[this.table]=data[this.table].filter(x=>!this.filters.every(([k,v])=>x[k]===v)|| (this.inFilter&&!this.inFilter[1].includes(x[this.inFilter[0]])));
        return Promise.resolve({data:null,error:null}).then(ok,bad);
      }
      if(this.action==='insert'&&Array.isArray(this.payload)){"""))

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':980,'height':860})
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.route('https://cdn.jsdelivr.net/**',lambda route:route.fulfill(status=200,content_type='application/javascript',body=''))
  await page.evaluate(QUEUE_MOCK)
  html=(ROOT/'index.html').read_text()
  for asset in ['inventory-grouping.js','dashboard-metrics.js','review-excel.js']:
   html=html.replace(f'<script src="assets/{asset}"></script>', '<script>'+(ROOT/'assets'/asset).read_text()+'</script>')
  html=html.replace('\n})();\n</script>','\nwindow.__seedReview=rows=>{batchItems=rows;renderBatch()};window.__readReview=()=>batchItems.map(x=>({key:x.saveRecordId,title:x.title,saved:x.saved,thumb:!!x.thumbnailData}));window.__resetReview=()=>{batchItems=[];renderBatch()};\n})();\n</script>',1)
  await page.set_content(html,wait_until='domcontentloaded')
  await page.wait_for_function("document.getElementById('totalBooks').textContent==='3'",timeout=10000)
  await page.locator('[data-tab="inventory"]').click()
  key='d0554c1d-c5ad-4ff1-a812-76ffec721f6b'
  rows=[{'saveRecordId':key,'fileName':'missing_title.jpg','path':'Shelf C/missing_title.jpg','barcode':'9780140328721','title':'','authors':'','publisher':'','publication_year':'','shelf':'Shelf C','lookup_status':'No title','error':'Title missing','selected':False,'saved':False,'reviewUpdatedAt':1234,'thumbnailData':'data:image/jpeg;base64,/9j/4AAQ'}]
  await page.evaluate('rows=>window.__seedReview(rows)',rows)
  await page.wait_for_function("window.__db.data.library_review_queue.length===1",timeout=15000)
  assert await page.evaluate("window.__db.data.library_review_queue[0].review_key")==key
  assert 'Supabase' in await page.locator('#reviewSyncStatus').inner_text()
  await page.evaluate('window.__resetReview()')
  await page.locator('#refreshReviewCloud').click()
  await page.wait_for_function("window.__readReview().length===1",timeout=10000)
  assert (await page.evaluate('window.__readReview()'))[0]['key']==key
  assert await page.locator('.batch-book-photo').count()==1,'thumbnail restored'
  assert await page.locator('#batchExportExcel').is_enabled()
  # A subsequent scan selection must not clear unfinished Review records.
  await page.evaluate('window.__seedReview(window.__readReview().map(r=>({saveRecordId:r.key,title:r.title,fileName:"still_here.jpg",barcode:"9780140328721",selected:false,saved:false})))')
  assert (await page.evaluate('window.__readReview()'))[0]['key']==key
  assert not errors,errors
  print('PASS persistent cloud queue; stable keys; compressed preview restoration; review export available')
  await browser.close()

if __name__=='__main__':asyncio.run(main())
