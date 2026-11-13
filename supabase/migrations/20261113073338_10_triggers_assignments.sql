-- ============================================================
-- 10_triggers_assignments: notification triggers for
--     assignments and submissions.
-- ============================================================

-- ---------- 10.1 New published assignment → enrolled students ----------

CREATE OR REPLACE FUNCTION public.trg_notify_new_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
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

-- ---------- 10.2 Submission graded → notify student ----------

CREATE OR REPLACE FUNCTION public.trg_notify_graded_submission()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
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