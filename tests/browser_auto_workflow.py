from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
soup=BeautifulSoup((root/'index.html').read_text(),'html.parser')
account=soup.select_one('details.account-tools')
assert account.select_one('#batchUseOCR') and account.select_one('#batchUseAI')
assert not soup.select_one('#shelfScan #batchUseOCR') and not soup.select_one('#shelfScan #batchUseAI')
assert not soup.select_one('#review #reviewUseOCR') and not soup.select_one('#review #reviewUseAI')
parts=[]
for id in ['shelfScan','review']:
 e=soup.find(id=id);e['class']=e.get('class',[])+(['active'] if id=='shelfScan' else [])
 parts.append(str(e))
style='\n'.join((root/'assets'/x).read_text() for x in ['library-ui.css','scan-review-workspace.css','premium-progress-upload.css','recognition-settings-v535.css','scan-auto-premium-v534.css'])
html='<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+style+'</style></head><body data-account="in">'+''.join(parts)+'</body></html>'
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in [320,360,390,600,768,1024,1440]:
  page=browser.new_page(viewport={'width':width,'height':900},device_scale_factor=1)
  page.set_content(html,wait_until='domcontentloaded')
  page.evaluate("""() => {document.getElementById('scanAutoSavedCount').textContent='18';document.getElementById('scanAutoReviewCount').textContent='4';document.getElementById('scanAutoSkippedCount').textContent='2';document.getElementById('scanAutoOutcome').dataset.state='success';document.getElementById('scanAutoOutcome').textContent='18 books successfully saved to Inventory · 4 books successfully sent to Review · 2 already processed.';document.getElementById('batchProgressPercent').textContent='100%';document.getElementById('batchProgress').value=1000;document.getElementById('batchProgress').max=1000;document.getElementById('batchProgress').dataset.scanTotal='24';document.getElementById('batchProgress').dataset.scanScanned='22';document.getElementById('batchProgress').dataset.scanSkipped='2';document.getElementById('batchProgressStage').textContent='Scanning books';document.getElementById('batchStatus').textContent='Scanning and saving automatically…';}""")
  assert page.locator('#shelfScan table:visible').count()==0
  assert page.locator('#scanAutoSavedCount').inner_text()=='18'
  assert page.locator('#scanAutoReviewCount').inner_text()=='4'
  assert page.locator('#scanAutoOutcome').is_visible()
  assert page.locator('#scanInventoryJump').is_visible()
  assert page.locator('#scanOpenReview').is_visible()
  scroll=page.evaluate('document.documentElement.scrollWidth')
  print(json.dumps({'page':'scan','width':width,'scroll_width':scroll,'visible_tables':0}))
  if scroll>width+1:
   print('Overflowing:',page.evaluate("""() => [...document.querySelectorAll('#shelfScan *')].filter(e=>getComputedStyle(e).display!=='none' && e.getBoundingClientRect().right>innerWidth+2).slice(0,15).map(e=>[e.id,e.className,e.getBoundingClientRect().right])"""))
  assert scroll<=width+1,(width,scroll)
  if width in (390,1440):page.screenshot(path=str(root/f'scan-v534-{width}.png'),full_page=True)
  page.evaluate("""() => {document.getElementById('shelfScan').classList.remove('active');document.getElementById('review').classList.add('active');}""")
  assert page.locator('#reviewBackToScan').is_visible()
  assert page.locator('#reviewSaveCorrected').is_visible()
  scroll=page.evaluate('document.documentElement.scrollWidth')
  print(json.dumps({'page':'review','width':width,'scroll_width':scroll}))
  assert scroll<=width+1,(width,scroll)
  if width in (390,1440):page.screenshot(path=str(root/f'review-v534-{width}.png'),full_page=True)
  page.close()
 browser.close()
