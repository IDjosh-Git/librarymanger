from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
modules=['book-identifiers.js','scan-extraction.js','scan-auto-route.js','scan-inventory-match.js','inventory-grouping.js']
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in (320,390,768,1440):
  page=browser.new_page(viewport={'width':width,'height':900})
  page.set_content('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body><main>Library Manager book lookup verification</main></body></html>')
  for name in modules: page.add_script_tag(content=(root/'assets'/name).read_text())
  result=page.evaluate('''() => {
    const value='978047045571551234';
    const ids=LibraryBookIdentifiers;
    const book={title:'The Complete Migration Handbook',authors:'J. Editor',barcode:'9780470455715',publisher:'Acme Press'};
    const m=LibraryInventoryScanMatch.match('The Complete Migration Handbook\\nby J. Editor',[book],LibraryScan,value);
    return {isbn:ids.normalize(value),valid:ids.valid(value),route:LibraryScanAutoRoute.decide({barcode:value,title:'The Complete Migration Handbook',verifiedSource:'isbn'}),editionMatched:m?.editionMatched,inventory:LibraryInventoryGrouping.isbn13(value)};
  }''')
  assert result=={'isbn':'9780470455715','valid':True,'route':'inventory','editionMatched':True,'inventory':'9780470455715'},result
  assert page.evaluate('document.documentElement.scrollWidth')<=width
  print(width,'browser modules and canonical ISBN route PASS')
  page.close()
 browser.close()
