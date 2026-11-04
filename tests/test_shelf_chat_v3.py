"""New V3 page separation, grounded chat and fast-scan regression checks."""
from pathlib import Path
from bs4 import BeautifulSoup
from collections import Counter
import unittest
ROOT=Path(__file__).resolve().parents[1]
APP=(ROOT/'index.html').read_text();PUBLIC=(ROOT/'book-of-the-week.html').read_text()
SOUP=BeautifulSoup(APP,'html.parser')
class ShelfStudioV3(unittest.TestCase):
 def test_inventory_is_only_inventory(self):
  inventory=SOUP.select_one('#inventory');self.assertIsNotNone(inventory)
  for selector in ('.scanned-review-section','#inventoryQuickAdd','#spotlightManager','#batchFolder','#batchStart'):
   self.assertIsNone(inventory.select_one(selector),selector)
  self.assertIsNotNone(inventory.select_one('#inventoryCatalog'))
  self.assertIsNotNone(inventory.select_one('[data-tab-go="shelfScan"]'))
 def test_independent_scan_and_editor(self):
  scan=SOUP.select_one('#shelfScan');self.assertIsNotNone(scan)
  for id in ('batchStart','batchFolder','batchZip','batchPhotos','batchResults','batchSave','batchExportExcel','batchExcelFile','inventoryQuickAdd','manualBarcode'):
   self.assertIsNotNone(scan.select_one('#'+id),id)
  self.assertIsNotNone(SOUP.select_one('#featuredAdmin #spotlightManager'))
 def test_nav_permissions_and_unique_ids(self):
  ids=[tag['id'] for tag in SOUP.select('[id]')];self.assertEqual(len(ids),len(set(ids)))
  self.assertIn('"shelfScan","featuredAdmin"',APP)
  self.assertIn('data-mobile-tab="shelfScan"',APP)
  self.assertIn('data-tab="shelfScan"',APP)
  self.assertNotIn('const USER_PAGES=new Set(["lend","return","shelfScan"])',APP)
 def test_book_guide_on_all_three_surfaces(self):
  js=(ROOT/'assets/book-guide.js').read_text();api=(ROOT/'api/book-chat.js').read_text()
  self.assertIn('assets/book-guide.js',APP);self.assertIn('assets/book-guide.js',PUBLIC)
  self.assertIn('Book Guide',js);self.assertIn('setBooks',js)
  self.assertIn('data-book-chat',APP);self.assertIn('id="askLendBook"',APP)
  self.assertIn('id="askFeaturedBook"',PUBLIC)
  self.assertIn('GEMINI_API_KEY',api);self.assertIn('no-store',api)
  self.assertNotIn('borrower_name',api)
 def test_speed_fallback_and_accessibility(self):
  self.assertIn('maxOCRWorkers()',APP)
  self.assertIn('acquireOCRWorker()',APP)
  self.assertIn('Promise.all(Array.from({length:',APP)
  js=(ROOT/'assets/book-guide.js').read_text()
  self.assertIn('aria-expanded',js);self.assertIn('aria-live',js)
  self.assertIn('Reading tip:',js)
if __name__=='__main__': unittest.main()
