-- ============================================================
-- 21_ai_hardening
--   * Server-managed AI generation writes (Edge Function /
--     service role); clients keep read access + safe mutations.
--   * ai_requests: client may enqueue PENDING rows it owns
--     against materials/courses it can read.
--   * material_generations: owner may toggle is_shared / title
--     only; content is immutable from the client.
--   * generated_questions / flashcards: read-only for clients.
--   * flashcard_reviews: unchanged (self-managed).
-- ============================================================

-- ---------- material_generations ----------

DROP POLICY IF EXISTS material_generations_own ON public.material_generations;

CREATE POLICY material_generations_read ON public.material_generations
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      created_by = auth.uid()
      OR public.is_admin()
      OR (
        is_shared = true
        AND course_id IS NOT NULL
        AND (public.is_enrolled(course_id) OR public.teaches_course(course_id))
      )
    )
  );

-- Owner may rename / toggle sharing; content stays immutable.
CREATE POLICY material_generations_owner_update ON public.material_generations
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.material_generations_guard_owner_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.is_admin()
     AND OLD.created_by = auth.uid()
     AND (
       NEW.content         IS DISTINCT FROM OLD.content
       OR NEW.type         IS DISTINCT FROM OLD.type
       OR NEW.detail_level IS DISTINCT FROM OLD.detail_level
       OR NEW.ai_request_id IS DISTINCT FROM OLD.ai_request_id
       OR NEW.material_id  IS DISTINCT FROM OLD.material_id
       OR NEW.course_id    IS DISTINCT FROM OLD.course_id
       OR NEW.created_by   IS DISTINCT FROM OLD.created_by
     )
  THEN
    RAISE EXCEPTION 'only title and is_shared may be changed by the owner';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS material_generations_guard_owner_update ON public.material_generations;
CREATE TRIGGER material_generations_guard_owner_update
  BEFORE UPDATE ON public.material_generations
  FOR EACH ROW EXECUTE FUNCTION public.material_generations_guard_owner_update();

-- No INSERT / DELETE policy for authenticated.

-- ---------- generated_questions ----------

DROP POLICY IF EXISTS generated_questions_read ON public.generated_questions;
DROP POLICY IF EXISTS generated_questions_write ON public.generated_questions;

CREATE POLICY generated_questions_read ON public.generated_questions
  FOR SELECT TO authenticated
  USING (
    generation_id IN (
      SELECT g.id FROM public.material_generations g
      WHERE g.deleted_at IS NULL
        AND (
          g.created_by = auth.uid()
          OR (g.is_shared = true AND g.course_id IS NOT NULL
              AND (public.is_enrolled(g.course_id) OR public.teaches_course(g.course_id)))
        )
    )
  );

-- ---------- flashcards ----------

DROP POLICY IF EXISTS flashcards_read ON public.flashcards;
DROP POLICY IF EXISTS flashcards_write ON public.flashcards;

CREATE POLICY flashcards_read ON public.flashcards
  FOR SELECT TO authenticated
  USING (
    generation_id IN (
      SELECT g.id FROM public.material_generations g
      WHERE g.deleted_at IS NULL
        AND (
          g.created_by = auth.uid()
          OR (g.is_shared = true AND g.course_id IS NOT NULL
              AND (public.is_enrolled(g.course_id) OR public.teaches_course(g.course_id)))
        )
    )
  );

-- ---------- ai_requests ----------

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
    AND (
      material_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.materials m
        WHERE m.id = material_id
          AND m.deleted_at IS NULL
          AND (
            m.uploaded_by = auth.uid()
            OR public.teaches_course(m.course_id)
            OR public.is_enrolled(m.course_id)
            OR public.is_admin()
          )
      )
    )
    AND (
      course_id IS NULL
      OR public.is_enrolled(course_id)
      OR public.teaches_course(course_id)
      OR public.is_admin()
    )
  );

-- No UPDATE / DELETE policy for authenticated.