-- ============================================================
-- 21_ai_hardening
--   * Remove client-side INSERT/UPDATE/DELETE on AI generation
--     tables. All writes go through the generate-resource Edge
--     Function using the service-role key.
--   * Reads keep the existing shape (own OR shared-in-course OR admin).
--   * Flashcard reviews remain self-managed (unchanged).
-- ============================================================
-- Rationale: the previous WITH CHECK on material_generations only
-- required created_by = auth.uid(), so a malicious enrolled student
-- could insert arbitrary shared content into their course. RLS must
-- not trust the client to describe what the server produced.

-- ---------- material_generations ----------

DROP POLICY IF EXISTS material_generations_own ON public.material_generations;

CREATE POLICY material_generations_read ON public.material_generations
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin()
    OR (
      is_shared = true
      AND course_id IS NOT NULL
      AND (public.is_enrolled(course_id) OR public.teaches_course(course_id))
    )
  );

-- No INSERT / UPDATE / DELETE policy → denied for authenticated.
-- The Edge Function writes via the service role, which bypasses RLS.

-- ---------- generated_questions ----------

DROP POLICY IF EXISTS generated_questions_read ON public.generated_questions;
DROP POLICY IF EXISTS generated_questions_write ON public.generated_questions;

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

-- No write policies.

-- ---------- flashcards ----------

DROP POLICY IF EXISTS flashcards_read ON public.flashcards;
DROP POLICY IF EXISTS flashcards_write ON public.flashcards;

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

-- No write policies.

-- ---------- ai_requests ----------
-- Keep ai_requests_own as-is: it lets users read their own rows
-- for status polling. To prevent a user from inserting a fake
-- ai_requests row that a generation could later point to, tighten
-- the WITH CHECK so the client can only create PENDING rows for
-- itself. The Edge Function will create PROCESSING rows via the
-- service role and update to COMPLETED/FAILED the same way.

DROP POLICY IF EXISTS ai_requests_own ON public.ai_requests;

CREATE POLICY ai_requests_read ON public.ai_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY ai_requests_self_insert ON public.ai_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'PENDING'
    AND model IS NULL
    AND prompt_tokens IS NULL
    AND output_tokens IS NULL
    AND error_message IS NULL
    AND started_at IS NULL
    AND completed_at IS NULL
  );

-- No UPDATE / DELETE policy for authenticated. The Edge Function
-- manages the lifecycle via the service role.