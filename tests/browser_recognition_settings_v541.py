from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
soup=BeautifulSoup((root/'index.html').read_text(encoding='utf-8'),'html.parser')
settings=soup.select_one('#recognitionSettings')
assert settings
assert [s.get_text(strip=True) for s in settings.select('.scan-recognition-copy strong')]==['AI','OCR']
for selector in ('#batchUseAI','#batchUseOCR'):
 assert settings.select_one(selector)
styles='\n'.join((root/'assets'/name).read_text(encoding='utf-8') for name in [
 'library-manager-v542.css'])
html=f'''<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>{styles}\n*{{box-sizing:border-box}}body{{margin:0}}#mock{{width: min(312px, calc(100vw - 24px));margin:12px auto}}</style></head><body data-account="in" data-role="admin"><section id="accountCard" class="card auth"><details class="account-tools" open><summary>Account settings</summary><div class="account-tools-body">{settings}</div></details></section><script>document.getElementById('recognitionSettings').open=true;</script></body></html>'''
with sync_playwright() as playwright:
 b=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in [320,360,390,768,1024,1440]:
  p=b.new_page(viewport={'width':width,'height':900})
  p.set_content(html,wait_until='load')
  cards=p.locator('#recognitionSettings label.scan-recognition-card')
  assert cards.count()==2
  heights=cards.evaluate_all('(cards)=>cards.map(c=>Math.round(c.getBoundingClientRect().height))')
  assert min(heights)>=99,(width,heights)
  assert p.evaluate('document.documentElement.scrollWidth')<=width+1,(width,'horizontal overflow')
  switches=p.locator('.scan-recognition-switch')
  assert switches.count()==2
  assert p.locator('#batchUseAI').is_checked() and p.locator('#batchUseOCR').is_checked()
  if width in (390,1440):
   p.screenshot(path=str(root.parent/f'LibraryManager_v5.41_Recognition_Settings_{width}.png'))
  cards.nth(0).click();assert not p.locator('#batchUseAI').is_checked() and p.locator('#batchUseOCR').is_checked()
  cards.nth(1).click();assert not p.locator('#batchUseOCR').is_checked()
  p.locator('#batchUseAI').focus();p.keyboard.press('Space');assert p.locator('#batchUseAI').is_checked()
  print(f'{width}px: card heights={heights}; toggle and keyboard access passed')
  p.close()
 b.close()
