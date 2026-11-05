"""Admin Management v6: UI safety, app-only activity and database enforcement contracts."""
from pathlib import Path
from bs4 import BeautifulSoup
import re,unittest

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text()
JS=(ROOT/'assets/library-admin.js').read_text()
CSS=(ROOT/'assets/library-ui.css').read_text()
SQL=(ROOT/'library_admin_management_upgrade.sql').read_text()
S=BeautifulSoup(HTML,'html.parser')

class AdminManagementV6(unittest.TestCase):
 def test_admin_only_navigation_and_panel(self):
  self.assertEqual(len(S.select('.workspace-nav [data-tab="adminMembers"]')),1)
  self.assertEqual(len(S.select('#mobileNavSheet [data-mobile-tab="adminMembers"]')),1)
  self.assertEqual(len(S.select('#adminMembers.panel')),1)
  self.assertIn('"contactSettings","adminMembers"]);',HTML)
  self.assertIn("if(name==='adminMembers')void window.LibraryAdminManagement?.load",HTML)
  self.assertIsNotNone(S.select_one('#lamRemoveDialog[aria-labelledby="lamConfirmTitle"]'))
 def test_real_app_visits_only(self):
  self.assertIn('library_admin_mark_app_visit',JS)
  self.assertIn('library_admin_app_directory',JS)
  self.assertIn('FROM private.library_admin_app_presence p',SQL)
  self.assertIn("AND r.role='admin'",SQL)
  self.assertNotIn('auth.users u ON TRUE',SQL)
  self.assertNotIn('datalearning_app_users',SQL)
 def test_removal_does_not_delete_users_or_books(self):
  self.assertIn("UPDATE public.library_member_roles SET role='user'",SQL)
  self.assertNotIn('DELETE FROM auth.users',SQL.upper().replace('DELETE FROM AUTH.USERS','DELETE FROM auth.users'))
  self.assertIn("'The last administrator cannot be removed'",SQL)
  self.assertIn("'You cannot remove your own administrator access'",SQL)
  self.assertIn('private.library_admin_revocations',SQL)
  self.assertIn('library_block_revoked_admin_promotion',SQL)
  self.assertIn('pg_advisory_xact_lock',SQL)
 def test_no_unauthorized_role_mutations_in_client(self):
  self.assertIn("client.rpc('library_admin_remove_member'",JS)
  self.assertNotIn("from('library_member_roles').update",JS)
  self.assertIn('textContent',JS)
  self.assertIn("$('lamConfirmInput').value.trim()!=='REMOVE'",JS)
  self.assertIn('dialog.showModal()',JS)
 def test_premium_scoped_responsive_design(self):
  self.assertIn('#adminMembers .lam-directory',CSS)
  self.assertIn('@media(max-width:650px)',CSS)
  self.assertIn(':root[data-theme="dark"] #adminMembers',CSS)
  self.assertEqual(len(S.select('link[href="assets/library-admin.css"]')),0)

if __name__=='__main__':unittest.main()
