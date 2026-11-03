"""Visual-polish release invariants; does not require a network or production account."""
import re
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]

def luminance(rgb):
    channels=[int(rgb[i:i+2],16)/255 for i in [1,3,5]]
    vals=[c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4 for c in channels]
    return sum(a*b for a,b in zip((.2126,.7152,.0722),vals))

def contrast(a,b):
    v,w=sorted((luminance(a),luminance(b)),reverse=True)
    return (v+.05)/(w+.05)

class VisualPolishTests(unittest.TestCase):
    def test_consistent_new_logo_and_favicon(self):
        l=(ROOT/'assets/book-logo.svg').read_text()
        f=(ROOT/'assets/favicon.svg').read_text()
        for s in [l,f]:
            root=ET.fromstring(s)
            self.assertEqual(root.attrib.get('viewBox'),'0 0 64 64')
            self.assertIn('#EFB864',s)
        self.assertIn('assets/book-logo.svg',(ROOT/'index.html').read_text())
        self.assertIn('class="spotlight-brand-mark"',(ROOT/'book-of-the-week.html').read_text())
    def test_fonts_and_consistent_visual_tokens(self):
        for page in ['index.html','book-of-the-week.html']:
            self.assertIn('family=Inter', (ROOT/page).read_text())
            self.assertIn('family=Manrope',(ROOT/page).read_text())
        css=(ROOT/'assets/library-ui.css').read_text()
        for token in ['--polish-border','--polish-shadow','--polish-strong',':root[data-theme="dark"]']:
            self.assertIn(token,css)
        self.assertIn('.spotlight-brand-mark',(ROOT/'assets/spotlight-premium.css').read_text())
    def test_core_palette_contrast(self):
        # CSS theme foreground vs. panel background: WCAG 2.2 normal text target 4.5:1.
        for label,fg,bg in [('light body','#193047','#ffffff'),('light muted','#53687a','#ffffff'),
                            ('dark body','#ecf5fc','#13263b'),('dark muted','#b7c9d9','#13263b'),
                            ('hero title','#ffffff','#132f57'),('inventory hero copy','#eaf6fd','#195474')]:
            self.assertGreaterEqual(contrast(fg,bg),4.5,f'{label}: {contrast(fg,bg):.2f}')
    def test_access_code_selection_and_google_mirror_removal_remain(self):
        t=(ROOT/'index.html').read_text()
        self.assertIn("$('signupAdminInvite').hidden=!admin||authMode!=='signup'",t)
        self.assertNotIn('Google Sheets mirror',t)
        self.assertNotIn('script.google.com',t)
if __name__=='__main__':unittest.main()
