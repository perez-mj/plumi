-- supabase/seed.sql
-- Run automatically by `supabase db reset --linked`, or manually with
--   `npx supabase db push --include-seed`
--
-- Design notes
--  * This seed is idempotent: safe to run repeatedly.
--  * Role names are UPPERCASE ('ADMIN'/'INSTRUCTOR'/'STUDENT'); the
--    01_identity migration also enforces a case-insensitive unique
--    index so 'student' cannot sneak in as a duplicate.
--  * system_settings uses DO UPDATE so changed defaults propagate.
--    If you want to preserve admin overrides, change to DO NOTHING
--    and run this file only on fresh databases.

-- ============================================================
-- 1. PERMISSIONS
-- ============================================================
INSERT INTO public.permissions (key, description) VALUES
  ('user.read',           'View users'),
  ('user.create',         'Create users'),
  ('user.update',         'Update users'),
  ('user.delete',         'Delete / deactivate users'),
  ('role.manage',         'Manage roles and permissions'),
  ('course.read',         'View courses'),
  ('course.create',       'Create courses'),
  ('course.update',       'Update courses'),
  ('course.delete',       'Delete / archive courses'),
  ('course.enroll',       'Enroll in courses'),
  ('course.manage_students', 'View / manage course roster'),
  ('module.manage',       'Manage modules'),
  ('lesson.manage',       'Manage lessons'),
  ('material.upload',     'Upload learning materials'),
  ('material.delete',     'Delete learning materials'),
  ('announcement.manage', 'Create course announcements'),
  ('assignment.manage',   'Create / edit assignments'),
  ('assignment.submit',   'Submit assignments'),
  ('assignment.grade',    'Grade submissions'),
  ('meeting.schedule',    'Schedule virtual meetings'),
  ('meeting.join',        'Join virtual meetings'),
  ('message.send',        'Send messages'),
  ('ai.generate',         'Generate AI learning materials'),
  ('ai.share',            'Share AI generations with course'),
  ('admin.dashboard',     'Access admin dashboard'),
  ('admin.activity_log',  'View activity logs'),
  ('system.settings',     'Manage system settings')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 2. ROLES
-- ============================================================
INSERT INTO public.roles (name, description) VALUES
  ('ADMIN',      'Full system access'),
  ('INSTRUCTOR', 'Teaches courses and manages learning content'),
  ('STUDENT',    'Enrolled learner')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 3. ROLE_PERMISSIONS
-- ============================================================

-- ADMIN gets everything
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'ADMIN'
ON CONFLICT DO NOTHING;

-- INSTRUCTOR
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key = ANY (ARRAY[
  'course.read', 'course.create', 'course.update', 'course.delete',
  'course.manage_students',
  'module.manage', 'lesson.manage',
  'material.upload', 'material.delete',
  'announcement.manage',
  'assignment.manage', 'assignment.grade',
  'meeting.schedule', 'meeting.join',
  'message.send',
  'ai.generate', 'ai.share',
  'user.read'
])
WHERE r.name = 'INSTRUCTOR'
ON CONFLICT DO NOTHING;

-- STUDENT
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key = ANY (ARRAY[
  'course.read', 'course.enroll',
  'meeting.join',
  'assignment.submit',
  'message.send',
  'ai.generate'
])
WHERE r.name = 'STUDENT'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. SYSTEM SETTINGS
--    DO UPDATE so seed changes propagate on re-run. The
--    system_settings_set_updated_at trigger owns updated_at.
-- ============================================================
INSERT INTO public.system_settings (key, value) VALUES
  ('ai.rate_limit_per_hour',        '20'::jsonb),
  ('ai.max_detail_level',           '"COMPREHENSIVE"'::jsonb),
  ('ai.model',                      '"gemini-2.5-flash"'::jsonb),
  ('upload.max_file_size_mb',       '50'::jsonb),
  ('upload.allowed_mime_types',     '[
     "application/pdf",
     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
     "application/vnd.openxmlformats-officedocument.presentationml.presentation",
     "image/png",
     "image/jpeg",
     "image/webp"
   ]'::jsonb),
  ('meeting.default_duration_min',  '60'::jsonb),
  ('meeting.reminder_minutes',      '30'::jsonb),
  ('platform.name',                 '"Plumi"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.system_settings (key, value) VALUES
  ('gamification.defaults', '{
     "enabled": true,
     "base_points":       { "EASY": 10, "MEDIUM": 20, "HARD": 30 },
     "combo_thresholds":  { "2": 5, "3": 10 },
     "combo_cap":         3,
     "completion_bonus":  5,
     "time_bonus_enabled": false
   }'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- ============================================================
-- 5. BACKFILL: any auth.users without a profile
--    (safe no-op on a fresh reset; the seed runs after
--    19_profile_trigger, which could not backfill because
--    roles did not exist yet at that point.)
-- ============================================================
INSERT INTO public.profiles (id, role_id, email, first_name, last_name)
SELECT
  u.id,
  (SELECT id FROM public.roles WHERE name = 'STUDENT' LIMIT 1),
  COALESCE(u.email, ''),
  COALESCE(NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'first_name','')),''),
           SPLIT_PART(COALESCE(u.email,''), '@', 1)),
  COALESCE(NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'last_name','')),''), '')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
  AND EXISTS (SELECT 1 FROM public.roles WHERE name = 'STUDENT');