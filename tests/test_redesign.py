"""Offline structural regression checks for the November 2026 Library Manager release.
Run from project root: python -m unittest discover -s tests -v
"""
import json
import re
import unittest
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'index.html').read_text()

class ElementIds(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.append(a['id'])

class LibraryReleaseChecks(unittest.TestCase):
    def test_no_mirror_ui_or_network_code(self):
        forbidden = ['Google Sheets mirror', 'sheetLinked(', 'googlePost(', 'googlePing(',
                     'googleBook(', 'googleLoan(', 'googleDeleteBook(', 'syncExisting(',
                     'sheetBox', 'sheetUrl', 'connectorUrl', 'script.google.com']
        for word in forbidden:
            self.assertNotIn(word, HTML, msg=f'Mirror feature remains: {word}')
        self.assertFalse((ROOT / 'Code.gs').exists())

    def test_role_and_admin_code_workflows_preserved(self):
        for word in ['library_claim_admin_access_code','library_rotate_admin_access_code',
                     'signupAccessRole', 'accessRoleControl', 'adminInvitePanel',
                     'createAdminInvite', 'roleLanding()', 'canAccess(']:
            self.assertIn(word, HTML)
        self.assertIn("$('accessRoleControl').hidden=!creating",HTML)

    def test_unified_stylesheet_and_modern_disclosures(self):
        css=(ROOT/'assets/library-ui.css').read_text()
        self.assertEqual(len(re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="assets/[^"]+"',HTML)),1)
        for old in ['assets/role-navigation.css','assets/admin-invitations.css','assets/design-system.css']:
            self.assertFalse((ROOT/old).exists(),old)
        self.assertIn('summary::after',css)
        self.assertIn('background-image:url("data:image/svg+xml',css)
        self.assertIn('transform:none!important',css)
        self.assertIn('.spotlight-admin-manager',css)

    def test_no_duplicate_html_ids(self):
        parser=ElementIds();parser.feed(HTML)
        self.assertEqual(len(parser.ids),len(set(parser.ids)))

    def test_local_assets_linked(self):
        assets=re.findall(r'<(?:script|link)[^>]+(?:src|href)="(assets/[^\"]+)"',HTML)
        self.assertTrue(assets)
        for asset in assets:
            self.assertTrue((ROOT/asset).exists(),asset)

    def test_vercel_configuration_points_to_existing_files(self):
        config=json.loads((ROOT/'vercel.json').read_text())
        for fn in config.get('functions',{}):
            self.assertTrue((ROOT/fn).exists(),fn)
        self.assertNotIn('api/admin-invite.js', config.get('functions',{}))

    def test_visibility_tokens_and_theme(self):
        css=(ROOT/'assets/library-ui.css').read_text()
        self.assertIn(':root[data-theme="dark"]',css)
        self.assertIn(':root[data-theme="light"]',css)
        self.assertIn('.dashboard-metric',css)
        self.assertIn('.hero-library',css)

    def test_public_spotlight_and_protected_admin_publishing(self):
        page=(ROOT/'book-of-the-week.html').read_text()
        js=(ROOT/'assets/book-of-the-week.js').read_text()
        migration=(ROOT/'library_book_of_the_week.sql').read_text()
        for text in ['spotlightCover','spotlightTitle','spotlightAuthor','spotlightDescription','spotlightIsbn']:
            self.assertIn(text,page)
        self.assertIn(".from('library_featured_books')",js)
        self.assertIn('ENABLE ROW LEVEL SECURITY',migration)
        self.assertIn('library_featured_books_admin_update',migration)
        self.assertIn('public.library_member_roles',migration)
        for text in ['spotlightSearch','spotlightSelect','spotlightPublish','spotlightBlurb']:
            self.assertIn(text,HTML)

    def test_registration_admin_code_visibility(self):
        self.assertIn("$('signupAdminInvite').hidden=!admin||authMode!=='signup'",HTML)
        self.assertIn("if(!admin){$('signupInviteCode').value='';$('signupInviteCode').required=false;}",HTML)

    def test_ai_and_excel_and_catalog_untouched(self):
        for fp in ['api/book-vision.js','api/book-lookup.js','api/title-search.js',
                   'assets/review-excel.js','assets/scanned-books.js']:
            self.assertTrue((ROOT/fp).is_file())

if __name__ == '__main__':
    unittest.main()
