-- supabase/migrations/20261108000000_11_gamification_sessions.sql
-- ============================================================
-- 11_gamification_sessions:
--   question_session_results, question_session_answers
-- ============================================================
-- Design notes
--  * Gamification is scoped to AI interactive sessions only.
--    These tables never touch progress, submissions, or grades.
--  * Session results are visible only to the owning user. Instructors
--    may compute aggregates from these rows where enabled, but this
--    migration does not grant cross-user SELECT.
--  * No UPDATE / DELETE policies: a recorded session is immutable.
-- ============================================================

CREATE TABLE public.question_session_results (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    generation_id    uuid NOT NULL REFERENCES public.material_generations(id) ON DELETE CASCADE,
    score            integer NOT NULL DEFAULT 0,
    accuracy         numeric(5,2) NOT NULL DEFAULT 0,
    longest_streak   integer NOT NULL DEFAULT 0,
    duration_seconds integer,
    completed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.question_session_answers (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          uuid NOT NULL REFERENCES public.question_session_results(id) ON DELETE CASCADE,
    question_id         uuid NOT NULL REFERENCES public.generated_questions(id) ON DELETE CASCADE,
    is_correct          boolean NOT NULL,
    time_taken_seconds  integer
);

CREATE INDEX question_session_results_user_id_idx
  ON public.question_session_results(user_id, completed_at DESC);
CREATE INDEX question_session_results_generation_id_idx
  ON public.question_session_results(generation_id);
CREATE INDEX question_session_answers_session_id_idx
  ON public.question_session_answers(session_id);

ALTER TABLE public.question_session_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_session_answers ENABLE ROW LEVEL SECURITY;

-- Own rows only
CREATE POLICY question_session_results_own_select ON public.question_session_results
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY question_session_results_own_insert ON public.question_session_results
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY question_session_answers_own_select ON public.question_session_answers
  FOR SELECT TO authenticated
  USING (session_id IN (
    SELECT id FROM public.question_session_results WHERE user_id = auth.uid()
  ));

CREATE POLICY question_session_answers_own_insert ON public.question_session_answers
  FOR INSERT TO authenticated
  WITH CHECK (session_id IN (
    SELECT id FROM public.question_session_results WHERE user_id = auth.uid()
  ));