-- ============================================================
-- 07_admin: activity_logs, system_settings
-- ============================================================

-- ---------- Tables ----------

CREATE TABLE public.activity_logs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    action      varchar(100) NOT NULL,
    entity_type varchar(50),
    entity_id   uuid,
    metadata    jsonb,
    ip_address  varchar(45),
    user_agent  text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.system_settings (
    key        varchar(100) PRIMARY KEY,
    value      jsonb NOT NULL,
    updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Indexes ----------

CREATE INDEX activity_logs_user_id_idx    ON public.activity_logs(user_id);
CREATE INDEX activity_logs_action_idx     ON public.activity_logs(action);
CREATE INDEX activity_logs_created_at_idx ON public.activity_logs(created_at);
CREATE INDEX activity_logs_entity_type_entity_id_idx
  ON public.activity_logs(entity_type, entity_id);

-- ---------- Triggers ----------

CREATE TRIGGER system_settings_set_updated_at
  BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- RLS ----------

ALTER TABLE public.activity_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;