"""Regression checks for the role-aware November 2026 navigation and overview release."""
from pathlib import Path
from html.parser import HTMLParser
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'index.html').read_text()
CSS = (ROOT / 'assets/library-ui.css').read_text()

class IDCollector(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids = []
    def handle_starttag(self, tag, attrs):
        ident = dict(attrs).get('id')
        if ident: self.ids.append(ident)

class NavigationAndOverviewChecks(unittest.TestCase):
    def test_unique_ids(self):
        collector = IDCollector(); collector.feed(HTML)
        self.assertEqual(len(collector.ids), len(set(collector.ids)))

    def test_admin_and_user_destinations_preserved(self):
        self.assertEqual(set(re.findall(r'data-tab="([^"]+)"', HTML)),
                         {'dashboard','inventory','shelfScan','featuredAdmin','scanned','notifications','history','contactSettings','lend','return'})
        self.assertIn('const ADMIN_PAGES=new Set(["dashboard","inventory","shelfScan","featuredAdmin","scanned","notifications","history","contactSettings"])', HTML)
        self.assertIn('const USER_PAGES=new Set(["lend","return"])', HTML)
        self.assertIn("if(!session?.user||!isAdmin())return;", HTML)
        self.assertIn('book-of-the-week.html', HTML)

    def test_mobile_all_destinations_and_accessible_dialog(self):
        self.assertEqual(set(re.findall(r'data-mobile-tab="([^"]+)"', HTML)),
                         {'dashboard','inventory','shelfScan','featuredAdmin','scanned','notifications','history','contactSettings','lend','return'})
        self.assertIn('aria-labelledby="mobileNavTitle"', HTML)
        self.assertIn('aria-controls="mobileNavSheet"', HTML)
        self.assertIn('function closeMobileMenu()', HTML)
        self.assertIn('if(canAccess(page.dataset.mobileTab))', HTML)
        self.assertIn('roleLanding()', HTML)

    def test_overview_preserves_metrics_and_activity(self):
        for target in ['dashboardRefresh','dashDistinctBooks','dashTotalCopies','dashAvailableCopies',
                       'dashBorrowedCopies','dashAttentionBooks','dashOverdueLoans','dashboardActivity',
                       'dashboardTrend','dashboardHealthRing','dashboardDueList','dashboardPopular']:
            self.assertIn('id="'+target+'"', HTML, target)
        self.assertIn('id="overviewInsights"', HTML)
        self.assertIn('data-dashboard-action="scanned"', HTML)
        self.assertIn('data-dashboard-action="notifications"', HTML)
        self.assertIn('dashboardRefresh', CSS + HTML)

    def test_mobile_and_dark_contrast_styles(self):
        self.assertIn('body[data-account="in"][data-role="admin"] .bottomnav', CSS)
        self.assertIn('grid-template-columns:repeat(4,minmax(0,1fr))!important', CSS)
        self.assertIn('grid-template-columns:repeat(3,minmax(0,1fr))!important', CSS)
        self.assertIn(':root[data-theme="dark"] .overview-refresh', CSS)
        self.assertIn('#dashboard .dashboard-hero .dashboard-hero-art{display:none!important}', CSS)

if __name__ == '__main__':
    unittest.main()
