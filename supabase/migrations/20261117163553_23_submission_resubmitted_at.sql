-- ============================================================
-- 23_submission_resubmitted_at
-- ============================================================
-- Background
--   The original student-update guard (migration 17) treats
--   `submitted_at` as immutable: it is the *first* submission
--   time. The client previously re-sent `submitted_at` on every
--   resubmit, which the trigger rejected with a 42501 during the
--   upsert's UPDATE branch.
--
--   This migration:
--     1. Adds `resubmitted_at` to record the most recent resubmit.
--     2. Backfills it to NULL for existing rows.
--     3. Keeps `submitted_at` immutable for students.
--     4. Allows students to set `resubmitted_at` on update.
-- ============================================================

ALTER TABLE public.submissions
  ADD COLUMN resubmitted_at timestamptz;

COMMENT ON COLUMN public.submissions.submitted_at  IS
  'First submission timestamp. Immutable after insert (students).';
COMMENT ON COLUMN public.submissions.resubmitted_at IS
  'Most recent resubmission timestamp. NULL until the student resubmits.';

-- ------------------------------------------------------------
-- Extend the student-update guard to permit `resubmitted_at`
-- changes while still forbidding `submitted_at` changes.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submissions_guard_student_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Block any student write to a submission that is already
  -- graded/returned (belt-and-braces; RLS also enforces this).
  IF auth.uid() IS NOT NULL
     AND NOT public.is_admin()
     AND OLD.student_id = auth.uid()
     AND OLD.status NOT IN ('SUBMITTED', 'LATE', 'RETURNED')
  THEN
    RAISE EXCEPTION 'submission is already graded or returned by an instructor';
  END IF;

  -- Students may edit content, status (SUBMITTED/LATE), and
  -- resubmitted_at. Everything else is immutable.
  IF auth.uid() IS NOT NULL
     AND NOT public.is_admin()
     AND OLD.student_id = auth.uid()
     AND (
       NEW.student_id       IS DISTINCT FROM OLD.student_id
       OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
       OR NEW.graded_by     IS DISTINCT FROM OLD.graded_by
       OR NEW.score         IS DISTINCT FROM OLD.score
       OR NEW.graded_at     IS DISTINCT FROM OLD.graded_at
       OR NEW.feedback      IS DISTINCT FROM OLD.feedback
       OR NEW.submitted_at  IS DISTINCT FROM OLD.submitted_at   -- still immutable
       OR NEW.status        NOT IN ('SUBMITTED', 'LATE')
     )
  THEN
    RAISE EXCEPTION 'students may only edit content, files, status, or resubmitted_at before grading';
  END IF;

  RETURN NEW;
END;
$$;