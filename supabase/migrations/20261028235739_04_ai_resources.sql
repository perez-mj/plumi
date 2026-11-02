-- ============================================================
-- 04_ai_resources: ai_requests, material_generations, flashcards,
--                  generated_questions, flashcard_reviews
-- ============================================================

-- ---------- Enums ----------

CREATE TYPE "AiGenerationType" AS ENUM ('SUMMARY', 'REVIEWER', 'FLASHCARDS', 'QUESTIONS', 'STUDY_GUIDE');
CREATE TYPE "AiDetailLevel"    AS ENUM ('SHORT', 'STANDARD', 'COMPREHENSIVE');
CREATE TYPE "AiRequestStatus"  AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "QuestionType"     AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'IDENTIFICATION', 'SHORT_ANSWER');

-- ---------- Tables ----------

CREATE TABLE public.ai_requests (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id     uuid REFERENCES public.courses(id) ON DELETE SET NULL,
    material_id   uuid REFERENCES public.materials(id) ON DELETE SET NULL,
    type          "AiGenerationType" NOT NULL,
    detail_level  "AiDetailLevel" NOT NULL DEFAULT 'STANDARD',
    status        "AiRequestStatus" NOT NULL DEFAULT 'PENDING',
    model         varchar(100),
    prompt_tokens integer,
    output_tokens integer,
    options       jsonb,
    error_message text,
    started_at    timestamptz,
    completed_at  timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.material_generations (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_request_id uuid NOT NULL REFERENCES public.ai_requests(id) ON DELETE CASCADE,
    material_id   uuid REFERENCES public.materials(id) ON DELETE SET NULL,
    course_id     uuid REFERENCES public.courses(id) ON DELETE SET NULL,
    created_by    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    type          "AiGenerationType" NOT NULL,
    detail_level  "AiDetailLevel" NOT NULL DEFAULT 'STANDARD',
    title         varchar(255) NOT NULL,
    content       jsonb NOT NULL,
    is_shared     boolean NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    deleted_at    timestamptz
);

CREATE TABLE public.flashcards (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_id uuid NOT NULL REFERENCES public.material_generations(id) ON DELETE CASCADE,
    question      text NOT NULL,
    answer        text NOT NULL,
    position      integer NOT NULL DEFAULT 0
);

CREATE TABLE public.generated_questions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_id uuid NOT NULL REFERENCES public.material_generations(id) ON DELETE CASCADE,
    type          "QuestionType" NOT NULL,
    question      text NOT NULL,
    choices       jsonb,
    answer        text NOT NULL,
    explanation   text,
    position      integer NOT NULL DEFAULT 0
);

CREATE TABLE public.flashcard_reviews (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    flashcard_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
    user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    known        boolean NOT NULL,
    reviewed_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- Indexes ----------

CREATE INDEX ai_requests_user_id_created_at_idx ON public.ai_requests(user_id, created_at);
CREATE INDEX ai_requests_status_idx             ON public.ai_requests(status);
CREATE INDEX ai_requests_material_id_idx        ON public.ai_requests(material_id);

CREATE UNIQUE INDEX material_generations_ai_request_id_key
  ON public.material_generations(ai_request_id);
CREATE INDEX material_generations_created_by_idx ON public.material_generations(created_by);
CREATE INDEX material_generations_course_id_idx  ON public.material_generations(course_id);
CREATE INDEX material_generations_material_id_idx ON public.material_generations(material_id);
CREATE INDEX material_generations_course_id_is_shared_idx
  ON public.material_generations(course_id, is_shared);

CREATE INDEX flashcards_generation_id_idx ON public.flashcards(generation_id);
CREATE INDEX generated_questions_generation_id_idx ON public.generated_questions(generation_id);
CREATE INDEX flashcard_reviews_user_id_flashcard_id_idx
  ON public.flashcard_reviews(user_id, flashcard_id);

-- ---------- Triggers ----------

CREATE TRIGGER material_generations_set_updated_at
  BEFORE UPDATE ON public.material_generations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- RLS ----------

ALTER TABLE public.ai_requests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_reviews   ENABLE ROW LEVEL SECURITY;