-- ============================================================
-- 20_meeting_attendance_hardening
--  * Prevent duplicate open attendance rows per (meeting,user).
--  * Restrict INSERT to users authorized to join the meeting.
--  * Add aggregate attendance RPC for instructors/admins.
--  * Add meeting status transition RPCs (start / end).
--  * Force status transitions through the RPCs via a guard
--    trigger (clients cannot UPDATE meetings.status directly).
-- ============================================================

-- 1. One open attendance row per (meeting_id, user_id).
CREATE UNIQUE INDEX IF NOT EXISTS meeting_attendances_open_unique
  ON public.meeting_attendances (meeting_id, user_id)
  WHERE left_at IS NULL;

-- 2. Replace the too-permissive self_write policy.
DROP POLICY IF EXISTS meeting_attendances_self_write ON public.meeting_attendances;

CREATE POLICY meeting_attendances_self_insert ON public.meeting_attendances
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.meetings m
      WHERE m.id = meeting_id
        AND m.status IN ('SCHEDULED', 'LIVE')
        AND (
          m.host_id = auth.uid()
          OR public.is_enrolled(m.course_id)
          OR public.teaches_course(m.course_id)
        )
    )
  );

-- Users may close (set left_at) only their own open row, and
-- left_at must be a real, non-future timestamp >= joined_at.
CREATE POLICY meeting_attendances_self_update ON public.meeting_attendances
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND left_at IS NULL)
  WITH CHECK (
    user_id = auth.uid()
    AND left_at IS NOT NULL
    AND left_at >= joined_at
    AND left_at <= now() + interval '1 minute'
  );

-- Admins retain full access via a separate policy.
CREATE POLICY meeting_attendances_admin_all ON public.meeting_attendances
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- (meeting_attendances_read from 09 stays as-is.)

-- 3. Aggregate attendance RPC for instructors/admins.
CREATE OR REPLACE FUNCTION public.meeting_attendance_list(p_meeting_id uuid)
RETURNS TABLE (
  user_id     uuid,
  first_name  varchar,
  last_name   varchar,
  joined_at   timestamptz,
  left_at     timestamptz,
  duration_sec integer
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.user_id,
    p.first_name,
    p.last_name,
    a.joined_at,
    a.left_at,
    CASE
      WHEN a.left_at IS NULL THEN NULL
      ELSE EXTRACT(EPOCH FROM (a.left_at - a.joined_at))::integer
    END
  FROM public.meeting_attendances a
  JOIN public.profiles p ON p.id = a.user_id
  JOIN public.meetings m ON m.id = a.meeting_id
  WHERE a.meeting_id = p_meeting_id
    AND (
      public.is_admin()
      OR m.host_id = auth.uid()
      OR public.teaches_course(m.course_id)
    )
  ORDER BY a.joined_at ASC;
$$;

REVOKE ALL ON FUNCTION public.meeting_attendance_list(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meeting_attendance_list(uuid) TO authenticated;

-- 4. Guard trigger: status/started_at/ended_at may only change
--    via the RPCs below. Direct client UPDATEs are blocked.
CREATE OR REPLACE FUNCTION public.meetings_guard_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service role / triggers
  END IF;

  IF NEW.status     IS DISTINCT FROM OLD.status
     OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.ended_at   IS DISTINCT FROM OLD.ended_at
  THEN
    IF COALESCE(current_setting('app.meeting_rpc', true), '') <> 'on' THEN
      RAISE EXCEPTION 'status changes must go through meeting_start/meeting_end';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS meetings_guard_status_change ON public.meetings;
CREATE TRIGGER meetings_guard_status_change
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.meetings_guard_status_change();

-- 5. Status transitions (host or course instructor only).
CREATE OR REPLACE FUNCTION public.meeting_start(p_meeting_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting public.meetings%ROWTYPE;
BEGIN
  SELECT * INTO v_meeting FROM public.meetings WHERE id = p_meeting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found';
  END IF;
  IF NOT (v_meeting.host_id = auth.uid()
          OR public.teaches_course(v_meeting.course_id)
          OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_meeting.status NOT IN ('SCHEDULED', 'LIVE') THEN
    RETURN;
  END IF;

  PERFORM set_config('app.meeting_rpc', 'on', true);
  UPDATE public.meetings
     SET status = 'LIVE',
         started_at = COALESCE(started_at, now())
   WHERE id = p_meeting_id;
END;
$$;

REVOKE ALL ON FUNCTION public.meeting_start(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meeting_start(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.meeting_end(p_meeting_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting public.meetings%ROWTYPE;
BEGIN
  SELECT * INTO v_meeting FROM public.meetings WHERE id = p_meeting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found';
  END IF;
  IF NOT (v_meeting.host_id = auth.uid()
          OR public.teaches_course(v_meeting.course_id)
          OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Idempotent: only SCHEDULED/LIVE can transition to ENDED.
  IF v_meeting.status NOT IN ('SCHEDULED', 'LIVE') THEN
    RETURN;
  END IF;

  -- Close all still-open attendance rows for this meeting.
  UPDATE public.meeting_attendances
     SET left_at = now()
   WHERE meeting_id = p_meeting_id
     AND left_at IS NULL;

  PERFORM set_config('app.meeting_rpc', 'on', true);
  UPDATE public.meetings
     SET status = 'ENDED',
         ended_at = now()
   WHERE id = p_meeting_id;
END;
$$;

REVOKE ALL ON FUNCTION public.meeting_end(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meeting_end(uuid) TO authenticated;