"""Visual/interaction smoke checks for the v5.9 Quick Add redesign."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from test_inventory_column_filters import ROOT, MOCK

async def main():
  async with async_playwright() as playwright:
    browser = await playwright.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for width,height in [(1680,900),(1440,900),(1280,850),(1024,820),(820,820),(600,820),(390,844),(320,740)]:
      page=await browser.new_page(viewport={'width':width,'height':height}, device_scale_factor=1)
      errors=[]
      page.on('pageerror', lambda error: errors.append(str(error)))
      await page.evaluate(MOCK)
      async def serve(route):
        rel=route.request.url.split('library-test.invalid/',1)[-1].split('?',1)[0]
        file=(ROOT/rel).resolve()
        if not file.is_file() or not file.is_relative_to(ROOT):
          return await route.fulfill(status=404,body='missing')
        ext=file.suffix
        mime='application/javascript' if ext in ('.js','.cjs') else 'text/css' if ext=='.css' else 'image/svg+xml' if ext=='.svg' else 'image/jpeg' if ext in ('.jpg','.jpeg') else 'text/html'
        await route.fulfill(status=200, content_type=mime, body=file.read_bytes())
      await page.route('https://library-test.invalid/**',serve)
      await page.route('https://cdn.jsdelivr.net/**',lambda route:route.fulfill(status=200,content_type='application/javascript',body=''))
      await page.route('https://images.unsplash.com/**',lambda route:route.fulfill(status=503,body='unavailable'))
      html=(ROOT/'index.html').read_text().replace('<head>','<head><base href="https://library-test.invalid/">',1)
      await page.set_content(html,wait_until='domcontentloaded')
      await page.wait_for_function("document.getElementById('totalBooks').textContent==='3'",timeout=8000)
      await page.locator('[data-tab="inventory"]' if width>=900 else '[data-gotab="inventory"]').click()
      form=page.locator('#inventory .inventory-command-card')
      assert await form.is_visible()
      sizes=await page.evaluate('''() => {
        const box=s=>document.querySelector(s).getBoundingClientRect();
        const f=box('#inventory .inventory-command-card'), a=box('#manualBarcode'), t=box('#manualTitle'), b=box('#addManual'), meta=box('#metadataPreview');
        const styles=getComputedStyle(document.querySelector('#inventory .inventory-command-card'));
        return {formHeight:f.height,formTop:f.top,barcodeTop:a.top,titleTop:t.top,buttonBottom:b.bottom,formBottom:f.bottom,justify:styles.justifyContent,bodyScroll:document.documentElement.scrollWidth,inner:innerWidth, formLeft:f.left,formRight:f.right,barcodeWidth:a.width}
      }''')
      assert sizes['justify']!='center',f'Unexpected centering at {width}: {sizes}'
      assert sizes['barcodeTop']-sizes['formTop']<150,f'Excess padding above fields at {width}: {sizes}'
      assert sizes['formBottom']-sizes['buttonBottom']<120,f'Excess padding below actions at {width}: {sizes}'
      assert sizes['bodyScroll']<=width+2,f'Horizontal overflow at {width}: {sizes}'
      assert sizes['formLeft']>=-1 and sizes['formRight']<=width+2,f'Quick add extends offscreen at {width}: {sizes}'
      assert sizes['barcodeWidth']>=150,f'Barcode field too small at {width}: {sizes}'
      await page.locator('#manualBarcode').fill('9780140328721')
      await page.locator('#manualShelf').fill('Shelf A-4')
      await page.locator('#manualTitle').fill('Matilda')
      assert await page.locator('#manualTitle').input_value()=='Matilda'
      await page.locator('#clearForm').click()
      assert not await page.locator('#manualBarcode').input_value()
      assert not await page.locator('#manualShelf').input_value()
      assert not await page.locator('#manualTitle').input_value()
      if width in [1440,390]:
        await page.locator('#inventory .inventory-dashboard-grid').screenshot(path=str(ROOT / f'quick_add_{width}_light.png'))
        await page.locator('#themeToggle').click()
        assert await page.locator('html').get_attribute('data-theme')=='dark'
        await page.locator('#inventory .inventory-dashboard-grid').screenshot(path=str(ROOT / f'quick_add_{width}_dark.png'))
      assert not errors,(width,errors)
      print(f'PASS {width}px: compact spacing, readable fields, no overflow, Clear works')
      await page.close()
    await browser.close()
if __name__=='__main__':asyncio.run(main())
