-- ============================================================
-- 09_rls_policies: single source of truth for all policies.
-- ============================================================
-- Design notes
--  * Every table with RLS enabled has at least one explicit
--    policy. Enabling RLS with no policies is "deny all".
--  * Role names are stored UPPERCASE; helpers compare LOWER().
--  * enrollments: NO client INSERT policy — enrollment must go
--    through enroll_in_course RPC (14). Students may UPDATE
--    only their own row to ACTIVE/DROPPED.
--  * submissions_student_update: students may update their own
--    row only while SUBMITTED/LATE/RETURNED, and only to
--    SUBMITTED/LATE with graded fields NULL. Enforced in RLS
--    *and* by trigger (17).
--  * conversation_members: INSERT is admin-only. The
--    messaging_open_* RPCs (13) bypass via SECURITY DEFINER.
--    UPDATE is self-only, guarded by trigger (11).
-- ============================================================

-- ============================================================
-- 01 — identity
-- ============================================================

CREATE POLICY roles_read            ON public.roles            FOR SELECT TO authenticated USING (true);
CREATE POLICY permissions_read      ON public.permissions      FOR SELECT TO authenticated USING (true);
CREATE POLICY role_permissions_read ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY profiles_self_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY profiles_instructor_read_students ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.current_role_name() = 'instructor'
    AND EXISTS (
      SELECT 1
      FROM public.enrollments e
      JOIN public.courses c ON c.id = e.course_id
      WHERE e.student_id = profiles.id
        AND c.instructor_id = auth.uid()
    )
  );

-- ============================================================
-- 02 — courses & learning content
-- ============================================================

CREATE POLICY categories_read ON public.categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY categories_admin_write ON public.categories
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY courses_read ON public.courses
  FOR SELECT TO authenticated
  USING (
    status = 'PUBLISHED'
    OR instructor_id = auth.uid()
    OR public.is_enrolled(id)
    OR public.is_admin()
  );

CREATE POLICY courses_instructor_insert ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_role_name() IN ('instructor', 'admin')
    AND (instructor_id = auth.uid() OR public.is_admin())
  );

CREATE POLICY courses_instructor_update ON public.courses
  FOR UPDATE TO authenticated
  USING (instructor_id = auth.uid() OR public.is_admin())
  WITH CHECK (instructor_id = auth.uid() OR public.is_admin());

CREATE POLICY courses_instructor_delete ON public.courses
  FOR DELETE TO authenticated
  USING (instructor_id = auth.uid() OR public.is_admin());

CREATE POLICY enrollments_read ON public.enrollments
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.teaches_course(course_id)
    OR public.is_admin()
  );

-- NO INSERT policy: enrollment goes through enroll_in_course().

CREATE POLICY enrollments_student_update ON public.enrollments
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (
    student_id = auth.uid()
    AND status IN ('ACTIVE', 'DROPPED')
  );

CREATE POLICY enrollments_student_delete ON public.enrollments
  FOR DELETE TO authenticated
  USING (student_id = auth.uid() OR public.is_admin());

CREATE POLICY modules_read ON public.modules
  FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.teaches_course(course_id)
    OR public.is_enrolled(course_id)
    OR public.is_admin()
  );

CREATE POLICY modules_instructor_write ON public.modules
  FOR ALL TO authenticated
  USING (public.teaches_course(course_id) OR public.is_admin())
  WITH CHECK (public.teaches_course(course_id) OR public.is_admin());

CREATE POLICY lessons_read ON public.lessons
  FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.teaches_course(course_id)
    OR public.is_enrolled(course_id)
    OR public.is_admin()
  );

CREATE POLICY lessons_instructor_write ON public.lessons
  FOR ALL TO authenticated
  USING (public.teaches_course(course_id) OR public.is_admin())
  WITH CHECK (public.teaches_course(course_id) OR public.is_admin());

CREATE POLICY materials_read ON public.materials
  FOR SELECT TO authenticated
  USING (
    is_published = true
    OR uploaded_by = auth.uid()
    OR public.teaches_course(course_id)
    OR public.is_enrolled(course_id)
    OR public.is_admin()
  );

CREATE POLICY materials_upload ON public.materials
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (public.teaches_course(course_id) OR public.is_admin())
  );

CREATE POLICY materials_write ON public.materials
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.teaches_course(course_id) OR public.is_admin())
  WITH CHECK (uploaded_by = auth.uid() OR public.teaches_course(course_id) OR public.is_admin());

CREATE POLICY materials_delete ON public.materials
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.teaches_course(course_id) OR public.is_admin());

CREATE POLICY progress_read ON public.progress
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.teaches_course(course_id)
    OR public.is_admin()
  );

CREATE POLICY progress_student_write ON public.progress
  FOR ALL TO authenticated
  USING (student_id = auth.uid() OR public.is_admin())
  WITH CHECK (student_id = auth.uid() OR public.is_admin());

-- ============================================================
-- 03 — assignments & grading
-- ============================================================

CREATE POLICY assignments_read ON public.assignments
  FOR SELECT TO authenticated
  USING (
    is_published = true
    OR created_by = auth.uid()
    OR public.teaches_course(course_id)
    OR public.is_enrolled(course_id)
    OR public.is_admin()
  );

CREATE POLICY assignments_write ON public.assignments
  FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.teaches_course(course_id) OR public.is_admin())
  WITH CHECK (created_by = auth.uid() OR public.teaches_course(course_id) OR public.is_admin());

CREATE POLICY submissions_read ON public.submissions
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR graded_by = auth.uid()
    OR public.is_admin()
    OR assignment_id IN (
      SELECT a.id
      FROM public.assignments a
      JOIN public.courses c ON c.id = a.course_id
      WHERE c.instructor_id = auth.uid()
    )
  );

CREATE POLICY submissions_student_insert ON public.submissions
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY submissions_student_update ON public.submissions
  FOR UPDATE TO authenticated
  USING (
    student_id = auth.uid()
    AND status IN ('SUBMITTED', 'LATE', 'RETURNED')
  )
  WITH CHECK (
    student_id = auth.uid()
    AND status IN ('SUBMITTED', 'LATE')
    AND graded_by IS NULL
    AND score IS NULL
    AND graded_at IS NULL
  );

CREATE POLICY submissions_grader_update ON public.submissions
  FOR UPDATE TO authenticated
  USING (
    graded_by = auth.uid()
    OR public.is_admin()
    OR assignment_id IN (
      SELECT a.id
      FROM public.assignments a
      JOIN public.courses c ON c.id = a.course_id
      WHERE c.instructor_id = auth.uid()
    )
  )
  WITH CHECK (true);

-- Students can read their own submission files.
-- Course instructors can read submission files for any assignment
-- in their course, regardless of whether grading has occurred.
-- Admins can read everything.
CREATE POLICY submission_files_read ON public.submission_files
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR submission_id IN (
      SELECT s.id
      FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.student_id = auth.uid()
         OR public.teaches_course(a.course_id)
    )
  );

CREATE POLICY submission_files_student_insert ON public.submission_files
  FOR INSERT TO authenticated
  WITH CHECK (
    submission_id IN (
      SELECT s.id FROM public.submissions s
      WHERE s.student_id = auth.uid()
        AND s.status IN ('SUBMITTED', 'LATE', 'RETURNED')
    )
  );

-- Students may delete their own submission files while the parent
-- submission is still editable. Once graded, the rows are frozen.
CREATE POLICY submission_files_student_delete ON public.submission_files
  FOR DELETE TO authenticated
  USING (
    submission_id IN (
      SELECT s.id FROM public.submissions s
      WHERE s.student_id = auth.uid()
        AND s.status IN ('SUBMITTED', 'LATE', 'RETURNED')
    )
  );

  
-- ============================================================
-- 04 — AI learning resources
-- ============================================================

CREATE POLICY ai_requests_own ON public.ai_requests
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY material_generations_own ON public.material_generations
  FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin()
    OR (
      is_shared = true
      AND course_id IS NOT NULL
      AND (public.is_enrolled(course_id) OR public.teaches_course(course_id))
    )
  )
  WITH CHECK (created_by = auth.uid() OR public.is_admin());

CREATE POLICY flashcards_read ON public.flashcards
  FOR SELECT TO authenticated
  USING (
    generation_id IN (
      SELECT g.id FROM public.material_generations g
      WHERE g.created_by = auth.uid()
        OR (g.is_shared = true AND g.course_id IS NOT NULL
            AND (public.is_enrolled(g.course_id) OR public.teaches_course(g.course_id)))
    )
  );

CREATE POLICY flashcards_write ON public.flashcards
  FOR ALL TO authenticated
  USING (
    generation_id IN (
      SELECT g.id FROM public.material_generations g WHERE g.created_by = auth.uid()
    )
  )
  WITH CHECK (
    generation_id IN (
      SELECT g.id FROM public.material_generations g WHERE g.created_by = auth.uid()
    )
  );

CREATE POLICY generated_questions_read ON public.generated_questions
  FOR SELECT TO authenticated
  USING (
    generation_id IN (
      SELECT g.id FROM public.material_generations g
      WHERE g.created_by = auth.uid()
        OR (g.is_shared = true AND g.course_id IS NOT NULL
            AND (public.is_enrolled(g.course_id) OR public.teaches_course(g.course_id)))
    )
  );

CREATE POLICY generated_questions_write ON public.generated_questions
  FOR ALL TO authenticated
  USING (
    generation_id IN (
      SELECT g.id FROM public.material_generations g WHERE g.created_by = auth.uid()
    )
  )
  WITH CHECK (
    generation_id IN (
      SELECT g.id FROM public.material_generations g WHERE g.created_by = auth.uid()
    )
  );

CREATE POLICY flashcard_reviews_own ON public.flashcard_reviews
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 05 — communication
-- ============================================================

CREATE POLICY announcements_read ON public.announcements
  FOR SELECT TO authenticated
  USING (
    scope = 'SYSTEM'
    OR (course_id IS NOT NULL
        AND (public.is_enrolled(course_id) OR public.teaches_course(course_id)))
    OR public.is_admin()
    OR author_id = auth.uid()
  );

CREATE POLICY announcements_author_write ON public.announcements
  FOR ALL TO authenticated
  USING (author_id = auth.uid() OR public.is_admin())
  WITH CHECK (author_id = auth.uid() OR public.is_admin());

CREATE POLICY conversations_read ON public.conversations
  FOR SELECT TO authenticated
  USING (
    public.is_conversation_member(id)
    OR public.is_admin()
    OR (course_id IS NOT NULL AND public.teaches_course(course_id))
  );

CREATE POLICY conversations_member_insert ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR public.is_admin());

CREATE POLICY conversations_admin_write ON public.conversations
  FOR UPDATE TO authenticated
  USING (public.is_conversation_member(id) OR public.is_admin())
  WITH CHECK (public.is_conversation_member(id) OR public.is_admin());

CREATE POLICY conversation_members_read ON public.conversation_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_conversation_member(conversation_id)
    OR public.is_admin()
  );

-- INSERT is admin-only. The messaging_open_* RPCs (13) bypass via
-- SECURITY DEFINER.
CREATE POLICY conversation_members_insert ON public.conversation_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- UPDATE is self-only, guarded by messaging_guard_member_update (11).
CREATE POLICY conversation_members_self_update ON public.conversation_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY messages_member_read ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id) OR public.is_admin());

CREATE POLICY messages_member_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_member(conversation_id)
  );

CREATE POLICY messages_sender_update ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR public.is_admin())
  WITH CHECK (sender_id = auth.uid() OR public.is_admin());

CREATE POLICY notifications_own ON public.notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 06 — meetings
-- ============================================================

CREATE POLICY meetings_read ON public.meetings
  FOR SELECT TO authenticated
  USING (
    public.is_enrolled(course_id)
    OR public.teaches_course(course_id)
    OR host_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY meetings_write ON public.meetings
  FOR ALL TO authenticated
  USING (host_id = auth.uid() OR public.teaches_course(course_id) OR public.is_admin())
  WITH CHECK (host_id = auth.uid() OR public.teaches_course(course_id) OR public.is_admin());

CREATE POLICY meeting_attendances_read ON public.meeting_attendances
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR meeting_id IN (
      SELECT m.id FROM public.meetings m WHERE m.host_id = auth.uid()
    )
  );

CREATE POLICY meeting_attendances_self_write ON public.meeting_attendances
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ============================================================
-- 07 — admin
-- ============================================================

CREATE POLICY activity_logs_admin_read ON public.activity_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY activity_logs_self_insert ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY system_settings_admin ON public.system_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());