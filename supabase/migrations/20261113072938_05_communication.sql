-- ============================================================
-- 05_communication: announcements, conversations,
--                   conversation_members, messages, notifications
-- ============================================================

-- ---------- Enums ----------

CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'COURSE', 'GROUP');
CREATE TYPE "NotificationType" AS ENUM (
    'NEW_ASSIGNMENT', 'ASSIGNMENT_DEADLINE', 'ASSIGNMENT_GRADED',
    'NEW_MESSAGE', 'NEW_ANNOUNCEMENT', 'UPCOMING_MEETING',
    'AI_GENERATION_COMPLETED', 'AI_GENERATION_FAILED', 'SYSTEM'
);
CREATE TYPE "AnnouncementScope" AS ENUM ('SYSTEM', 'COURSE');

-- ---------- Tables ----------

CREATE TABLE public.announcements (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    course_id  uuid REFERENCES public.courses(id) ON DELETE CASCADE,
    scope      "AnnouncementScope" NOT NULL DEFAULT 'COURSE',
    title      varchar(255) NOT NULL,
    content    text NOT NULL,
    is_pinned  boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE TABLE public.conversations (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type       "ConversationType" NOT NULL,
    course_id  uuid REFERENCES public.courses(id) ON DELETE CASCADE,
    title      varchar(255),
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.conversation_members (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_at    timestamptz,
    is_muted        boolean NOT NULL DEFAULT false,
    joined_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    content         text NOT NULL,
    attachment_id   uuid REFERENCES public.materials(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    edited_at       timestamptz,
    deleted_at      timestamptz
);

CREATE TABLE public.notifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type        "NotificationType" NOT NULL,
    title       varchar(255) NOT NULL,
    body        text,
    link        varchar(500),
    entity_type varchar(50),
    entity_id   uuid,
    data        jsonb,
    is_read     boolean NOT NULL DEFAULT false,
    read_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- Indexes ----------

CREATE INDEX announcements_course_id_idx  ON public.announcements(course_id);
CREATE INDEX announcements_scope_idx      ON public.announcements(scope);
CREATE INDEX announcements_created_at_idx ON public.announcements(created_at);

CREATE UNIQUE INDEX conversations_course_id_key ON public.conversations(course_id);
CREATE INDEX conversations_type_idx             ON public.conversations(type);

CREATE INDEX conversation_members_user_id_idx ON public.conversation_members(user_id);
CREATE UNIQUE INDEX conversation_members_conversation_id_user_id_key
  ON public.conversation_members(conversation_id, user_id);

CREATE INDEX messages_conversation_id_created_at_idx
  ON public.messages(conversation_id, created_at);
CREATE INDEX messages_sender_id_idx ON public.messages(sender_id);

CREATE INDEX notifications_user_id_is_read_created_at_idx
  ON public.notifications(user_id, is_read, created_at);

-- ---------- Triggers ----------

CREATE TRIGGER announcements_set_updated_at
  BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER conversations_set_updated_at
  BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- RLS ----------

ALTER TABLE public.announcements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications        ENABLE ROW LEVEL SECURITY;