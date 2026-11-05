"""Library Manager directory must display registered Admin accounts even without recorded visits."""
from pathlib import Path
import unittest
R=Path(__file__).resolve().parents[1]
APP=(R/'index.html').read_text()
CSS=(R/'assets/library-ui.css').read_text()
FULL=(R/'library_admin_management_upgrade.sql').read_text()
PATCH=(R/'library_admin_signup_directory_fix.sql').read_text()
class RegisteredAdminDirectoryTests(unittest.TestCase):
 def test_source_of_truth_is_approved_admin_role_and_verified_email(self):
  for sql in (FULL,PATCH):
   self.assertIn("WHERE r.role='admin' AND u.email_confirmed_at IS NOT NULL",sql)
   self.assertIn('LEFT JOIN public.library_admin_activity a',sql)
   self.assertIn('coalesce(a.sign_in_count,0)',sql)
   self.assertNotIn('This account has no verified Library Manager administrator activity',sql)
 def test_remove_cannot_be_bypassed_by_reusing_shared_access_code(self):
  for sql in (FULL,PATCH):
   self.assertIn('library_block_revoked_admin_reclaim',sql)
   self.assertIn('SELECT auth.uid()',sql)
   self.assertIn("SET role='user'",sql)
   self.assertIn("p_target=v_uid",sql)
   self.assertIn("count(*) FROM public.library_member_roles WHERE role='admin'",sql)
 def test_desktop_table_mobile_cards_and_confirm(self):
  for fragment in ['<table class="admin-directory-table"','<tbody id="adminDirectoryList"','data-label','admin-directory-row','id="adminRemoveConfirm"']:
   self.assertIn(fragment,APP)
  for fragment in ['.admin-directory-table','@media(max-width:780px)','.admin-directory-name-cell','.admin-directory-remove']:
   self.assertIn(fragment,CSS)
 def test_existing_admin_button_and_server_code_activation_retained(self):
  for fragment in ['data-select-role="admin"',"library_claim_admin_access_code","library_register_admin_visit","library_revoke_admin"]:
   self.assertIn(fragment,APP)
