"""Real Chromium smoke test of the premium inventory filter modal using original
HTML/CSS and exact JS open/cancel/restore/apply functions in a network-isolated fixture."""
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parents[1]
h=P.joinpath('index.html').read_text()
css=P.joinpath('assets/library-ui.css').read_text()
s=BeautifulSoup(h,'html.parser')
root=s.find(id='inventoryCatalog')
assert root
# Browser fixture contains real inventory toolbar, filter panel and its original chips.
contents=str(root)
source=h[h.index('let inventoryFilterSnapshot=null'):h.index('function hasBookTitle')]
sync=h[h.index('function syncColumnFilterUI(){'):h.index('// The choice list is based')]
js='''
const $=id=>document.getElementById(id);
let bookFilter='all',qualityFilter='all',bookSearch='',columnFilters={},selectedColumnValues={},bookPage=1,bookRenderTimer=null;
const LibraryInventoryColumnFilters={empty:()=>({}),active:(f,s)=>[...new Set([...Object.entries(f).filter(([k,v])=>String(v).trim()).map(([k])=>k),...Object.entries(s).filter(([k,v])=>v.length).map(([k])=>k)])]};
function setPressed(type,value){document.querySelectorAll(`[data-${type}-filter]`).forEach(b=>{const on=b.dataset[type+'Filter']===value;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))})}
function resetColumnFilterInputs(){document.querySelectorAll('[data-column-filter]').forEach(el=>el.value='')}
function showColumnValuePicker(key){document.querySelector('#columnValuePicker').hidden=false;document.querySelector('#columnValueTitle').textContent=key+' · select values';}
const fakeBooks=[{title:'Things Fall Apart',authors:'Chinua Achebe',available:3},{title:'Atomic Habits',authors:'James Clear',available:0},{title:'Dune',authors:'Frank Herbert',available:2},{title:'',authors:'',available:1},{title:'The Alchemist',authors:'Paulo Coelho',available:2}];
function renderBooks(){
 let matches=fakeBooks.filter(x=>(bookFilter==='all'||bookFilter==='available'&&x.available>0||bookFilter==='borrowed'&&x.available===0||bookFilter==='overdue'&&x.available===0)&&(qualityFilter==='all'||qualityFilter==='full'&&!!x.title||qualityFilter==='attention'&&!x.title||qualityFilter==='no-title'&&!x.title)&&(!columnFilters.title||x.title.toLowerCase().includes(columnFilters.title.toLowerCase())));
 const resultCount=$('inventoryFilterResultCount'),applyButton=$('inventoryFiltersApply');
 if(resultCount)resultCount.textContent=`${matches.length} matching titles`;
 if(applyButton)applyButton.textContent=`Show ${matches.length} titles`;
 syncColumnFilterUI();
}
''' +sync+'\n'+source+'''
$('toggleColumnFilters').onclick=()=>setColumnFiltersOpen(!$('columnFiltersPanel').open);
$('columnFiltersClose').onclick=()=>setColumnFiltersOpen(false);
$('inventoryFiltersReset').onclick=resetAllInventoryFilters;
$('inventoryFiltersCancel').onclick=()=>closeInventoryFilter(false);
$('inventoryFiltersApply').onclick=()=>closeInventoryFilter(true);
$('columnFiltersPanel').addEventListener('cancel',e=>{e.preventDefault();closeInventoryFilter(false)});
document.querySelectorAll('[data-book-filter]').forEach(b=>b.onclick=()=>{bookFilter=b.dataset.bookFilter;bookPage=1;setPressed('book',bookFilter);renderBooks()});
document.querySelectorAll('[data-quality-filter]').forEach(b=>b.onclick=()=>{qualityFilter=b.dataset.qualityFilter;bookPage=1;setPressed('quality',qualityFilter);renderBooks()});
document.querySelectorAll('[data-show-column-values]').forEach(b=>b.addEventListener('click',()=>showColumnValuePicker(b.dataset.showColumnValues)));
$('columnFiltersPanel').addEventListener('input',e=>{let k=e.target.dataset.columnFilter;if(k){columnFilters[k]=e.target.value;renderBooks()}});
renderBooks();
'''
base='''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="inventory" class="panel active"><main class="inventory-demo">%CONTENTS%</main></div><div class="demo-bg">Background library scroll content</div></body></html>'''.replace('%CONTENTS%',contents)
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'])
 for theme in ['light','dark']:
  for width,height in [(320,700),(390,844),(768,860),(1440,900)]:
   page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
   page.set_default_timeout(12000)
   page.set_content(base,wait_until='load')
   page.add_style_tag(content=css+'''\n.inventory-demo{max-width:1180px;margin:40px auto;padding:0 14px;} .demo-bg{height:3000px;}#inventory .inventory-workspace-card{max-width:100%}''')
   page.add_script_tag(content=js)
   page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme)
   page.evaluate('window.scrollTo(0,450)')
   before=page.evaluate('window.scrollY')
   page.locator('#toggleColumnFilters').click()
   assert page.locator('#columnFiltersPanel').evaluate('(el)=>el.open'), (width,theme,'not opened')
   state=page.evaluate('''()=>({rect:document.querySelector('#columnFiltersPanel').getBoundingClientRect().toJSON(),scrollWidth:document.documentElement.scrollWidth,htmlOverflow:document.documentElement.classList.contains('inventory-filter-modal-open'),bodyPosition:document.body.style.position,backdropFocus:document.activeElement?.id,scrollContainer:document.querySelector('#inventoryFilterBody').scrollHeight>document.querySelector('#inventoryFilterBody').clientHeight})''')
   assert state['rect']['width']<=width+2,(width,theme,state)
   assert state['rect']['height']<=height+2,(width,theme,state)
   assert state['scrollWidth']<=width+3,(width,theme,state)
   assert state['bodyPosition']=='', 'body position is set through class, not inline'
   assert state['htmlOverflow']
   if width<=700: assert state['rect']['height']>=height-2,(width,theme,state)
   page.locator('[data-book-filter="available"]').click()
   assert page.locator('[data-book-filter="available"]').get_attribute('aria-pressed')=='true'
   page.locator('[data-quality-filter="full"]').click()
   assert page.locator('#columnFilterBadge').inner_text()=='2',(width,theme)
   # Dismiss discards changes
   page.keyboard.press('Escape')
   assert not page.locator('#columnFiltersPanel').evaluate('(el)=>el.open')
   page.wait_for_timeout(45)
   assert page.locator('[data-book-filter="all"]').get_attribute('aria-pressed')=='true',page.evaluate('''()=>({bookFilter,qualityFilter,selected:document.querySelector('[data-book-filter=\"all\"]').outerHTML})''')
   assert page.locator('[data-quality-filter="all"]').get_attribute('aria-pressed')=='true'
   assert page.locator('#columnFilterBadge').is_hidden()
   assert abs(page.evaluate('window.scrollY')-before)<=3,(width,theme,before,page.evaluate('window.scrollY'))
   # Apply saves filters, then reopen and reset
   page.locator('#toggleColumnFilters').click()
   page.locator('[data-book-filter="borrowed"]').click()
   page.locator('#inventoryFiltersApply').click()
   assert page.locator('[data-book-filter="borrowed"]').get_attribute('aria-pressed')=='true'
   assert page.locator('#columnFilterBadge').inner_text()=='1'
   page.locator('#toggleColumnFilters').click()
   page.locator('#inventoryFiltersReset').click()
   page.locator('#inventoryFiltersApply').click()
   assert page.locator('[data-book-filter="all"]').get_attribute('aria-pressed')=='true',page.evaluate('''()=>({bookFilter,qualityFilter,all:document.querySelector('[data-book-filter=\"all\"]').outerHTML,borrowed:document.querySelector('[data-book-filter=\"borrowed\"]').outerHTML})''')
   if width in (390,1440):
    page.locator('#toggleColumnFilters').click()
    page.screenshot(path=str(P/f'tests/inventory_filter_{width}_{theme}.png'),animations='disabled',full_page=False)
    page.locator('#inventoryFiltersCancel').click()
   print('PASS',theme,width,'modal / scroll / Cancel / Apply / Reset / overflow')
   page.close()
 browser.close()
