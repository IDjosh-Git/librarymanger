"""Visual smoke check: shared Review badges and team scan labels on desktop/mobile."""
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
src=(root/'index.html').read_text()
css=(root/'assets/library-manager-v542.css').read_text()
soup=BeautifulSoup(src,'html.parser')
hero=soup.select_one('#review .review-workspace-hero')
stats=soup.select_one('#review .review-stats')
sheet=soup.select_one('#mobileNavSheet')
nav=soup.select_one('#reviewNavCount')
assert hero and stats and sheet and nav
sample='''<div class="batch-book-list" role="list" style="padding:12px 0;max-width:940px">
 <article role="listitem" class="batch-book scan-title-review-card" style="padding:16px">
  <div class="batch-book-head"><span class="scan-title-review-number">1</span><div class="batch-book-source"><strong>Sample scanned book</strong><span class="batch-path">Example cover</span></div><div class="review-card-head-actions"><span class="batch-book-state ready">Ready to approve</span><span class="review-shared-tag">Team scan</span></div></div>
  <p style="color:var(--muted);padding:8px 0 0">A book scanned by another administrator is included in the shared queue.</p>
 </article></div>'''
html='''<!doctype html><html lang="en" data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'''+css+'''</style></head><body data-account="in" data-role="admin"><main style="max-width:1200px;margin:0 auto;padding:10px"><div class="layout"><div class="auth"><div class="tab">Review books <span class="nav-new-pill" id="reviewNavCount">0</span></div></div><div id="libraryArea"><section class="panel active" id="review">'''+str(hero)+str(stats)+sample+'''</section></div></div></main>'''+str(sheet)+'''</body></html>'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in (320,390,600,768,1024,1440):
  page=browser.new_page(viewport={'width':width,'height':900},device_scale_factor=1)
  page.set_content(html)
  page.evaluate('''() => {
   document.getElementById('reviewPendingCount').textContent='92';
   document.getElementById('reviewNavCount').textContent='92';
   document.getElementById('mobileReviewNavCount').textContent='92';
   document.getElementById('reviewSavedAttentionCount').textContent='9';
  }''')
  assert page.locator('#reviewPendingCount').inner_text()=='92'
  assert page.locator('#reviewNavCount').inner_text()=='92'
  assert page.locator('#mobileReviewNavCount').inner_text()=='92'
  assert page.locator('#reviewSavedAttentionCount').inner_text()=='9'
  assert page.locator('#review .review-shared-tag').inner_text()=='Team scan'
  # Test the mobile More drawer separately; its hidden state is intentional until opened.
  page.evaluate("document.querySelector('#mobileNavSheet').hidden=false")
  if width<940:assert page.locator('#mobileReviewNavCount').is_visible()
  scroll=page.evaluate('document.documentElement.scrollWidth')
  assert scroll<=width+2,(width,scroll)
  print(json.dumps({'viewport':width,'pending':92,'saved_needs_correction':9,'no_horizontal_overflow':True}))
  page.close()
 browser.close()
