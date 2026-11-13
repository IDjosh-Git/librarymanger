from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
soup=BeautifulSoup((root/'index.html').read_text(),'html.parser')
shelf=soup.select_one('#shelfScan')
shelf['class']=shelf.get('class',[])+['active']
content=str(shelf)
css=(root/'assets/library-manager-v542.css').read_text()
ui=(root/'assets/premium-progress-upload.js').read_text()
html='<html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body data-account="in"><main style="max-width:1320px;margin:auto;">'+content+'</main></body></html>'
steps=[
 ('idle','Choose book photos to begin automatic scanning.','Ready to scan','0%',0),
 ('preparing','Preparing photos 117 of 117 while scanning 0…','Preparing images','15%',0),
 ('working','Scanning while photos are prepared: 23 scanned · 1 duplicates skipped · 116 of 117 checked','Scanning books','48%',48),
 ('long','This is an extremely long status: '+('Multiple catalogue providers are unavailable, OCR is still extracting text from a high-resolution sideways book cover. ' * 9),'Recognizing covers','73%',73),
 ('sync','Scanning completed. Confirming automatic Inventory saves and Review cloud sync…','Finalizing cloud saves','100%',100),
 ('complete','Completed: 102 saved to Inventory · 11 sent to Review · 4 skipped.','Completed','100%',100)
]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in (320,360,390,600,768,1024,1440):
  page=browser.new_page(viewport={'width':width,'height':900})
  page.set_content(html)
  page.add_script_tag(content=ui)
  card=page.locator('#shelfScan .scan-auto-progress-shell .premium-progress')
  expected=181 if width<=540 else 166
  heights=[]
  for state,message,stage,percent,val in steps:
   page.evaluate('''({message,stage,percent,val})=>{
    document.querySelector('#batchStatus').textContent=message;
    document.querySelector('#batchProgressStage').textContent=stage;
    document.querySelector('#batchProgressPercent').textContent=percent;
    document.querySelector('#batchProgress').value=val*10;
    document.querySelector('#batchProgress').max=1000;
    document.querySelector('#batchProgress').dataset.scanMode='true';
    document.querySelector('#batchProgress').dataset.scanTotal='117';
    document.querySelector('#batchProgress').dataset.scanPrepared='116';
    document.querySelector('#batchProgress').dataset.scanChecked='116';
    document.querySelector('#batchProgress').dataset.scanScanned='23';
    document.querySelector('#batchProgress').dataset.scanSkipped='1';
    document.querySelector('#batchProgressHint').textContent=message.repeat(2);
   }''',{'message':message,'stage':stage,'percent':percent,'val':val})
   page.wait_for_timeout(35)
   height=card.bounding_box()['height'];heights.append(round(height,2))
   if width in (390,1440) and state=='working':card.screenshot(path=str(root/f'LibraryManager_v549_Scan_Progress_{width}.png'))
   assert abs(height-expected)<=1.5,(width,state,height,expected)
   assert page.locator('#batchProgressCount').count()==0, 'Raw photo counters should not appear in scanning progress'
   assert '%' in page.locator('#batchProgressPercent').inner_text(), 'Progress should be shown as a percentage'
  overflow=page.evaluate('document.documentElement.scrollWidth')
  assert overflow<=width+1,(width,overflow)
  assert page.locator('#batchStatus').is_visible()
  print(json.dumps({'width':width,'card_heights':heights,'page_width':overflow}))
  if width in (390,1440):page.screenshot(path=str(root/f'v549-scan-progress-{width}.png'),full_page=False)
  page.close()
 browser.close()
