-- ============================================================
-- 13_rpcs_messaging: SECURITY DEFINER RPCs for starting
--     conversations. Bypasses the admin-only INSERT policy on
--     conversation_members so non-admin users can open direct
--     and course conversations.
-- ============================================================

-- ---------- 13.1 People the caller is allowed to message ----------
-- Returns only display columns (no email) so this can be used to
-- populate the "new message" picker.

CREATE OR REPLACE FUNCTION public.messaging_people()
RETURNS TABLE (
  id         uuid,
  first_name varchar,
  last_name  varchar,
  avatar_url text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name, p.avatar_url
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles caller
      WHERE caller.id = auth.uid()
        AND caller.is_active
        AND caller.deleted_at IS NULL
    )
    AND p.id <> auth.uid()
    AND p.is_active
    AND p.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.deleted_at IS NULL
        AND (
          c.instructor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.course_id = c.id
              AND e.student_id = auth.uid()
              AND e.status = 'ACTIVE'
          )
        )
        AND (
          c.instructor_id = p.id
          OR EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.course_id = c.id
              AND e.student_id = p.id
              AND e.status = 'ACTIVE'
          )
        )
    )
  ORDER BY p.first_name, p.last_name, p.id;
$$;

-- ---------- 13.2 Open (or create) a DIRECT conversation ----------

CREATE OR REPLACE FUNCTION public.messaging_open_direct(p_other uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_me IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_me AND is_active AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Not authenticated or inactive account';
  END IF;

  IF p_other IS NULL OR p_other = v_me THEN
    RAISE EXCEPTION 'Choose another person to message';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.messaging_people() WHERE id = p_other) THEN
    RAISE EXCEPTION 'This person is not eligible for messaging';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      least(v_me::text, p_other::text) || ':' ||
      greatest(v_me::text, p_other::text),
      0
    )
  );

  SELECT c.id INTO v_id
  FROM public.conversations c
  WHERE c.type = 'DIRECT'
    AND EXISTS (SELECT 1 FROM public.conversation_members m
                WHERE m.conversation_id = c.id AND m.user_id = v_me)
    AND EXISTS (SELECT 1 FROM public.conversation_members m
                WHERE m.conversation_id = c.id AND m.user_id = p_other)
    AND (SELECT count(*) FROM public.conversation_members m
         WHERE m.conversation_id = c.id) = 2
  ORDER BY c.created_at, c.id
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.conversations (type, created_by)
    VALUES ('DIRECT', v_me)
    RETURNING id INTO v_id;

    INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES (v_id, v_me), (v_id, p_other);
  END IF;

  RETURN v_id;
END;
$$;

-- ---------- 13.3 Open (or create) a COURSE conversation ----------

CREATE OR REPLACE FUNCTION public.messaging_open_course(p_course uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me      uuid := auth.uid();
  v_id      uuid;
  v_teacher uuid;
  v_title   varchar;
BEGIN
  IF v_me IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_me AND is_active AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Not authenticated or inactive account';
  END IF;

  SELECT instructor_id, title INTO v_teacher, v_title
  FROM public.courses
  WHERE id = p_course AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  IF NOT (
    v_teacher = v_me
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE course_id = p_course
        AND student_id = v_me
        AND status = 'ACTIVE'
    )
  ) THEN
    RAISE EXCEPTION 'Course access denied';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('course:' || p_course::text, 0)
  );

  SELECT id INTO v_id
  FROM public.conversations
  WHERE type = 'COURSE' AND course_id = p_course;

  IF v_id IS NULL THEN
    INSERT INTO public.conversations (type, course_id, title, created_by)
    VALUES ('COURSE', p_course, v_title, v_me)
    RETURNING id INTO v_id;
  END IF;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  SELECT v_id, eligible.id
  FROM (
    SELECT v_me AS id
    UNION
    SELECT v_teacher
    UNION
    SELECT student_id FROM public.enrollments
    WHERE course_id = p_course AND status = 'ACTIVE'
  ) eligible
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN v_id;
END;
$$;

-- ---------- 13.4 Grants ----------

REVOKE ALL ON FUNCTION public.messaging_people()          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.messaging_open_direct(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.messaging_open_course(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.messaging_people()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_open_direct(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_open_course(uuid) TO authenticated;