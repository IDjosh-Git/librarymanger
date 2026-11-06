"""Verifies mobile modal semantics and browser scroll-lock source invariants."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
JS=(ROOT/'assets/book-guide.js').read_text()
CSS=(ROOT/'assets/book-guide.css').read_text()
PAGE=(ROOT/'index.html').read_text()
API=(ROOT/'api/book-vision.js').read_text()
class MobileGuideAndCover(unittest.TestCase):
 def test_mobile_sheet_lock_restore(self):
  for q in ('lockBackground()', 'unlockBackground()', 'body.style.position=\'fixed\'', 'root.scrollTo(0,state.y)', "$('bookGuideBackdrop').addEventListener('click',close)", "e.key==='Tab'&&lockedPage", 'window.visualViewport?.addEventListener'):
   self.assertIn(q,JS)
  for q in ('--guide-vv-height','overscroll-behavior:contain','@media(max-width:899px)','book-guide-backdrop'):
   self.assertIn(q,CSS)
 def test_cover_assisted_review(self):
  for q in ('data-batch-ai="${i}"', "forceAI:withOCR==='ai'", 'applyCoverCatalogMatch(row)', 'row.matches=await findOCRCatalogMatches(row)', "row.title=possible", "row.aiNotice"):
   self.assertIn(q,PAGE)
  for q in ('publication_year','publisher','TimeoutError','maxOutputTokens:480'):
   self.assertIn(q,API)
 def test_existing_scanner_optin_and_review_gate(self):
  self.assertIn('id="batchUseAI" type="checkbox"',PAGE)
  self.assertIn("x.reviewApproval===reviewFingerprint(x)",PAGE)
  self.assertIn("if(!(force||$('batchUseAI')?.checked))return false",PAGE)
if __name__=='__main__':unittest.main()
