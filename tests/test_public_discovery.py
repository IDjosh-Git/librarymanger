"""Offline regression checks: public discovery, contact editing and circulation UI."""
import re
import unittest
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT/'index.html').read_text()
PUBLIC = (ROOT/'book-of-the-week.html').read_text()
APP_CSS = (ROOT/'assets/library-ui.css').read_text()
PUBLIC_CSS = (ROOT/'assets/spotlight-premium.css').read_text()
CONTACT = (ROOT/'assets/public-contact.js').read_text()
FEATURE = (ROOT/'assets/book-of-the-week.js').read_text()
SQL = (ROOT/'library_public_discovery_upgrade.sql').read_text()

class Scan(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]
    def handle_starttag(self, tag, attrs):
        d=dict(attrs)
        if d.get('id'): self.ids.append(d['id'])

class DiscoveryTests(unittest.TestCase):
    def test_unique_html_ids(self):
        for html in [APP, PUBLIC]:
            scan=Scan();scan.feed(html)
            self.assertEqual(len(scan.ids),len(set(scan.ids)))

    def test_manual_and_automatic_feature(self):
        self.assertIn("db.rpc('library_public_featured_book')", FEATURE)
        self.assertIn("selection_source==='automatic'", FEATURE)
        self.assertIn("$('spotlightAuto').addEventListener", APP)
        self.assertIn("sb.from(SPOTLIGHT_TABLE).delete().eq('id',1)",APP)
        self.assertIn('NOT EXISTS (SELECT 1 FROM manual)',SQL)
        self.assertIn("'IYYY-IW'",SQL)
        self.assertIn("'automatic'::text",SQL)
        self.assertIn('SECURITY DEFINER SET search_path=\'\'',SQL)
        self.assertIn('REVOKE ALL ON FUNCTION public.library_public_featured_book() FROM PUBLIC', SQL)
        self.assertIn('GRANT EXECUTE ON FUNCTION public.library_public_featured_book() TO anon,authenticated',SQL)
        self.assertNotIn('borrower_name',SQL.lower())
        self.assertNotIn('loan_id',SQL.lower())

    def test_contact_editor_protected_by_role(self):
        self.assertIn('id="contactSettings"',APP)
        self.assertIn('data-tab="contactSettings"',APP)
        self.assertIn('data-mobile-tab="contactSettings"',APP)
        self.assertIn('const ADMIN_PAGES=new Set(["dashboard","inventory","scanned","notifications","history","contactSettings"])',APP)
        self.assertIn("if(!isAdmin()||!session?.user)return msg('Admin permission required.'",APP)
        self.assertIn('library_contact_admin_insert',SQL)
        self.assertIn('library_contact_admin_update',SQL)
        self.assertIn("r.role='admin'",SQL)
        self.assertIn('ALTER TABLE public.library_public_contact ENABLE ROW LEVEL SECURITY',SQL)
        self.assertIn('REVOKE ALL ON public.library_public_contact FROM PUBLIC, anon, authenticated',SQL)
        self.assertNotIn('GRANT SELECT (updated_by',SQL)

    def test_links_render_safely(self):
        self.assertIn("u.protocol==='https:'",CONTACT)
        self.assertIn('a.rel=\'noopener noreferrer\'',CONTACT)
        self.assertIn('u.hostname.toLowerCase()',CONTACT)
        self.assertIn("document.createElement('a')",CONTACT)
        self.assertNotIn('innerHTML',CONTACT)
        for key in ['facebook','instagram','whatsapp','youtube','tiktok','x_url','email','phone','website']:
            self.assertIn(key,CONTACT)
        self.assertIn('data-public-socials',APP)
        self.assertIn('data-public-socials',PUBLIC)

    def test_circulation_redesign_and_disclosures(self):
        self.assertEqual(APP.count('class="circulation-stepper"'),2)
        self.assertIn('id="confirmLend"',APP)
        self.assertIn('id="confirmReturn"',APP)
        self.assertIn('select:not([multiple])',APP_CSS)
        self.assertIn('details)[open]>summary :is(span,strong,small,b,svg)',APP_CSS)
        self.assertIn('.spotlight-contact',PUBLIC_CSS)
        self.assertIn('href="#publicContactArea"',PUBLIC)
        self.assertNotIn('script.google.com',APP+CONTACT+FEATURE)

if __name__=='__main__':unittest.main()
