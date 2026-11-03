"""Checks that the signed-in navigation stays white and scrolls within the card."""
from pathlib import Path
import unittest

CSS = (Path(__file__).resolve().parents[1] / 'assets/library-ui.css').read_text()

class WhiteSidebarTests(unittest.TestCase):
    def test_white_sidebar_for_both_themes(self):
        self.assertIn('body[data-account="in"] .layout > .auth', CSS)
        self.assertIn('background:#fff!important;', CSS)
        self.assertIn('body[data-account="in"] .auth .workspace-nav {', CSS)
        self.assertIn('animation:none!important;', CSS)

    def test_scrollbar_is_on_inner_content_not_outer_card(self):
        self.assertIn('overflow:hidden!important;', CSS)
        self.assertIn('body[data-account="in"] .auth .pad.auth-content::-webkit-scrollbar', CSS)
        self.assertIn('scrollbar-gutter:stable;', CSS)
        self.assertIn('overscroll-behavior-y:contain;', CSS)

    def test_inactive_navigation_labels_override_dark_theme(self):
        self.assertIn('.tab:not(.active):not([aria-current="page"])', CSS)
        self.assertIn('color:#274158!important;', CSS)

    def test_small_screens_have_normal_scroll_flow(self):
        self.assertIn('body[data-account="in"] .auth .pad.auth-content {\n    height:auto!important;max-height:none!important;', CSS)

if __name__ == '__main__':
    unittest.main()
