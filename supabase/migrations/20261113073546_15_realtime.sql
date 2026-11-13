-- ============================================================
-- 15_realtime: publication, replica identity, sanity check.
-- ============================================================
-- Design notes
--  * Tables are added to supabase_realtime publication only if
--    the publication exists (local dev without realtime works).
--  * REPLICA IDENTITY FULL is set on tables whose UPDATE/DELETE
--    payloads must contain the old row (status transitions, soft
--    deletes, read-state changes).
--  * This file ONLY sets up publication/replica identity. All
--    policies, helper functions, and triggers live in earlier
--    files.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Realtime publication
-- ------------------------------------------------------------
DO $$
DECLARE
  has_pub boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    INTO has_pub;

  IF has_pub THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_attendances';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements';
  ELSE
    RAISE NOTICE 'supabase_realtime publication not found — skipping publication adds.';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'One or more tables already in supabase_realtime publication.';
END $$;

-- ------------------------------------------------------------
-- 2. Replica identity for UPDATE / DELETE payloads
-- ------------------------------------------------------------
ALTER TABLE public.messages             REPLICA IDENTITY FULL;
ALTER TABLE public.meetings             REPLICA IDENTITY FULL;
ALTER TABLE public.submissions          REPLICA IDENTITY FULL;
ALTER TABLE public.notifications        REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_members REPLICA IDENTITY FULL;

-- ------------------------------------------------------------
-- 3. Notifications retention index
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx
  ON public.notifications(user_id, created_at DESC);

-- ------------------------------------------------------------
-- 4. Sanity check (informational)
-- ------------------------------------------------------------
DO $$
DECLARE
  missing text[] := ARRAY[]::text[];
  t text;
  required text[] := ARRAY[
    'messages','conversations','conversation_members',
    'notifications','meetings','meeting_attendances',
    'assignments','submissions','announcements'
  ];
BEGIN
  FOREACH t IN ARRAY required LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      missing := array_append(missing, t);
    END IF;
  END LOOP;

  IF array_length(missing, 1) > 0 THEN
    RAISE WARNING 'Tables not in supabase_realtime publication: %', missing;
  ELSE
    RAISE NOTICE 'All required tables are in supabase_realtime publication.';
  END IF;
END $$;