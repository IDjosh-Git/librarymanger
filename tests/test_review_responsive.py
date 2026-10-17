"""Responsive page and review Excel behavior with a mocked Supabase database."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from test_circulation import MOCK, ROOT
from test_review_excel import FAKE_XLSX

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1680,1366,1024,820,768,430,390,360,320]:
   context=await browser.new_context(viewport={'width':width,'height':920})
   page=await context.new_page()
   errors=[]
   page.on('pageerror',lambda e: errors.append(str(e)))
   await page.add_init_script(MOCK)
   await page.add_init_script(FAKE_XLSX)
   await page.route('https://cdn.jsdelivr.net/**',lambda r:r.fulfill(status=200,content_type='application/javascript',body=''))
   await page.route('https://images.unsplash.com/**',lambda r:r.fulfill(status=503,body='offline'))
   async def local_route(route):
    rel=route.request.url.split('library-test.invalid/',1)[-1].split('?',1)[0]
    if not rel:rel='index.html'
    file=(ROOT/rel).resolve()
    if not file.is_file() or not file.is_relative_to(ROOT):return await route.fulfill(status=404,body='missing')
    mime={'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}.get(file.suffix,'text/html')
    return await route.fulfill(status=200,content_type=mime,body=file.read_bytes())
   await page.route('https://library-test.invalid/**',local_route)
   await page.evaluate(MOCK)
   await page.evaluate(FAKE_XLSX)
   html=(ROOT/'index.html').read_text().replace('<head>','<head><base href="https://library-test.invalid/">',1)
   await page.set_content(html,wait_until='domcontentloaded')
   await page.wait_for_function("document.getElementById('dashTotalCopies').textContent==='3'",timeout=10000)
   for tab in ['dashboard','inventory','lend','return','history']:
    await page.evaluate('tab=>document.querySelector(`[data-tab="${tab}"]`).click()',tab)
    m=await page.evaluate('''() => ({v:innerWidth,d:document.documentElement.scrollWidth,b:document.body.scrollWidth})''')
    assert m['d']<=m['v']+2 and m['b']<=m['v']+2,(width,tab,m)
   await page.evaluate('document.querySelector(`[data-tab="inventory"]`).click()')
   assert await page.locator('#batchExportExcel').is_disabled()
   assert await page.locator('#savedAttentionExport').is_enabled()
   assert '0 unsaved' in await page.locator('#reviewExportStatus').inner_text()
   if width==390:
    # Distinguishes rows that need correction in the saved database.
    await page.locator('#savedAttentionExport').click()
    assert await page.evaluate("window.__lastWorkbookName.startsWith('Library_Saved_Needs_Attention_')")
    rows=await page.evaluate("window.__lastWorkbook.Sheets['Books to Review']._matrix")
    assert len(rows)==4,rows
    headings=rows[0];action=headings.index('Import_Action');title=headings.index('Title')
    assert all(r[action]=='UPDATE' for r in rows[1:]),rows
    await page.evaluate("() => { const rows=window.__lastWorkbook.Sheets['Books to Review']._matrix;rows[1][rows[0].indexOf('Title')]='Corrected title after Excel review';}")
    await page.locator('#batchExcelFile').set_input_files({'name':'Library_Fixes.xlsx','mimeType':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','buffer':b'fake xlsx bytes'})
    await page.wait_for_function("document.getElementById('batchStatus').textContent.includes('Excel loaded')",timeout=10000)
    assert await page.locator('#batchSave').is_enabled()
    n_before=await page.evaluate('window.__db.data.library_books.length')
    await page.locator('#batchSave').click()
    await page.wait_for_function("document.getElementById('batchStatus').textContent.includes('existing copies updated')",timeout=10000)
    assert await page.evaluate('window.__db.data.library_books.length')==n_before
    assert await page.evaluate("window.__db.data.library_books.some(x=>x.title==='Corrected title after Excel review')")
    # Import a separate unsaved copy, then verify review counts and Excel export.
    await page.evaluate('''() => {
     const h=window.__lastWorkbook.Sheets['Books to Review']._matrix[0];
     const row=h.map(()=> '');row[h.indexOf('ISBN_Barcode')]='9780000000001';row[h.indexOf('Title')]='Unfinished scan';
     row[h.indexOf('Import_Action')]='SAVE';row[h.indexOf('Photo_File')]='unreadable.jpg';
     window.__nextWorkbook={Sheets:{'Books to Review':{_matrix:[h,row]}}};
    }''')
    await page.locator('#batchExcelFile').set_input_files({'name':'Library_New.xlsx','mimeType':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','buffer':b'fake'})
    await page.wait_for_function("document.getElementById('reviewExportStatus').textContent.includes('1 unsaved')",timeout=5000)
    assert await page.locator('#batchExportExcel').is_enabled()
    await page.locator('#batchExportExcel').click()
    assert await page.evaluate("window.__lastWorkbookName.startsWith('Library_Review_Corrections_')")
    assert len(await page.evaluate("window.__lastWorkbook.Sheets['Books to Review']._matrix"))==2
   if width==320:
    await page.evaluate('delete window.XLSX')
    async with page.expect_download() as grab:
     await page.locator('#savedAttentionExport').click()
    download=await grab.value
    assert download.suggested_filename.endswith('.csv'),download.suggested_filename
    target=ROOT/'tests'/'_temporary_review.csv'
    await download.save_as(str(target))
    data=target.read_bytes().decode('utf-8-sig')
    target.unlink()
    assert 'Review_Key' in data and 'UPDATE' in data and 'ISBN_Barcode' in data
    await page.locator('#batchExcelFile').set_input_files({'name':'Corrected_Books.csv','mimeType':'text/csv','buffer':data.encode('utf-8')})
    await page.wait_for_function("document.getElementById('batchStatus').textContent.includes('Excel loaded')",timeout=10000)
    assert await page.locator('#batchSave').is_enabled()
   assert not errors,(width,errors)
   print('PASS width=',width,'responsive tabs, review counts and exports',flush=True)
   await context.close()
  await browser.close()

if __name__=='__main__':asyncio.run(main())
