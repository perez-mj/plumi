-- ============================================================
-- 12_triggers_announcements_meetings: notification triggers
--     for announcements, meetings, and messages.
-- ============================================================
-- NOTE: If you intentionally do NOT want message notifications,
-- delete the "12.3" block below. The old
-- "disable_message_notifications" migration is gone — do not
-- recreate it.
-- ============================================================

-- ---------- 12.1 New announcement → course members / all users ----------

CREATE OR REPLACE FUNCTION public.trg_notify_new_announcement()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.scope = 'COURSE' AND NEW.course_id IS NOT NULL THEN
    PERFORM public.notify_user(
      e.student_id,
      NEW.author_id,
      'NEW_ANNOUNCEMENT',
      NEW.title,
      left(NEW.content, 160),
      '/app/student/courses/' || NEW.course_id::text,
      'announcement',
      NEW.id,
      jsonb_build_object('course_id', NEW.course_id)
    )
    FROM public.enrollments e
    WHERE e.course_id = NEW.course_id
      AND e.status = 'ACTIVE';
  ELSIF NEW.scope = 'SYSTEM' THEN
    PERFORM public.notify_user(
      p.id,
      NEW.author_id,
      'NEW_ANNOUNCEMENT',
      NEW.title,
      left(NEW.content, 160),
      '/app',
      'announcement',
      NEW.id,
      jsonb_build_object('scope', 'SYSTEM')
    )
    FROM public.profiles p
    WHERE p.deleted_at IS NULL
      AND p.is_active = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_announcement ON public.announcements;
CREATE TRIGGER notify_new_announcement
  AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_announcement();

-- ---------- 12.2 New meeting → enrolled students ----------

CREATE OR REPLACE FUNCTION public.trg_notify_new_meeting()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'CANCELLED' THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify_user(
    e.student_id,
    NEW.host_id,
    'UPCOMING_MEETING',
    'New meeting: ' || NEW.title,
    to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'Mon DD, HH24:MI') ||
      ' • ' || NEW.duration::text || ' min',
    '/app/meetings/' || NEW.id::text || '/room?room=' || NEW.room_name,
    'meeting',
    NEW.id,
    jsonb_build_object('course_id', NEW.course_id)
  )
  FROM public.enrollments e
  WHERE e.course_id = NEW.course_id
    AND e.status = 'ACTIVE';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_meeting ON public.meetings;
CREATE TRIGGER notify_new_meeting
  AFTER INSERT ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_meeting();

-- ---------- 12.3 New message → other conversation members ----------
-- Delete this block if message notifications are not wanted.

CREATE OR REPLACE FUNCTION public.trg_notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_title  varchar;
  v_sender_name varchar;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(c.title, c.type::text)
    INTO v_conv_title
    FROM public.conversations c
    WHERE c.id = NEW.conversation_id;

  SELECT (p.first_name || ' ' || p.last_name)
    INTO v_sender_name
    FROM public.profiles p
    WHERE p.id = NEW.sender_id;

  PERFORM public.notify_user(
    cm.user_id,
    NEW.sender_id,
    'NEW_MESSAGE',
    COALESCE(v_sender_name, 'Someone') || ' • ' || COALESCE(v_conv_title, 'Conversation'),
    left(NEW.content, 140),
    '/app/messages?conversation=' || NEW.conversation_id::text,
    'message',
    NEW.id,
    jsonb_build_object('conversation_id', NEW.conversation_id)
  )
  FROM public.conversation_members cm
  WHERE cm.conversation_id = NEW.conversation_id
    AND cm.user_id <> NEW.sender_id
    AND cm.is_muted = false;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_message ON public.messages;
CREATE TRIGGER notify_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_message();