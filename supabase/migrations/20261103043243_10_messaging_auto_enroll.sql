-- supabase/migrations/<ts>_10_messaging_auto_enroll.sql

-- 1. Auto-add a student to the course conversation when they enroll.
-- Only fires if a COURSE conversation already exists for that course.
CREATE OR REPLACE FUNCTION public.trg_add_enrollee_to_course_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id uuid;
BEGIN
  IF NEW.status <> 'ACTIVE' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO conv_id
    FROM public.conversations
    WHERE type = 'COURSE' AND course_id = NEW.course_id
    LIMIT 1;

  IF conv_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES (conv_id, NEW.student_id)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS add_enrollee_to_course_conversation ON public.enrollments;
CREATE TRIGGER add_enrollee_to_course_conversation
  AFTER INSERT OR UPDATE OF status ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_add_enrollee_to_course_conversation();

-- 2. Backfill any already-enrolled students into existing course convos.
INSERT INTO public.conversation_members (conversation_id, user_id)
SELECT c.id, e.student_id
FROM public.conversations c
JOIN public.enrollments e
  ON e.course_id = c.course_id
 AND e.status = 'ACTIVE'
WHERE c.type = 'COURSE'
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- 3. Bump conversations.updated_at when a message is created
--    so the "sorted by updated_at" list order reflects real activity.
CREATE OR REPLACE FUNCTION public.trg_touch_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_touch_conversation_on_message();