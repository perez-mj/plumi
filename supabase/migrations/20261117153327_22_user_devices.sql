-- ============================================================
-- 22_user_devices: push notification token registration
-- ============================================================

CREATE TABLE public.user_devices (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token      text NOT NULL,
    platform   varchar(20) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX user_devices_token_key ON public.user_devices(token);
CREATE INDEX user_devices_user_id_idx     ON public.user_devices(user_id);

-- token is global-unique: a device can only be bound to one user at a time.
-- ON CONFLICT (token) upsert in the client handles re-binding.

CREATE TRIGGER user_devices_set_updated_at
  BEFORE UPDATE ON public.user_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Users own their device rows. No cross-user reads — an instructor
-- must not see a student's push token.
CREATE POLICY user_devices_own_select ON public.user_devices
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_devices_own_insert ON public.user_devices
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_devices_own_update ON public.user_devices
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_devices_own_delete ON public.user_devices
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_devices_admin_read ON public.user_devices
  FOR SELECT TO authenticated
  USING (public.is_admin());