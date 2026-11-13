from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
source=(root/'index.html').read_text()
bs=BeautifulSoup(source,'html.parser')
scan=bs.select_one('#scanLiveProgressPanel')
history=bs.select_one('#scanRecentSummary')
css=(root/'assets/library-manager-v542.css').read_text()
ui=(root/'assets/premium-progress-upload.js').read_text()
start=source.index('function scanHistoryBreakdown(')
end=source.index('function scanRecoveryNotice(',start)
renderer=source[start:end]
html='''<!DOCTYPE html><html lang="en" data-theme="light"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>'''+css+'''</style></head><body data-account="in" data-role="admin"><main id="shelfScan" style="max-width:1020px;margin:0 auto;padding:12px"><div style="margin:24px 0 14px"><h2 style="margin:0;color:var(--ink)">Scan workspace</h2><p style="color:var(--muted)">Automatic book recognition and recent results</p></div>'''+str(scan)+str(history)+'''</main></body></html>'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in (320,360,390,540,768,1024,1440):
  page=browser.new_page(viewport={'width':width,'height':900})
  page.set_content(html)
  page.add_script_tag(content='const $ = id => document.getElementById(id);'+renderer)
  page.add_script_tag(content=ui)
  page.evaluate("""() => {
    document.querySelector('#scanRecentSummary').hidden=false;
    renderRecentScan({total:100,saved:61,review:27,skipped:12,failed:0,finishedAt:Date.now()});
    const panel=document.querySelector('#scanLiveProgressPanel');panel.hidden=true;
  }""")
  expect_counts={'scanRecentSaved':'61','scanRecentReview':'27','scanRecentSkipped':'12','scanRecentTotal':'100','scanRecentFailed':'0'}
  for key,val in expect_counts.items(): assert page.locator('#'+key).inner_text()==val,(width,key)
  for key,val in {'scanRecentSavedRate':'61% of photos','scanRecentReviewRate':'27% of photos','scanRecentSkippedRate':'12% of photos'}.items(): assert page.locator('#'+key).inner_text()==val,(width,key)
  assert page.locator('#scanRecentSummary').is_visible()
  assert page.evaluate('document.documentElement.scrollWidth')<=width+1,(width,page.evaluate('document.documentElement.scrollWidth'))
  if width in (390,1440):
   page.locator('#scanRecentSummary').screenshot(path=str(root.parent/f'LibraryManager_v5.53_Scan_History_{width}.png'))
  # Active phase: no actual x / y counter, only percentage.
  page.evaluate("""() => {
    document.querySelector('#scanRecentSummary').hidden=true;
    document.querySelector('#scanLiveProgressPanel').hidden=false;
    const progress=document.querySelector('#batchProgress');progress.max=1000;progress.value=635;progress.dataset.scanMode='true';progress.dataset.scanTotal='100';progress.dataset.scanPrepared='90';progress.dataset.scanChecked='82';progress.dataset.scanScanned='60';progress.dataset.scanSkipped='5';
    document.querySelector('#batchStatus').textContent='Recognizing covers and checking book details…';
    window.LibraryProgressUI?.refresh();
  }""")
  page.wait_for_timeout(80)
  percent=page.locator('#batchProgressPercent').inner_text()
  assert percent=='64%',(width,percent)
  assert page.locator('#batchProgressCount').count()==0
  assert '/' not in page.locator('.premium-progress').inner_text(),(width,page.locator('.premium-progress').inner_text())
  assert page.evaluate('document.documentElement.scrollWidth')<=width+1,(width,page.evaluate('document.documentElement.scrollWidth'))
  expected=181 if width<=540 else 166
  height=page.locator('.premium-progress').bounding_box()['height'];assert abs(height-expected)<1.5,(width,height)
  if width in (390,1440):page.locator('#scanLiveProgressPanel').screenshot(path=str(root.parent/f'LibraryManager_v5.53_Percent_Scanning_{width}.png'))
  print(json.dumps({'width':width,'scan_percent':percent,'history_inventory':61,'history_review':27,'history_skipped':12,'meter_height':height}))
  page.close()
 # dark mode
 page=browser.new_page(viewport={'width':390,'height':900})
 page.set_content(html.replace('lang="en" data-theme="light"','lang="en" data-theme="dark"'))
 page.add_script_tag(content='const $ = id => document.getElementById(id);'+renderer)
 page.evaluate("""() => {renderRecentScan({total:100,saved:61,review:27,skipped:12,failed:0,finishedAt:Date.now()});document.querySelector('#scanLiveProgressPanel').hidden=true;}""")
 assert page.evaluate('document.documentElement.scrollWidth')<=391
 page.locator('#scanRecentSummary').screenshot(path=str(root.parent/'LibraryManager_v5.53_Scan_History_Dark_Mobile.png'))
 browser.close()
