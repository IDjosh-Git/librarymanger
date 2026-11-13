from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
soup=BeautifulSoup((root/'index.html').read_text(),'html.parser')
account=soup.select_one('#accountCard .account-tools')
assert account is not None
assert account.select_one('#recognitionSettings #batchUseAI')
assert account.select_one('#recognitionSettings #batchUseOCR')
assert soup.select_one('#shelfScan #batchUseAI') is None
assert soup.select_one('#shelfScan #batchUseOCR') is None
assert soup.select_one('#review #reviewUseAI') is None
assert soup.select_one('#review #reviewUseOCR') is None
css='\n'.join((root/'assets'/name).read_text() for name in ['library-manager-v542.css'])
html=f'<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{{box-sizing:border-box}}body{{padding:10px;margin:0}}.account-tools{{max-width:440px}}{css}</style></head><body data-account="in">{account}</body></html>'
with sync_playwright() as playwright:
 browser=playwright.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in [320,390,768,1440]:
  page=browser.new_page(viewport={'width':width,'height':900})
  page.set_content(html)
  page.locator('details.account-tools > summary').click()
  page.locator('#recognitionSettings > summary').click()
  ai=page.locator('#batchUseAI')
  ocr=page.locator('#batchUseOCR')
  assert ai.is_checked() and ocr.is_checked()
  page.locator('label[for="batchUseAI"]').click()
  assert not ai.is_checked() and ocr.is_checked()
  page.locator('label[for="batchUseOCR"]').click()
  assert not ai.is_checked() and not ocr.is_checked()
  assert page.evaluate('document.documentElement.scrollWidth')<=width+1
  print(f'{width}px: settings opened; switches independent; no overflow')
  page.close()
 browser.close()
