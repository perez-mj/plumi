-- ============================================================
-- 12_profile_trigger: auto-create public.profiles on signup
-- ============================================================

-- 1. Ensure role names are normalized (lowercase) so the lookup below
--    matches authStore's `role.toLowerCase()` comparison.
--    The seed already inserts 'ADMIN', 'INSTRUCTOR', 'STUDENT' — verify
--    with: SELECT name FROM roles;
--    If they are uppercase, the function below uses UPPER() to find them.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id   uuid;
  v_first     text;
  v_last      text;
BEGIN
  -- Pick the default role. Falls back to 'STUDENT'; if that role row is
  -- missing, the trigger raises and the signup fails loudly (better than
  -- silently creating a profile with no role).
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'STUDENT' LIMIT 1;
  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'student' LIMIT 1;
  END IF;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Default role STUDENT not found in public.roles';
  END IF;

  -- Read the optional first/last name from signup metadata.
  v_first := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), '');
  v_last  := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'last_name',  '')), '');

  INSERT INTO public.profiles (
    id, role_id, email, first_name, last_name, is_active
  ) VALUES (
    NEW.id,
    v_role_id,
    COALESCE(NEW.email, ''),
    COALESCE(v_first, SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(v_last, ''),
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Attach the trigger. Drop first so re-running the migration is safe.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- 3. Keep public.profiles.email in sync if the auth email changes.
--    (Section 6.1 of the docs says this duplication must stay consistent.)
CREATE OR REPLACE FUNCTION public.handle_auth_user_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
       SET email = COALESCE(NEW.email, ''),
           updated_at = now()
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_email_change();

-- 4. Backfill: any auth.users rows that already exist without a profile.
--    Safe to run on a fresh project (inserts nothing).
INSERT INTO public.profiles (id, role_id, email, first_name, last_name)
SELECT
  u.id,
  (SELECT id FROM public.roles WHERE name IN ('STUDENT','student') LIMIT 1),
  COALESCE(u.email, ''),
  COALESCE(NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'first_name','')),''),
           SPLIT_PART(COALESCE(u.email,''), '@', 1)),
  COALESCE(NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'last_name','')),''), '')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
  AND EXISTS (SELECT 1 FROM public.roles WHERE name IN ('STUDENT','student'));