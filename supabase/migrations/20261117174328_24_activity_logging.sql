-- ============================================================
-- 24_activity_logging:
--   * add generic audit triggers to key tables
--   * drop the client-side insert policy on activity_logs
--   * indexes already exist from 07_admin; nothing to add
-- ============================================================
-- Design notes
--  * The helper writes a row for INSERT / UPDATE / DELETE.
--  * entity_type is the table name; action is "<table>.<op>"
--    in lowercase (e.g. "courses.insert").
--  * metadata carries a small, safe diff-ish payload —
--    never PII (no email, no enrollment_key, no text bodies).
--  * The helper is SECURITY DEFINER, owned by the migration
--    role. RLS on activity_logs is therefore bypassed for the
--    insert; that is intentional. The admin read policy
--    controls visibility.
--  * We deliberately do NOT log:
--        progress               (high volume, student-owned)
--        meeting_attendances    (high volume)
--        conversation_members   (high volume, driven by triggers)
--        messages               (high volume)
--        notifications          (already derived from events)
--        flashcard_reviews      (high volume)
--        question_session_*     (high volume, private)
--  * When a row is soft-deleted (deleted_at set) we log
--    action = "<table>.archive" instead of ".update".
-- ============================================================

-- ---------- helper ----------

CREATE OR REPLACE FUNCTION public.trg_log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor     uuid := auth.uid();
  v_action    text;
  v_entity_id uuid;
  v_metadata  jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_entity_id := (to_jsonb(OLD)->>'id')::uuid;
    v_action := TG_TABLE_NAME || '.delete';
    v_metadata := jsonb_build_object('op', 'DELETE');
  ELSE
    v_entity_id := (to_jsonb(NEW)->>'id')::uuid;

    IF TG_OP = 'INSERT' THEN
      v_action := TG_TABLE_NAME || '.insert';
      v_metadata := jsonb_build_object('op', 'INSERT');
    ELSE
      -- UPDATE: promote to ".archive" when deleted_at flips to non-null
      IF to_jsonb(NEW) ? 'deleted_at'
         AND (to_jsonb(OLD)->>'deleted_at') IS NULL
         AND (to_jsonb(NEW)->>'deleted_at') IS NOT NULL THEN
        v_action := TG_TABLE_NAME || '.archive';
        v_metadata := jsonb_build_object('op', 'UPDATE', 'archived', true);
      ELSE
        v_action := TG_TABLE_NAME || '.update';
        v_metadata := jsonb_build_object('op', 'UPDATE');
      END IF;
    END IF;
  END IF;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (v_actor, v_action, TG_TABLE_NAME, v_entity_id, v_metadata);

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.trg_log_activity() FROM PUBLIC;

-- ---------- drop the client-side insert policy ----------
-- With triggers in place, no client should write to activity_logs.

DROP POLICY IF EXISTS activity_logs_self_insert ON public.activity_logs;

-- ---------- attach triggers ----------
-- Keep this list explicit and minimal. Add tables here when the
-- audit requirement grows.

DROP TRIGGER IF EXISTS log_courses ON public.courses;
CREATE TRIGGER log_courses
  AFTER INSERT OR UPDATE OR DELETE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity();

DROP TRIGGER IF EXISTS log_enrollments ON public.enrollments;
CREATE TRIGGER log_enrollments
  AFTER INSERT OR UPDATE OR DELETE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity();

DROP TRIGGER IF EXISTS log_assignments ON public.assignments;
CREATE TRIGGER log_assignments
  AFTER INSERT OR UPDATE OR DELETE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity();

DROP TRIGGER IF EXISTS log_submissions ON public.submissions;
CREATE TRIGGER log_submissions
  AFTER UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity();
  -- INSERT is student-owned and very high volume; if you want
  -- submission *creation* audited, change to
  --   AFTER INSERT OR UPDATE
  -- and accept the extra rows.

DROP TRIGGER IF EXISTS log_profiles ON public.profiles;
CREATE TRIGGER log_profiles
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity();
  -- profiles are inserted by the signup trigger, so we skip INSERT
  -- here to avoid duplicate rows.

DROP TRIGGER IF EXISTS log_announcements ON public.announcements;
CREATE TRIGGER log_announcements
  AFTER INSERT OR UPDATE OR DELETE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity();

DROP TRIGGER IF EXISTS log_meetings ON public.meetings;
CREATE TRIGGER log_meetings
  AFTER INSERT OR UPDATE OR DELETE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity();

DROP TRIGGER IF EXISTS log_system_settings ON public.system_settings;
CREATE TRIGGER log_system_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity();

DROP TRIGGER IF EXISTS log_categories ON public.categories;
CREATE TRIGGER log_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_activity();