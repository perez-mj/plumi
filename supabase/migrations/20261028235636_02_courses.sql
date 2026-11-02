-- ============================================================
-- 02_courses: categories, courses, enrollments, modules,
--             lessons, materials, progress
-- ============================================================

-- ---------- Enums ----------

CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DROPPED');
CREATE TYPE "CourseStatus"     AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "MaterialType"     AS ENUM ('PDF', 'DOCX', 'PPTX', 'IMAGE', 'VIDEO', 'LINK', 'YOUTUBE', 'TEXT');
CREATE TYPE "ProgressStatus"   AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- ---------- Tables ----------

CREATE TABLE public.categories (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       varchar(100) NOT NULL,
    slug       varchar(120) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.courses (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    instructor_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    category_id          uuid REFERENCES public.categories(id) ON DELETE SET NULL,
    title                varchar(255) NOT NULL,
    code                 varchar(50),
    description          text,
    cover_image_url      text,
    learning_objectives  text[],
    status               "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    enrollment_key       varchar(100),
    start_date           date,
    end_date             date,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    deleted_at           timestamptz
);

CREATE TABLE public.enrollments (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id    uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    student_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status       "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    enrolled_at  timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE TABLE public.modules (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id    uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title        varchar(255) NOT NULL,
    description  text,
    position     integer NOT NULL DEFAULT 0,
    is_published boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lessons (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id    uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
    course_id    uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title        varchar(255) NOT NULL,
    content      text,
    video_url    text,
    position     integer NOT NULL DEFAULT 0,
    is_published boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- assignment_id FK is added in 03 once assignments exists
CREATE TABLE public.materials (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id      uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    module_id      uuid REFERENCES public.modules(id) ON DELETE SET NULL,
    lesson_id      uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
    assignment_id  uuid,
    uploaded_by    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    type           "MaterialType" NOT NULL,
    title          varchar(255) NOT NULL,
    filename       varchar(255),
    mime_type      varchar(150),
    size           bigint,
    storage_path   text,
    external_url   text,
    extracted_text text,
    extracted_at   timestamptz,
    is_published   boolean NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    deleted_at     timestamptz
);

CREATE TABLE public.progress (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    student_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id     uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    lesson_id     uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
    material_id   uuid REFERENCES public.materials(id) ON DELETE SET NULL,
    status        "ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    completed_at  timestamptz,
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- Indexes ----------

CREATE UNIQUE INDEX categories_name_key ON public.categories(name);
CREATE UNIQUE INDEX categories_slug_key ON public.categories(slug);

CREATE UNIQUE INDEX courses_code_key ON public.courses(code);
CREATE INDEX courses_instructor_id_idx ON public.courses(instructor_id);
CREATE INDEX courses_category_id_idx   ON public.courses(category_id);
CREATE INDEX courses_status_idx        ON public.courses(status);

CREATE INDEX enrollments_student_id_idx ON public.enrollments(student_id);
CREATE UNIQUE INDEX enrollments_course_id_student_id_key
  ON public.enrollments(course_id, student_id);

CREATE INDEX modules_course_id_position_idx ON public.modules(course_id, position);

CREATE INDEX lessons_module_id_position_idx ON public.lessons(module_id, position);
CREATE INDEX lessons_course_id_idx          ON public.lessons(course_id);

CREATE INDEX materials_course_id_idx     ON public.materials(course_id);
CREATE INDEX materials_module_id_idx     ON public.materials(module_id);
CREATE INDEX materials_lesson_id_idx     ON public.materials(lesson_id);
CREATE INDEX materials_assignment_id_idx ON public.materials(assignment_id);
CREATE INDEX materials_uploaded_by_idx   ON public.materials(uploaded_by);

CREATE INDEX progress_student_id_material_id_idx ON public.progress(student_id, material_id);
CREATE INDEX progress_student_id_course_id_idx   ON public.progress(student_id, course_id);
CREATE INDEX progress_enrollment_id_idx          ON public.progress(enrollment_id);
CREATE UNIQUE INDEX progress_student_id_lesson_id_key
  ON public.progress(student_id, lesson_id);

-- ---------- Triggers ----------

CREATE TRIGGER courses_set_updated_at
  BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER modules_set_updated_at
  BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER lessons_set_updated_at
  BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER materials_set_updated_at
  BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER progress_set_updated_at
  BEFORE UPDATE ON public.progress FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- RLS ----------

ALTER TABLE public.categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress    ENABLE ROW LEVEL SECURITY;