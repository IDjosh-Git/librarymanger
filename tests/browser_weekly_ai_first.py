from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
script="""
window.supabase={createClient:()=>({rpc:async name=>({error:null,data:[{title:'Manual fallback title',authors:'Manual Author',isbn:'9780143127741',why_selected:'A manual backup selection.',week_start:'2026-11-09',selection_source:'manual'}]}),from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({error:null,data:null})})})})})};
window.fetch=async(url)=>{if(String(url).startsWith('/api/weekly-pick?ensure=1'))return {ok:true,json:async()=>({status:'published',week:'2026-11-09',pick:{title:'AI Inventory Pick',authors:'AI Source Author',isbn:'9780143127741',why_selected:'Verified recommendation chosen by AI.',reading_hook:'AI FIRST HOOK',ideal_for:'Curious readers',discussion_question:'What do you discover?',week_start:'2026-11-09',selection_source:'ai'}})};throw new Error('offline external catalogue')};
void 0;
"""
def dom(ids):
 return '<html><head><title>test</title></head><body>'+''.join(f'<img id="{x}">' if x in ('spotlightCover','guideCover') else f'<div id="{x}"></div>' for x in ids)+'</body></html>'
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page()
 ids='spotlightTitle spotlightAuthor spotlightIsbn spotlightShelf spotlightSource spotlightEdition spotlightOverline spotlightRibbonLabel spotlightDescription spotlightWhy weeklyReasonTitle spotlightWeek weeklyEditionTag weeklyReasonFoot spotlightAudience spotlightHook spotlightQuestion spotlightPublished spotlightCover askFeaturedBook shareSpotlight'.split()
 page.set_content(dom(ids));page.evaluate(script)
 page.add_script_tag(path=str(ROOT/'assets/book-of-the-week.js'))
 page.wait_for_function("document.getElementById('spotlightTitle').textContent==='AI Inventory Pick'",timeout=5000)
 assert page.locator('#spotlightSource').inner_text()=='AI + library catalogue'
 print('Public spotlight AI replacement: PASS')
 page2=browser.new_page()
 ids='guideTitle guideByline guideIntro guideReason guideAudience guideQuestion guideShelf guideIsbn guideSource guideCover guideEdition guideSourceLink guideSearchLink guideStatus guideSummary guideEvidence guideSubjects guideShare guideTheme'.split()
 page2.set_content(dom(ids));page2.evaluate(script)
 page2.add_script_tag(path=str(ROOT/'assets/reading-guide.js'))
 page2.wait_for_function("document.getElementById('guideTitle').textContent==='AI Inventory Pick'",timeout=5000)
 assert page2.locator('#guideIntro').inner_text()=='AI FIRST HOOK'
 print('Reading guide AI replacement: PASS')
 browser.close()
