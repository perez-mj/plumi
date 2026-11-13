-- ============================================================
-- 06_meetings: meetings, meeting_attendances
-- ============================================================

-- ---------- Enums ----------

CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');

-- ---------- Tables ----------

CREATE TABLE public.meetings (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id    uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    host_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    title        varchar(255) NOT NULL,
    description  text,
    scheduled_at timestamptz NOT NULL,
    duration     integer NOT NULL DEFAULT 60,
    room_name    varchar(255) NOT NULL,
    status       "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    started_at   timestamptz,
    ended_at     timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.meeting_attendances (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at  timestamptz NOT NULL DEFAULT now(),
    left_at    timestamptz
);

-- ---------- Indexes ----------

CREATE UNIQUE INDEX meetings_room_name_key ON public.meetings(room_name);
CREATE INDEX meetings_course_id_scheduled_at_idx ON public.meetings(course_id, scheduled_at);
CREATE INDEX meetings_status_idx ON public.meetings(status);

CREATE INDEX meeting_attendances_meeting_id_user_id_idx
  ON public.meeting_attendances(meeting_id, user_id);
CREATE INDEX meeting_attendances_user_id_idx ON public.meeting_attendances(user_id);

-- ---------- Triggers ----------

CREATE TRIGGER meetings_set_updated_at
  BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- RLS ----------

ALTER TABLE public.meetings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_attendances ENABLE ROW LEVEL SECURITY;