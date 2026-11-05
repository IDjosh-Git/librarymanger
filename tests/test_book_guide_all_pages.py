"""Book Guide catalogue visibility and privacy invariants."""
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT/'index.html').read_text()
PUBLIC = (ROOT/'assets/book-of-the-week.js').read_text()
GUIDE = (ROOT/'assets/book-guide.js').read_text()
SQL = (ROOT/'library_public_book_guide_catalog.sql').read_text()
CSS = (ROOT/'assets/book-guide.css').read_text()
class BookGuideAllPages(unittest.TestCase):
    def test_floating_guide_shown_on_every_workspace_panel(self):
        self.assertIn('window.LibraryBookGuide?.setVisible(true);if(name', APP)
        self.assertNotIn("setVisible(['inventory','lend'].includes(name))", APP)
        self.assertIn('document.addEventListener(\'DOMContentLoaded\',()=>{init();setVisible(true);});', GUIDE)
    def test_all_titles_on_public_page_and_logged_out_home(self):
        self.assertIn('void window.LibraryBookGuide?.loadPublicCatalog();', PUBLIC)
        self.assertIn('void window.LibraryBookGuide?.loadPublicCatalog();', APP)
        self.assertIn('library_public_guide_books', GUIDE)
        self.assertIn('p_offset:offset,p_limit:1000', GUIDE)
        self.assertIn("window.LibraryBookGuide?.addBook({title:data.title", PUBLIC)
        self.assertNotIn('LibraryBookGuide?.setBooks([{title:data.title', PUBLIC)
    def test_search_and_selection_are_accessible(self):
        for part in ['id="bookGuideSelect"', 'id="bookGuideSearch"', 'id="bookGuideCount"', "addEventListener('input',renderOptions)", 'document.createDocumentFragment()']:
            self.assertIn(part, GUIDE)
        self.assertIn('#bookGuideSearch', CSS)
    def test_public_endpoint_never_exposes_private_inventory_fields(self):
        self.assertIn('SECURITY DEFINER SET search_path',SQL)
        self.assertIn('REVOKE ALL ON FUNCTION', SQL)
        self.assertIn('GRANT EXECUTE ON FUNCTION public.library_public_guide_books',SQL)
        self.assertIn('FROM public.library_books b',SQL)
        for private_field in ['borrower_name','user_id','date_borrowed','due_date','return_date','book_id']:
            self.assertNotIn('b.'+private_field, SQL)
        self.assertNotIn(".from('library_books')", PUBLIC)
if __name__ == '__main__': unittest.main()
