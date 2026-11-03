-- ============================================================
-- 09_realtime: publication, replica identity, missing policies,
--              notification triggers, and display-name RPC
-- ============================================================
-- Design notes
--  * Tables are added to the supabase_realtime publication only if
--    the publication exists (local dev without realtime is tolerated).
--  * REPLICA IDENTITY FULL is set on tables whose UPDATE/DELETE
--    payloads must contain the old row (status transitions, soft
--    deletes, read-state changes).
--  * get_display_names() is SECURITY DEFINER so realtime consumers
--    can resolve sender names without a broad profiles SELECT policy.
--  * Notification triggers fire AFTER INSERT/UPDATE so they see the
--    final row. They call notify_* helpers that are safe to re-run.
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
    -- Chat
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members';

    -- Notifications
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';

    -- Meetings
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_attendances';

    -- Assignments / grading
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions';

    -- Announcements
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
-- Tables whose payload.old must contain full rows:
--   messages             → detect soft-deletes / edits
--   meetings             → detect status transitions (SCHEDULED→LIVE)
--   submissions          → detect graded transitions, ungrading
--   notifications        → detect read/unread toggles across tabs
--   conversation_members → sync last_read_at across tabs
ALTER TABLE public.messages             REPLICA IDENTITY FULL;
ALTER TABLE public.meetings             REPLICA IDENTITY FULL;
ALTER TABLE public.submissions          REPLICA IDENTITY FULL;
ALTER TABLE public.notifications        REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_members REPLICA IDENTITY FULL;

-- ------------------------------------------------------------
-- 3. Missing policies uncovered by the realtime audit
-- ------------------------------------------------------------

-- 3.1 conversation_members: allow a member to update their own row
--     (last_read_at, is_muted). Needed by markRead() and mute UI.
DROP POLICY IF EXISTS conversation_members_self_update ON public.conversation_members;
CREATE POLICY conversation_members_self_update ON public.conversation_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3.2 enrollments: allow instructor to update status, student to
--     drop their own enrollment. Needed by updateEnrollmentStatus().
DROP POLICY IF EXISTS enrollments_status_update ON public.enrollments;
CREATE POLICY enrollments_status_update ON public.enrollments
  FOR UPDATE TO authenticated
  USING (
    student_id = auth.uid()
    OR public.teaches_course(course_id)
    OR public.is_admin()
  )
  WITH CHECK (
    student_id = auth.uid()
    OR public.teaches_course(course_id)
    OR public.is_admin()
  );

-- 3.3 profiles: instructors can read students enrolled in their courses
--     already exists (profiles_instructor_read_students). Students
--     still cannot read instructors or classmates — that is intentional;
--     use get_display_names() below.

-- ------------------------------------------------------------
-- 4. get_display_names() — realtime-safe name lookup
-- ------------------------------------------------------------
-- Returns ONLY display fields (no email, no bio, no last_seen_at).
-- Allowed if the caller:
--   * is the same user
--   * is admin
--   * shares any conversation with the target
--   * shares any course as co-student or instructor/student
--   * is a co-teacher (rare but cheap to include)
CREATE OR REPLACE FUNCTION public.get_display_names(p_ids uuid[])
RETURNS TABLE (
  id         uuid,
  first_name varchar,
  last_name  varchar,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name, p.avatar_url
  FROM public.profiles p
  WHERE p.id = ANY(p_ids)
    AND p.deleted_at IS NULL
    AND (
      p.id = auth.uid()
      OR public.is_admin()
      -- Share a conversation
      OR EXISTS (
        SELECT 1
        FROM public.conversation_members cm_self
        JOIN public.conversation_members cm_other
          ON cm_self.conversation_id = cm_other.conversation_id
        WHERE cm_self.user_id = auth.uid()
          AND cm_other.user_id = p.id
      )
      -- Co-enrolled in a course
      OR EXISTS (
        SELECT 1
        FROM public.enrollments e_self
        JOIN public.enrollments e_other
          ON e_self.course_id = e_other.course_id
        WHERE e_self.student_id = auth.uid()
          AND e_other.student_id = p.id
      )
      -- Target teaches a course the caller is enrolled in
      OR EXISTS (
        SELECT 1
        FROM public.enrollments e
        JOIN public.courses c ON c.id = e.course_id
        WHERE e.student_id = auth.uid()
          AND c.instructor_id = p.id
      )
      -- Caller teaches a course the target is enrolled in
      OR EXISTS (
        SELECT 1
        FROM public.enrollments e
        JOIN public.courses c ON c.id = e.course_id
        WHERE c.instructor_id = auth.uid()
          AND e.student_id = p.id
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_display_names(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_display_names(uuid[]) TO authenticated;

-- ------------------------------------------------------------
-- 5. Notification helper
-- ------------------------------------------------------------
-- Central insert so we always set user_id, type, title, and link
-- consistently. Skips the acting user (don't notify yourself).
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id     uuid,
  p_actor_id    uuid,
  p_type        "NotificationType",
  p_title       varchar,
  p_body        text,
  p_link        varchar,
  p_entity_type varchar,
  p_entity_id   uuid,
  p_data        jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id = p_actor_id THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications (
    user_id, type, title, body, link, entity_type, entity_id, data
  ) VALUES (
    p_user_id, p_type, p_title, p_body, p_link, p_entity_type, p_entity_id, p_data
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notify_user(uuid, uuid, "NotificationType", varchar, text, varchar, varchar, uuid, jsonb) FROM PUBLIC;

-- ------------------------------------------------------------
-- 6. Notification triggers
-- ------------------------------------------------------------

-- 6.1 New published assignment → enrolled students
CREATE OR REPLACE FUNCTION public.trg_notify_new_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_title varchar;
BEGIN
  IF NEW.is_published = true AND (TG_OP = 'INSERT' OR OLD.is_published = false) THEN
    SELECT title INTO v_course_title FROM public.courses WHERE id = NEW.course_id;

    PERFORM public.notify_user(
      e.student_id,
      NEW.created_by,
      'NEW_ASSIGNMENT',
      'New assignment: ' || NEW.title,
      COALESCE(v_course_title, 'Course') || ' • due ' ||
        COALESCE(to_char(NEW.due_at AT TIME ZONE 'UTC', 'Mon DD, HH24:MI'), 'no deadline'),
      '/app/student/assignments/' || NEW.id::text,
      'assignment',
      NEW.id,
      jsonb_build_object('course_id', NEW.course_id)
    )
    FROM public.enrollments e
    WHERE e.course_id = NEW.course_id
      AND e.status = 'ACTIVE';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_assignment ON public.assignments;
CREATE TRIGGER notify_new_assignment
  AFTER INSERT OR UPDATE OF is_published ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_assignment();

-- 6.2 Submission graded → notify student
CREATE OR REPLACE FUNCTION public.trg_notify_graded_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title varchar;
BEGIN
  IF NEW.status = 'GRADED' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'GRADED') THEN
    SELECT title INTO v_title FROM public.assignments WHERE id = NEW.assignment_id;

    PERFORM public.notify_user(
      NEW.student_id,
      COALESCE(NEW.graded_by, NEW.student_id),
      'ASSIGNMENT_GRADED',
      'Graded: ' || COALESCE(v_title, 'Assignment'),
      'Score: ' || COALESCE(NEW.score::text, '—') ||
        CASE WHEN NEW.feedback IS NOT NULL THEN ' • ' || left(NEW.feedback, 140) ELSE '' END,
      '/app/student/assignments/' || NEW.assignment_id::text,
      'submission',
      NEW.id,
      jsonb_build_object('assignment_id', NEW.assignment_id, 'score', NEW.score)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_graded_submission ON public.submissions;
CREATE TRIGGER notify_graded_submission
  AFTER INSERT OR UPDATE OF status ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_graded_submission();

-- 6.3 New message → other conversation members
CREATE OR REPLACE FUNCTION public.trg_notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_title  varchar;
  v_sender_name varchar;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(c.title, c.type::text)
    INTO v_conv_title
    FROM public.conversations c
    WHERE c.id = NEW.conversation_id;

  SELECT (p.first_name || ' ' || p.last_name)
    INTO v_sender_name
    FROM public.profiles p
    WHERE p.id = NEW.sender_id;

  PERFORM public.notify_user(
    cm.user_id,
    NEW.sender_id,
    'NEW_MESSAGE',
    COALESCE(v_sender_name, 'Someone') || ' • ' || COALESCE(v_conv_title, 'Conversation'),
    left(NEW.content, 140),
    '/app/messages?conversation=' || NEW.conversation_id::text,
    'message',
    NEW.id,
    jsonb_build_object('conversation_id', NEW.conversation_id)
  )
  FROM public.conversation_members cm
  WHERE cm.conversation_id = NEW.conversation_id
    AND cm.user_id <> NEW.sender_id
    AND cm.is_muted = false;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_message ON public.messages;
CREATE TRIGGER notify_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_message();

-- 6.4 New announcement → course members (or all users for SYSTEM)
CREATE OR REPLACE FUNCTION public.trg_notify_new_announcement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.scope = 'COURSE' AND NEW.course_id IS NOT NULL THEN
    PERFORM public.notify_user(
      e.student_id,
      NEW.author_id,
      'NEW_ANNOUNCEMENT',
      NEW.title,
      left(NEW.content, 160),
      '/app/student/courses/' || NEW.course_id::text,
      'announcement',
      NEW.id,
      jsonb_build_object('course_id', NEW.course_id)
    )
    FROM public.enrollments e
    WHERE e.course_id = NEW.course_id
      AND e.status = 'ACTIVE';
  ELSIF NEW.scope = 'SYSTEM' THEN
    PERFORM public.notify_user(
      p.id,
      NEW.author_id,
      'NEW_ANNOUNCEMENT',
      NEW.title,
      left(NEW.content, 160),
      '/app',
      'announcement',
      NEW.id,
      jsonb_build_object('scope', 'SYSTEM')
    )
    FROM public.profiles p
    WHERE p.deleted_at IS NULL
      AND p.is_active = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_announcement ON public.announcements;
CREATE TRIGGER notify_new_announcement
  AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_announcement();

-- 6.5 New meeting scheduled → enrolled students
CREATE OR REPLACE FUNCTION public.trg_notify_new_meeting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'CANCELLED' THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify_user(
    e.student_id,
    NEW.host_id,
    'UPCOMING_MEETING',
    'New meeting: ' || NEW.title,
    to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'Mon DD, HH24:MI') ||
      ' • ' || NEW.duration::text || ' min',
    '/app/meetings/' || NEW.id::text || '/room?room=' || NEW.room_name,
    'meeting',
    NEW.id,
    jsonb_build_object('course_id', NEW.course_id)
  )
  FROM public.enrollments e
  WHERE e.course_id = NEW.course_id
    AND e.status = 'ACTIVE';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_meeting ON public.meetings;
CREATE TRIGGER notify_new_meeting
  AFTER INSERT ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_meeting();

-- ------------------------------------------------------------
-- 7. Notifications cleanup
-- ------------------------------------------------------------
-- Bound the notifications table so it doesn't grow unbounded.
-- A nightly-ish delete can be scheduled with pg_cron if available,
-- but we add a cheap retention index right now.
CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx
  ON public.notifications(user_id, created_at DESC);

-- ------------------------------------------------------------
-- 8. Sanity check (informational, non-fatal)
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