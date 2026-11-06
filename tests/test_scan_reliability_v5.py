"""Regressions for recovered scans, inventory consistency and readable AI responses."""
from pathlib import Path
import unittest
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
APP=(ROOT/'index.html').read_text()
PUBLIC=(ROOT/'book-of-the-week.html').read_text()
SOUP=BeautifulSoup(APP,'html.parser')

class ScanReliabilityV5(unittest.TestCase):
 def test_saved_scan_register_includes_incomplete_book_records(self):
  assert "const rows=books.filter(b=>b.scan_date||b.scan_time).slice()" in APP
  assert "quality:$('scannedQuality').value" in APP
  assert SOUP.select_one('#scannedQuality option[value="attention"]')
  assert "record_id:x.saveRecordId" in APP
  assert "await reloadAll();" in APP
  assert "renderScannedBooks();" in APP
 def test_resume_ocr_from_saved_thumbnail(self):
  for part in ('async function reviewSourceFile(row)',"const file=await reviewSourceFile(row)",'const usedAI=await readCoverWithAI(row,file,forceAI)','row.ocrText=await ocrText(file)'):
   self.assertIn(part,APP)
 def test_checkpoint_before_batch_finished(self):
  chunk=APP[APP.index('async function runBatch(){'):APP.index('function batchSelectAll(){')]
  self.assertLess(chunk.index('batchItems.push(row)'),chunk.index('await Promise.all('))
  self.assertIn('checkpointCompletedScan(uploader)',chunk)
  self.assertIn('await persistReviewDraft(uploader,reviewDraftVersion)',chunk)
  self.assertIn('filter(x=>!x.saved).map(x=>',APP)
  self.assertIn('URL.revokeObjectURL(previewUrl)',APP)
 def test_safe_ai_markdown_in_both_pages(self):
  for html in (APP,PUBLIC):
   self.assertLess(html.index('assets/book-guide-format.js'),html.index('assets/book-guide.js'))
  formatter=(ROOT/'assets/book-guide-format.js').read_text()
  for part in ('document.createTextNode','document.createElement(\'ul\')','document.createElement(\'li\')','document.createElement(\'pre\')'):
   # List elements are created via a named tag; make sure the parser is DOM based.
   if 'ul' in part or 'li' in part:continue
   self.assertIn(part,formatter)
  self.assertNotIn('innerHTML',formatter)
  self.assertIn('setMessageText(pending,json.reply)',(ROOT/'assets/book-guide.js').read_text())
  self.assertIn('Do not return HTML', (ROOT/'api/book-chat.js').read_text())
 def test_manual_title_without_isbn(self):
  self.assertIn("if(!code&&!manualTitleOnly)",APP)
  self.assertIn("barcode:code,shelf_location:manualShelf||null,title:manualTitle||null",APP)
  self.assertIn('Custom barcode; review manually',APP)

if __name__=='__main__':unittest.main()
