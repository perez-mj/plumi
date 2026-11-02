-- ============================================================
-- 01_identity: profiles, roles, permissions, role_permissions
-- ============================================================

-- Shared updated_at trigger function (used by all later migrations)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------- Tables ----------

CREATE TABLE public.roles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        varchar(50) NOT NULL,
    description text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.permissions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key         varchar(100) NOT NULL,
    description text
);

CREATE TABLE public.role_permissions (
    role_id       uuid NOT NULL,
    permission_id uuid NOT NULL,
    PRIMARY KEY (role_id, permission_id)
);

-- profiles replaces the old users table; id mirrors auth.users.id
CREATE TABLE public.profiles (
    id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id      uuid NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
    email        varchar(255) NOT NULL,
    first_name   varchar(100) NOT NULL,
    last_name    varchar(100) NOT NULL,
    avatar_url   text,
    bio          text,
    is_active    boolean NOT NULL DEFAULT true,
    last_seen_at timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    deleted_at   timestamptz
);

-- ---------- Indexes ----------

CREATE UNIQUE INDEX roles_name_key ON public.roles(name);
CREATE UNIQUE INDEX permissions_key_key ON public.permissions(key);
CREATE UNIQUE INDEX profiles_email_key ON public.profiles(email);
CREATE INDEX profiles_role_id_idx ON public.profiles(role_id);
CREATE INDEX profiles_is_active_idx ON public.profiles(is_active);

-- ---------- Foreign keys ----------

ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_role_id_fkey
  FOREIGN KEY (role_id) REFERENCES public.roles(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_permission_id_fkey
  FOREIGN KEY (permission_id) REFERENCES public.permissions(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- Triggers ----------

CREATE TRIGGER roles_set_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- RLS (enable now; policies in 08) ----------

ALTER TABLE public.roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;