-- Library Manager v5.25: Supabase-only private Library AI chat and knowledge.
-- Already applied to the existing shared DataLearning Supabase project on 2026-11-12.
-- Re-run only if restoring this app to another project after installing library_member_roles.
-- Does not touch Prompt Atelier, DataLearning user accounts, inventory or loan tables.
BEGIN;
CREATE TABLE IF NOT EXISTS public.library_manager_ai_conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,user_id)
);
CREATE TABLE IF NOT EXISTS public.library_manager_ai_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 message_sequence bigint GENERATED ALWAYS AS IDENTITY,
 conversation_id uuid NOT NULL,
 user_id uuid NOT NULL,
 role text NOT NULL CHECK (role IN ('user','assistant')),
 content text NOT NULL CHECK (length(content) BETWEEN 1 AND 12000),
 mode text,
 sources jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sources)='array'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT library_manager_ai_message_owner_fk FOREIGN KEY (conversation_id,user_id)
  REFERENCES public.library_manager_ai_conversations(id,user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS library_manager_ai_message_sort_idx
 ON public.library_manager_ai_messages(conversation_id,message_sequence DESC);
CREATE TABLE IF NOT EXISTS public.library_manager_ai_knowledge (
 slug text PRIMARY KEY CHECK(length(slug) BETWEEN 3 AND 80),
 title text NOT NULL CHECK(length(title) BETWEEN 5 AND 160),
 answer text NOT NULL CHECK(length(answer) BETWEEN 20 AND 6000),
 keywords text[] NOT NULL DEFAULT '{}',
 sort_order integer NOT NULL DEFAULT 100,
 enabled boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.library_manager_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_manager_ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_manager_ai_knowledge ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.library_manager_ai_conversations FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.library_manager_ai_messages FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.library_manager_ai_knowledge FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.library_manager_ai_conversations TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.library_manager_ai_messages TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.library_manager_ai_knowledge TO authenticated;
DROP POLICY IF EXISTS "Library AI member owns conversation SELECT" ON public.library_manager_ai_conversations;
CREATE POLICY "Library AI member owns conversation SELECT" ON public.library_manager_ai_conversations
 FOR SELECT TO authenticated USING(user_id=(select auth.uid()) AND EXISTS(SELECT 1 FROM public.library_member_roles m WHERE m.user_id=(select auth.uid()) AND m.role IN ('user','admin')));
DROP POLICY IF EXISTS "Library AI member starts own conversation" ON public.library_manager_ai_conversations;
CREATE POLICY "Library AI member starts own conversation" ON public.library_manager_ai_conversations
 FOR INSERT TO authenticated WITH CHECK(user_id=(select auth.uid()) AND EXISTS(SELECT 1 FROM public.library_member_roles m WHERE m.user_id=(select auth.uid()) AND m.role IN ('user','admin')));
DROP POLICY IF EXISTS "Library AI member resets own conversation" ON public.library_manager_ai_conversations;
CREATE POLICY "Library AI member resets own conversation" ON public.library_manager_ai_conversations
 FOR DELETE TO authenticated USING(user_id=(select auth.uid()) AND EXISTS(SELECT 1 FROM public.library_member_roles m WHERE m.user_id=(select auth.uid()) AND m.role IN ('user','admin')));
DROP POLICY IF EXISTS "Library AI member reads own messages" ON public.library_manager_ai_messages;
CREATE POLICY "Library AI member reads own messages" ON public.library_manager_ai_messages
 FOR SELECT TO authenticated USING(user_id=(select auth.uid()) AND EXISTS(SELECT 1 FROM public.library_member_roles m WHERE m.user_id=(select auth.uid()) AND m.role IN ('user','admin')));
DROP POLICY IF EXISTS "Library AI member writes own messages" ON public.library_manager_ai_messages;
CREATE POLICY "Library AI member writes own messages" ON public.library_manager_ai_messages
 FOR INSERT TO authenticated WITH CHECK(user_id=(select auth.uid()) AND EXISTS(SELECT 1 FROM public.library_member_roles m WHERE m.user_id=(select auth.uid()) AND m.role IN ('user','admin')));
DROP POLICY IF EXISTS "Library AI member removes own messages" ON public.library_manager_ai_messages;
CREATE POLICY "Library AI member removes own messages" ON public.library_manager_ai_messages
 FOR DELETE TO authenticated USING(user_id=(select auth.uid()) AND EXISTS(SELECT 1 FROM public.library_member_roles m WHERE m.user_id=(select auth.uid()) AND m.role IN ('user','admin')));
DROP POLICY IF EXISTS "Library AI members read app guide" ON public.library_manager_ai_knowledge;
CREATE POLICY "Library AI members read app guide" ON public.library_manager_ai_knowledge
 FOR SELECT TO authenticated USING((enabled AND EXISTS(SELECT 1 FROM public.library_member_roles m WHERE m.user_id=(select auth.uid()) AND m.role IN ('user','admin'))) OR EXISTS(SELECT 1 FROM public.library_member_roles m WHERE m.user_id=(select auth.uid()) AND m.role='admin'));
DROP POLICY IF EXISTS "Library AI administrators add app guide" ON public.library_manager_ai_knowledge;
CREATE POLICY "Library AI administrators add app guide" ON public.library_manager_ai_knowledge
 FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.library_member_roles m WHERE m.user_id=(select auth.uid()) AND m.role='admin'));
DROP POLICY IF EXISTS "Library AI administrators edit app guide" ON public.library_manager_ai_knowledge;
CREATE POLICY "Library AI administrators edit app guide" ON public.library_manager_ai_knowledge
 FOR UPDATE TO authenticated
 USING(EXISTS(SELECT 1 FROM public.library_member_roles m WHERE m.user_id=(select auth.uid()) AND m.role='admin'))
 WITH CHECK(EXISTS(SELECT 1 FROM public.library_member_roles m WHERE m.user_id=(select auth.uid()) AND m.role='admin'));
DROP POLICY IF EXISTS "Library AI administrators delete app guide" ON public.library_manager_ai_knowledge;
CREATE POLICY "Library AI administrators delete app guide" ON public.library_manager_ai_knowledge
 FOR DELETE TO authenticated USING(EXISTS(SELECT 1 FROM public.library_member_roles m WHERE m.user_id=(select auth.uid()) AND m.role='admin'));
COMMIT;
