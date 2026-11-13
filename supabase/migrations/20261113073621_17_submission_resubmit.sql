-- ============================================================
-- 17_submission_resubmit_guard: defense-in-depth trigger for
--     student self-updates to submissions.
-- ============================================================
-- The submissions_student_update RLS policy (09) already restricts
-- what a student can change. This trigger catches any attempt to
-- tamper with graded fields even if the policy is ever loosened.
-- ============================================================

CREATE OR REPLACE FUNCTION public.submissions_guard_student_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.is_admin()
     AND OLD.student_id = auth.uid()
     AND OLD.status NOT IN ('SUBMITTED', 'LATE', 'RETURNED')
  THEN
    RAISE EXCEPTION 'submission is already graded or returned by an instructor';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.is_admin()
     AND OLD.student_id = auth.uid()
     AND (
       NEW.student_id    IS DISTINCT FROM OLD.student_id
       OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
       OR NEW.graded_by     IS DISTINCT FROM OLD.graded_by
       OR NEW.score         IS DISTINCT FROM OLD.score
       OR NEW.graded_at     IS DISTINCT FROM OLD.graded_at
       OR NEW.feedback      IS DISTINCT FROM OLD.feedback
       OR NEW.status        NOT IN ('SUBMITTED', 'LATE')
     )
  THEN
    RAISE EXCEPTION 'students may only edit content, files, or resubmit before grading';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submissions_guard_student_update ON public.submissions;
CREATE TRIGGER submissions_guard_student_update
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.submissions_guard_student_update();