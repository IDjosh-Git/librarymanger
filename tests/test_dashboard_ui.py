"""Real Chromium smoke test for dashboard and navigation using a local in-memory DB."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from test_circulation import MOCK, ROOT

async def run():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
  for width,height in [(1440,960),(390,844)]:
   page=await browser.new_page(viewport={'width':width,'height':height}, device_scale_factor=1)
   errors=[]
   page.on('pageerror',lambda exc:errors.append(str(exc)))
   await page.add_init_script(MOCK)
   await page.evaluate(MOCK)
   await page.route('https://cdn.jsdelivr.net/**',lambda r:r.fulfill(status=200,content_type='application/javascript',body=''))
   await page.route('https://images.unsplash.com/**',lambda r:r.fulfill(status=503,body='offline in test'))
   async def local_route(route):
    rel=route.request.url.split('library-test.invalid/',1)[-1].split('?',1)[0]
    file=(ROOT/rel).resolve()
    if not file.is_file() or not file.is_relative_to(ROOT):
     return await route.fulfill(status=404,body='missing')
    mime='application/javascript' if file.suffix in ('.js','.cjs') else 'text/css' if file.suffix=='.css' else 'image/svg+xml' if file.suffix=='.svg' else 'image/jpeg' if file.suffix=='.jpg' else 'image/png' if file.suffix=='.png' else 'text/html'
    await route.fulfill(status=200,content_type=mime,body=file.read_bytes())
   await page.route('https://library-test.invalid/**',local_route)
   html=(ROOT/'index.html').read_text().replace('<head>','<head><base href="https://library-test.invalid/">',1)
   await page.set_content(html,wait_until='domcontentloaded')
   await page.wait_for_function("document.getElementById('dashTotalCopies').textContent==='3'",timeout=6000)
   assert await page.locator('#dashboard').is_visible(), 'Dashboard should be home'
   assert await page.locator('#dashDistinctBooks').inner_text()=='2'
   assert await page.locator('#dashAvailableCopies').inner_text()=='2'
   assert await page.locator('#dashBorrowedCopies').inner_text()=='1'
   assert await page.locator('#dashCatalogPct').inner_text()=='0%'
   assert await page.locator('#dashOverdueLoans').inner_text()=='1'
   assert await page.locator('#dashboardDueList .dashboard-due-item').count()==1
   assert await page.locator('#dashboardShelves .dashboard-ranked-row').count()==3
   assert await page.locator('#dashboardPopular .dashboard-popular-item').count()==1
   assert await page.locator('#dashboardActivity .dashboard-activity-item').count()>0
   assert await page.locator('#dashboardHealthRing').get_attribute('aria-label')
   # Fresh save after reload updates chart and metrics.
   await page.evaluate("window.__db.data.library_books[0].shelf_location='Shelf New';window.__db.data.library_books[0].publisher='Library Press';")
   await page.locator('#reload').click()
   await page.wait_for_function("document.getElementById('dashboardShelvesMeta').textContent.includes('3 physical copies')")
   await page.locator('[data-dashboard-action="attention"]').first.click()
   assert await page.locator('#inventory').is_visible()
   assert await page.locator('[data-quality-filter="attention"]').get_attribute('aria-pressed')=='true'
   nav='[data-tab="dashboard"]' if width>899 else '[data-gotab="dashboard"]'
   await page.locator(nav).click()
   assert await page.locator('#dashboard').is_visible()
   await page.locator('[data-dashboard-action="lend"]').click()
   assert await page.locator('#lend').is_visible()
   assert not errors,errors
   await page.locator(nav).click()
   if width==1440:
    await page.screenshot(path='/mnt/data/library_dashboard_desktop_preview.png',full_page=True)
   else:
    await page.screenshot(path='/mnt/data/library_dashboard_mobile_preview.png',full_page=True)
   print('PASS',width,'dashboard KPIs, charts, priorities, navigation, reload, no JS exceptions')
   await page.close()
  await browser.close()

if __name__=='__main__':asyncio.run(run())
