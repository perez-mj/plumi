-- ============================================================
-- 03_assignments: assignments, submissions, submission_files
-- ============================================================

-- ---------- Enums ----------

CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'LATE', 'GRADED', 'RETURNED');

-- ---------- Tables ----------

CREATE TABLE public.assignments (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id    uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    module_id    uuid REFERENCES public.modules(id) ON DELETE SET NULL,
    created_by   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title        varchar(255) NOT NULL,
    instructions text,
    max_score    decimal(6,2) NOT NULL DEFAULT 100,
    due_at       timestamptz,
    allow_late   boolean NOT NULL DEFAULT false,
    is_published boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    deleted_at   timestamptz
);

CREATE TABLE public.submissions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    graded_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    content       text,
    status        "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    score         decimal(6,2),
    feedback      text,
    submitted_at  timestamptz NOT NULL DEFAULT now(),
    graded_at     timestamptz,
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.submission_files (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
    filename      varchar(255) NOT NULL,
    mime_type     varchar(150),
    size          bigint,
    storage_path  text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- Deferred FK from 02 ----------

ALTER TABLE public.materials
  ADD CONSTRAINT materials_assignment_id_fkey
  FOREIGN KEY (assignment_id) REFERENCES public.assignments(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Indexes ----------

CREATE INDEX assignments_course_id_idx ON public.assignments(course_id);
CREATE INDEX assignments_module_id_idx ON public.assignments(module_id);
CREATE INDEX assignments_due_at_idx    ON public.assignments(due_at);

CREATE INDEX submissions_student_id_idx ON public.submissions(student_id);
CREATE INDEX submissions_status_idx     ON public.submissions(status);
CREATE UNIQUE INDEX submissions_assignment_id_student_id_key
  ON public.submissions(assignment_id, student_id);

CREATE INDEX submission_files_submission_id_idx ON public.submission_files(submission_id);

-- ---------- Triggers ----------

CREATE TRIGGER assignments_set_updated_at
  BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER submissions_set_updated_at
  BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- RLS ----------

ALTER TABLE public.assignments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_files ENABLE ROW LEVEL SECURITY;