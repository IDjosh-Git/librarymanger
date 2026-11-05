"""Safety + UI checks for verified Library Manager administrator management."""
from pathlib import Path
from html.parser import HTMLParser
import unittest
R=Path(__file__).resolve().parents[1]
APP=(R/'index.html').read_text()
CSS=(R/'assets/library-ui.css').read_text()
SQL=(R/'library_admin_management_upgrade.sql').read_text()

class AdminManagementTests(unittest.TestCase):
 def test_present_in_authorized_navigation_and_mobile(self):
  for fragment in ['id="adminDirectory"','data-tab="adminDirectory"','data-mobile-tab="adminDirectory"','"adminDirectory"]','adminDirectory:\'Administrators\'']:
   self.assertIn(fragment,APP)
 def test_verified_role_and_app_activity_only(self):
  for fragment in ["r.role='admin'",'LEFT JOIN public.library_admin_activity a','JOIN auth.users u','WHERE r.role=\'admin\'','library_register_admin_visit','library_list_active_admins']:
   self.assertIn(fragment,SQL)
  self.assertIn('if(isAdmin())void recordAdminWorkspaceUse()',APP)
  self.assertIn("WHERE r.role='admin' AND u.email_confirmed_at IS NOT NULL",SQL)
  self.assertIn("LEFT JOIN public.library_admin_activity a ON a.user_id=r.user_id",SQL)
  self.assertIn("coalesce(a.sign_in_count,0)",SQL)
 def test_server_enforced_removal_and_safety(self):
  for fragment in ['p_target=v_uid',"count(*) FROM public.library_member_roles WHERE role='admin'",'pg_advisory_xact_lock',"SET role='user'",'library_admin_role_audit',"auth.uid()",'GRANT EXECUTE ON FUNCTION public.library_revoke_admin(uuid) TO authenticated']:
   self.assertIn(fragment,SQL)
  self.assertNotIn('delete from auth.users',SQL.lower())
  self.assertIn('library_block_revoked_admin_reclaim',SQL)
  self.assertNotIn("This account has no verified Library Manager administrator activity",SQL)
 def test_no_direct_table_access(self):
  self.assertIn('ENABLE ROW LEVEL SECURITY',SQL)
  self.assertIn('REVOKE ALL ON public.library_admin_activity FROM PUBLIC, anon, authenticated',SQL)
  self.assertIn('REVOKE ALL ON public.library_admin_role_audit FROM PUBLIC, anon, authenticated',SQL)
 def test_confirmation_and_responsiveness(self):
  for fragment in ['class="admin-directory-table"','id="adminDirectoryList"','id="adminRemoveBackdrop"','id="adminRemoveConfirm"','id="adminRemoveSubmit"','value.trim()!==\'REMOVE\'','adminRemoveSubmit','adminDirectoryRefresh']:
   self.assertIn(fragment,APP)
  for fragment in ['@media(max-width:620px)','admin-directory-grid','admin-remove-backdrop','data-theme="dark"']:
   self.assertIn(fragment,CSS)
