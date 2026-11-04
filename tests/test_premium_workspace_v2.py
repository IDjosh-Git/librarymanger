"""Premium UI structural regression tests. These do not contact the live database."""
from pathlib import Path
from collections import Counter
from bs4 import BeautifulSoup
import unittest

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text()
CSS=(ROOT/'assets/library-ui.css').read_text()
SPOTLIGHT=(ROOT/'assets/spotlight-premium.css').read_text()
SOUP=BeautifulSoup(HTML,'html.parser')

class PremiumWorkspaceV2Tests(unittest.TestCase):
    def test_header_actions_have_one_purpose_each(self):
        header=SOUP.select_one('header .head-actions')
        self.assertIsNotNone(header)
        self.assertFalse(header.select('.header-contact-link,.spotlight-header-link,.header-tag'))
        self.assertEqual([e.get('id') for e in header.select('button')],['notificationBell','themeToggle','commandOpen'])

    def test_unique_html_ids(self):
        counts=Counter(node['id'] for node in SOUP.select('[id]'))
        self.assertEqual([name for name,count in counts.items() if count>1],[])

    def test_main_navigation_has_unique_destinations(self):
        pages=[e['data-tab'] for e in SOUP.select('.workspace-nav [data-tab]')]
        self.assertEqual(len(pages),len(set(pages)))
        self.assertEqual(set(pages),{'dashboard','inventory','shelfScan','featuredAdmin','scanned','notifications','history','contactSettings','lend','return'})

    def test_quick_tools_are_explicit_disclosure(self):
        details=SOUP.select_one('details.workspace-utilities')
        self.assertIsNotNone(details)
        self.assertFalse(details.has_attr('open'))
        self.assertEqual(len(details.select('[data-nav-action]')),3)
        self.assertIsNotNone(SOUP.select_one('#navImportShelf'))

    def test_scanner_preserves_workflow(self):
        self.assertIsNotNone(SOUP.select_one('#shelfScan>.scanned-review-section>.batch-box'))
        self.assertEqual(len(SOUP.select('.scan-workflow-steps span')),3)
        for item in ('batchFolder','batchZip','batchPhotos','batchStart','batchResults','batchSave','batchUseOCR','batchUseAI'):
            self.assertIsNotNone(SOUP.select_one('#'+item),item)

    def test_theme_buttons_have_distinct_icons(self):
        self.assertIsNotNone(SOUP.select_one('#themeToggle .mode-moon use[href$="#moon"]'))
        self.assertIsNotNone(SOUP.select_one('#themeToggle .mode-sun use[href$="#sun"]'))
        self.assertIn(':root[data-theme="dark"] body[data-account="in"] .auth .workspace-nav',CSS)

    def test_single_maintained_main_stylesheet(self):
        local=[e['href'] for e in SOUP.select('link[rel="stylesheet"]') if e.get('href','').startswith('assets/')]
        self.assertEqual(local,['assets/library-ui.css','assets/book-guide.css'])
        self.assertIn('Premium Library Workspace v2',CSS)
        self.assertIn('prefers-reduced-motion:reduce',CSS)

    def test_fade_to_image_headers_and_one_scanner_surface(self):
        self.assertIn('#dashboard .dashboard-hero{background-image:linear-gradient',CSS)
        self.assertIn("url('./library-reading-fallback.jpg')",CSS)
        self.assertIn('#shelfScan .batch-box',CSS)
        self.assertIn('background:var(--lp-paper)!important;border:0!important',CSS)

    def test_context_changes_with_active_page(self):
        self.assertIsNotNone(SOUP.select_one('#headerContextName'))
        self.assertIn("contextTitle.textContent=workspaceTitles[name]",HTML)

    def test_public_book_theme_is_aligned(self):
        self.assertIn('Book of the Week — aligned editorial face',SPOTLIGHT)
        self.assertIn(':root[data-theme="dark"]',SPOTLIGHT)

if __name__=='__main__':unittest.main()
