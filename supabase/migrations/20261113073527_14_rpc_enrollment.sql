-- ============================================================
-- 14_rpc_enrollment: atomic, server-verified enrollment RPC.
-- ============================================================
-- The client no longer needs an INSERT policy on enrollments;
-- enrollment_key is verified server-side. Re-enrolling a
-- DROPPED enrollment reactivates it.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.enroll_in_course(
  p_course_id      uuid,
  p_enrollment_key text DEFAULT NULL
)
RETURNS public.enrollments
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course     public.courses;
  v_enrollment public.enrollments;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_course
    FROM public.courses
    WHERE id = p_course_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'course_not_found';
  END IF;
  IF v_course.status <> 'PUBLISHED' THEN
    RAISE EXCEPTION 'course_not_published';
  END IF;
  IF v_course.enrollment_key IS NOT NULL
     AND v_course.enrollment_key <> COALESCE(p_enrollment_key, '') THEN
    RAISE EXCEPTION 'invalid_enrollment_key';
  END IF;

  INSERT INTO public.enrollments (course_id, student_id, status)
  VALUES (p_course_id, auth.uid(), 'ACTIVE')
  ON CONFLICT (course_id, student_id) DO UPDATE
    SET status = 'ACTIVE', completed_at = NULL
    WHERE public.enrollments.status = 'DROPPED'
  RETURNING * INTO v_enrollment;

  IF v_enrollment IS NULL THEN
    RAISE EXCEPTION 'already_enrolled';
  END IF;

  RETURN v_enrollment;
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_in_course(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_in_course(uuid, text) TO authenticated;

COMMIT;