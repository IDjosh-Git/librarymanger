-- Apply in Supabase SQL editor before using the shared branding controls.
CREATE TABLE IF NOT EXISTS public.library_app_settings (
 id integer PRIMARY KEY DEFAULT 1 CHECK (id=1),
 app_name text NOT NULL DEFAULT 'Library Manager' CHECK (char_length(app_name) BETWEEN 1 AND 70),
 primary_color text NOT NULL DEFAULT '#144e58' CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
 secondary_color text NOT NULL DEFAULT '#1d727a' CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
 button_style text NOT NULL DEFAULT 'gradient' CHECK (button_style IN ('solid','gradient')),
 logo_url text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.library_app_settings(id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.library_app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read branding" ON public.library_app_settings;
CREATE POLICY "Anyone can read branding" ON public.library_app_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins update branding" ON public.library_app_settings;
CREATE POLICY "Admins update branding" ON public.library_app_settings FOR ALL TO authenticated
 USING (EXISTS (SELECT 1 FROM public.library_member_roles r WHERE r.user_id=(SELECT auth.uid()) AND r.role='admin'))
 WITH CHECK (EXISTS (SELECT 1 FROM public.library_member_roles r WHERE r.user_id=(SELECT auth.uid()) AND r.role='admin'));
GRANT SELECT ON public.library_app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.library_app_settings TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('library-branding','library-branding',true,1048576,ARRAY['image/png','image/jpeg','image/webp'])
 ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Admins upload branding" ON storage.objects;
CREATE POLICY "Admins upload branding" ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id='library-branding' AND EXISTS (SELECT 1 FROM public.library_member_roles r WHERE r.user_id=(SELECT auth.uid()) AND r.role='admin'));
-- Public read is enabled through the public storage bucket; non-admins cannot upload.
