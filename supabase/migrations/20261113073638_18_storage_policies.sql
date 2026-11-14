-- ============================================================
-- 18_storage_policies: Storage RLS for course-materials and
--     assignment-submissions buckets.
-- ============================================================
-- Design notes
--  * Both buckets are private. Access is granted per-object via
--    policies on storage.objects scoped to the bucket name.
--  * Objects are named `${course_id}/...` for materials and
--    `${course_id}/${submission_id}/...` for submissions.
--    Policies parse the first path segment as course_id and use
--    the existing authorization helpers.
--  * This migration assumes the buckets already exist
--    (course-materials, assignment-submissions).
-- ============================================================

-- ---------- course-materials ----------

CREATE POLICY course_materials_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-materials'
  AND (
    public.is_admin()
    OR public.teaches_course( (storage.foldername(name))[1]::uuid )
  )
);

CREATE POLICY course_materials_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND (
    public.is_admin()
    OR public.teaches_course( (storage.foldername(name))[1]::uuid )
    OR public.is_enrolled(  (storage.foldername(name))[1]::uuid )
  )
);

CREATE POLICY course_materials_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND (public.is_admin() OR owner = auth.uid())
)
WITH CHECK (
  bucket_id = 'course-materials'
  AND (public.is_admin() OR owner = auth.uid())
);

CREATE POLICY course_materials_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-materials'
  AND (public.is_admin() OR owner = auth.uid())
);

-- ---------- assignment-submissions ----------

CREATE POLICY submission_files_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assignment-submissions'
  AND (
    public.is_admin()
    OR public.teaches_course( (storage.foldername(name))[1]::uuid )
    OR public.is_enrolled(   (storage.foldername(name))[1]::uuid )
  )
);

CREATE POLICY submission_files_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'assignment-submissions'
  AND (
    public.is_admin()
    OR public.teaches_course( (storage.foldername(name))[1]::uuid )
    OR owner = auth.uid()
  )
);

CREATE POLICY submission_files_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'assignment-submissions'
  AND (public.is_admin() OR owner = auth.uid())
);

-- Allow students to replace their own submission files (required for upsert)
CREATE POLICY submission_files_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assignment-submissions'
  AND (
    public.is_admin()
    OR public.teaches_course( (storage.foldername(name))[1]::uuid )
    OR owner = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'assignment-submissions'
  AND (
    public.is_admin()
    OR public.teaches_course( (storage.foldername(name))[1]::uuid )
    OR owner = auth.uid()
  )
);