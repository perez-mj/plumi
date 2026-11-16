-- ============================================================
-- 11_triggers_messaging: conversation touch, auto-enroll into
--     course conversations, and the conversation_member
--     escalation guard.
-- ============================================================

-- ---------- 11.1 Bump conversations.updated_at on new message ----------

CREATE OR REPLACE FUNCTION public.trg_touch_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.conversations
     SET updated_at = now()
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_conversation_on_message ON public.messages;
CREATE TRIGGER touch_conversation_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_touch_conversation_on_message();

-- ---------- 11.2 Sync enrollee <-> course conversation membership ----------
-- ACTIVE enrollee is added; non-ACTIVE (DROPPED/COMPLETED) is removed.

CREATE OR REPLACE FUNCTION public.trg_sync_enrollee_course_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id uuid;
BEGIN
  SELECT id INTO conv_id
    FROM public.conversations
   WHERE type = 'COURSE' AND course_id = NEW.course_id
   LIMIT 1;

  IF conv_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'ACTIVE' THEN
    INSERT INTO public.conversation_members (conversation_id, user_id)
      VALUES (conv_id, NEW.student_id)
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
  ELSE
    DELETE FROM public.conversation_members
     WHERE conversation_id = conv_id
       AND user_id = NEW.student_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS add_enrollee_to_course_conversation ON public.enrollments;
DROP TRIGGER IF EXISTS sync_enrollee_course_conversation ON public.enrollments;
CREATE TRIGGER sync_enrollee_course_conversation
  AFTER INSERT OR UPDATE OF status ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_enrollee_course_conversation();

-- ---------- 11.3 Guard: only read status and mute may be updated ----------
-- RLS on conversation_members allows a user to UPDATE their own row
-- (for last_read_at / is_muted). This trigger blocks any attempt to
-- change identity/joined columns even if the policy is loosened.

CREATE OR REPLACE FUNCTION public.messaging_guard_member_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.is_admin()
     AND (
       NEW.id              IS DISTINCT FROM OLD.id
       OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
       OR NEW.user_id         IS DISTINCT FROM OLD.user_id
       OR NEW.joined_at       IS DISTINCT FROM OLD.joined_at
     )
  THEN
    RAISE EXCEPTION 'Only read status and mute settings can be updated';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.messaging_guard_member_update() FROM PUBLIC;

DROP TRIGGER IF EXISTS messaging_guard_member_update ON public.conversation_members;
CREATE TRIGGER messaging_guard_member_update
  BEFORE UPDATE ON public.conversation_members
  FOR EACH ROW EXECUTE FUNCTION public.messaging_guard_member_update();