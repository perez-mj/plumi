-- ============================================================
-- 24_submissions_select_policy
-- ============================================================
-- Background
--   Migration 09 defines INSERT and UPDATE policies on
--   `submissions` but NO SELECT policy. RLS therefore hides every
--   row from the client.
--
--   Consequences:
--     1. `getMySubmission()` returns `null` even when a row exists,
--        so the client always believes this is a first submission.
--     2. The UPSERT (`on_conflict=assignment_id,student_id`) cannot
--        see the conflicting row. Postgres falls through to the
--        INSERT branch, hits the unique index
--        `submissions_assignment_id_student_id_key`, and the
--        aborted UPDATE branch then fails the USING check with
--        SQLSTATE 42501 ("new row violates row-level security
--        policy for table \"submissions\"").
--     3. Graders can UPDATE submissions in their courses but
--        cannot read them, which breaks the grading list.
--
--   This migration adds the missing SELECT policies. The INSERT
--   and UPDATE policies from 09 are unchanged and remain the
--   write-side boundary.
-- ============================================================

-- Students can read their own submissions (drives getMySubmission
-- and lets UPSERT / UPDATE locate the row it is about to modify).
CREATE POLICY submissions_student_read ON public.submissions
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- Graders can read submissions for assignments in courses they
-- teach. Admins can read everything. Mirrors the scope of
-- submissions_grader_update.
CREATE POLICY submissions_grader_read ON public.submissions
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR assignment_id IN (
      SELECT a.id
      FROM public.assignments a
      JOIN public.courses c ON c.id = a.course_id
      WHERE c.instructor_id = auth.uid()
    )
  );