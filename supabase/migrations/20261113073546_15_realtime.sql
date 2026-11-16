-- ============================================================
-- 15_realtime: publication, replica identity, sanity check.
-- ============================================================
-- Design notes
--  * Tables are added to supabase_realtime publication only if
--    the publication exists (local dev without realtime works).
--  * Each table is checked individually so a partially-applied
--    run can be safely re-run.
--  * REPLICA IDENTITY FULL is set on tables whose UPDATE/DELETE
--    payloads must contain the old row (status transitions, soft
--    deletes, read-state changes).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Realtime publication (idempotent)
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'messages','conversations','conversation_members',
    'notifications','meetings','meeting_attendances',
    'assignments','submissions','announcements'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'supabase_realtime publication not found — skipping publication adds.';
    RETURN;
  END IF;

  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
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