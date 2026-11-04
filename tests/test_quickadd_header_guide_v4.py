"""V4 UI regression tests: standalone quick-add, top controls and educational guide note."""
import unittest
from pathlib import Path
from collections import Counter
from bs4 import BeautifulSoup
R=Path(__file__).resolve().parents[1]
S=BeautifulSoup((R/'index.html').read_text(),'html.parser')
class ModernPolishV4(unittest.TestCase):
 def test_quick_add_in_shelf_studio_not_inventory(self):
  self.assertIsNotNone(S.select_one('#shelfScan #inventoryQuickAdd #manualBarcode'))
  self.assertIsNone(S.select_one('#inventory #inventoryQuickAdd'))
  self.assertIsNotNone(S.select_one('#shelfScan #inventoryQuickAdd #addManual'))
 def test_quick_add_is_one_purpose_built_card(self):
  card=S.select_one('#inventoryQuickAdd .inventory-command-card')
  self.assertIsNotNone(card)
  self.assertEqual(len(S.select('#inventoryQuickAdd .inventory-command-card')),1)
  self.assertIsNone(S.select_one('#inventoryQuickAdd .inventory-side-stack'))
  self.assertIn('book-plus',str(card))
  for input_id in ['manualBarcode','manualShelf','manualTitle']:
   self.assertIsNotNone(card.select_one('#'+input_id))
  for button in ['addManual','previewMetadata','clearForm']:
   self.assertIsNotNone(card.select_one('#'+button))
 def test_header_icons_have_clear_meaning(self):
  header=S.select_one('.head-actions')
  ids=[e.get('id') for e in header.select('button')]
  self.assertEqual(ids,['notificationBell','themeToggle','commandOpen'])
  self.assertEqual(header.select_one('#notificationBell use').get('href'),'assets/icons.svg#bell')
  self.assertEqual(header.select_one('#commandOpen use').get('href'),'assets/icons.svg#search')
  sprite=BeautifulSoup((R/'assets/icons.svg').read_text(),'xml')
  names=[n.get('id') for n in sprite.select('symbol')]
  self.assertEqual(len(names),len(set(names)))
 def test_educational_footer(self):
  src=(R/'assets/book-guide.js').read_text()
  self.assertIn('Reading tip:',src)
  self.assertNotIn('Free catalogue answers work without an API key',src)
  self.assertNotIn('free-tier integration in Vercel',src)
  self.assertNotIn("$('bookGuideDisclaimer').textContent",src)
 def test_v4_responsive_styles(self):
  c=(R/'assets/library-ui.css').read_text()
  self.assertIn('#shelfScan #inventoryQuickAdd .manual-entry-fields',c)
  self.assertIn('@media(max-width:520px)',c)
  self.assertIn('.head-actions #notificationBell .notification-count',c)
if __name__=='__main__':unittest.main()
