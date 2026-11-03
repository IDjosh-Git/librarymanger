import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'index.html').read_text()
CSS = (ROOT / 'assets/library-ui.css').read_text()

class TableReadabilityTests(unittest.TestCase):
    def test_horizontal_scroll_and_accessibility(self):
        for table in ('bookTable','loanTable','scannedTable'):
            self.assertIn(f'id="{table}"',HTML)
            self.assertIn(f'aria-label="{"Inventory table" if table=="bookTable" else "Loan history table" if table=="loanTable" else "Scanned books table"}"',HTML)
        self.assertIn('overscroll-behavior-x:contain',CSS)
        self.assertIn('overflow-x:auto!important',CSS)

    def test_titles_wrap_but_values_do_not(self):
        self.assertIn('white-space:nowrap!important',CSS)
        self.assertIn('td[data-label="Title"]',CSS)
        self.assertIn('td[data-label="Book"]',CSS)
        self.assertIn('white-space:normal!important',CSS)
        self.assertIn('min-width:1850px!important',CSS)
        self.assertIn('min-width:1380px!important',CSS)
        self.assertIn('min-width:1520px!important',CSS)

    def test_mobile_table_rows_no_longer_cardified(self):
        self.assertIn('display:table-row!important',CSS)
        self.assertIn('display:table-cell!important',CSS)
        self.assertIn('display:table-row-group!important',CSS)
        self.assertIn('display:none!important;\n  content:none!important',CSS)

if __name__=='__main__':
    unittest.main()
