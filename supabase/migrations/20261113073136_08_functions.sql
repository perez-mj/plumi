-- ============================================================
-- 08_functions: all SECURITY DEFINER helpers used by RLS,
--               triggers, and RPCs.
-- ============================================================
-- Design notes
--  * Every helper is SECURITY DEFINER so it works regardless of
--    the caller's own RLS visibility (e.g. before a profile row
--    is created, or when a student needs to see a course title).
--  * Every helper has SET search_path = public and is STABLE.
--  * Every helper is REVOKEd from PUBLIC and granted to the
--    minimal role that needs it.
--  * notify_user() is NOT granted to authenticated — it is
--    only called from SECURITY DEFINER triggers.
-- ============================================================

-- ---------- role helpers ----------

CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LOWER(r.name)
  FROM public.profiles p
  JOIN public.roles r ON r.id = p.role_id
  WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_role_name() = 'admin', false);
$$;

-- ---------- course helpers ----------

CREATE OR REPLACE FUNCTION public.is_enrolled(p_course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE course_id = p_course_id
      AND student_id = auth.uid()
      AND status = 'ACTIVE'
  );
$$;

CREATE OR REPLACE FUNCTION public.teaches_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses
    WHERE id = p_course_id AND instructor_id = auth.uid()
  );
$$;

-- ---------- conversation helper ----------

CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = auth.uid()
  );
$$;

-- ---------- display names (realtime-safe) ----------
-- Returns only display fields (no email, no bio, no last_seen_at).
-- Allowed if the caller is the same user, admin, or shares a
-- conversation / course with the target.

CREATE OR REPLACE FUNCTION public.get_display_names(p_ids uuid[])
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
  WHERE p.id = ANY(p_ids)
    AND p.deleted_at IS NULL
    AND (
      p.id = auth.uid()
      OR public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.conversation_members cm_self
        JOIN public.conversation_members cm_other
          ON cm_self.conversation_id = cm_other.conversation_id
        WHERE cm_self.user_id = auth.uid()
          AND cm_other.user_id = p.id
      )
      OR EXISTS (
        SELECT 1
        FROM public.enrollments e_self
        JOIN public.enrollments e_other
          ON e_self.course_id = e_other.course_id
        WHERE e_self.student_id = auth.uid()
          AND e_other.student_id = p.id
      )
      OR EXISTS (
        SELECT 1
        FROM public.enrollments e
        JOIN public.courses c ON c.id = e.course_id
        WHERE e.student_id = auth.uid()
          AND c.instructor_id = p.id
      )
      OR EXISTS (
        SELECT 1
        FROM public.enrollments e
        JOIN public.courses c ON c.id = e.course_id
        WHERE c.instructor_id = auth.uid()
          AND e.student_id = p.id
      )
    );
$$;

-- ---------- notify_user (central notification insert) ----------
-- Skips the acting user (don't notify yourself).

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
LANGUAGE plpgsql SECURITY DEFINER
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

-- ---------- grants ----------

REVOKE ALL ON FUNCTION public.current_role_name()          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin()                   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_enrolled(uuid)            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teaches_course(uuid)         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_conversation_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_display_names(uuid[])    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_user(uuid, uuid, "NotificationType", varchar, text, varchar, varchar, uuid, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_role_name()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin()                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_enrolled(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.teaches_course(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_display_names(uuid[])    TO authenticated;
-- notify_user is intentionally NOT granted to authenticated.