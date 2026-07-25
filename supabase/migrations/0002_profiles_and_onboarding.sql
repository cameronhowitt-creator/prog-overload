-- Profiles expansion + onboarding (PRD §6.6). Apply after 0001_init.sql.
--
-- 0001 already created `profiles` with `user_id` as PK (→ domain Profile.id) and
-- `exercises`, `logged_sets` with RLS. This migration adds the full onboarding
-- field set, the user_active_lifts join table, and a source tag on logged sets.

-- ── profiles: add onboarding fields ─────────────────────────────────────────
alter table profiles add column if not exists name text;
alter table profiles add column if not exists age int;
alter table profiles add column if not exists height_cm numeric;
alter table profiles add column if not exists weight_kg numeric;
alter table profiles add column if not exists primary_goal text;
alter table profiles add column if not exists experience_level text
  check (experience_level in ('new','under_1yr','1_3yr','3yr_plus'));
alter table profiles add column if not exists days_per_week int;
alter table profiles add column if not exists session_duration_minutes int;
alter table profiles add column if not exists equipment_access text
  check (equipment_access in ('full_gym','home_gym','limited_dumbbells','bodyweight'));
alter table profiles add column if not exists injury_flags jsonb not null default '[]';
alter table profiles add column if not exists mobility_flags jsonb not null default '[]';
alter table profiles add column if not exists medical_clearance_status text;
alter table profiles add column if not exists pregnancy_postpartum_status text;
alter table profiles add column if not exists cycle_tracking_opt_in boolean not null default false;
alter table profiles add column if not exists cycle_length_days int;
alter table profiles add column if not exists typical_sleep_hours numeric;
alter table profiles add column if not exists stress_level text
  check (stress_level in ('low','moderate','high'));
alter table profiles add column if not exists activity_outside_gym text
  check (activity_outside_gym in ('sedentary','active_job','other_sport'));
alter table profiles add column if not exists creatine_status text
  check (creatine_status in ('yes','no','considering'));
alter table profiles add column if not exists disliked_exercises jsonb not null default '[]';
alter table profiles add column if not exists onboarding_completed_at timestamptz;
alter table profiles add column if not exists created_at timestamptz not null default now();

-- ── user_active_lifts: the lifts a user currently trains ─────────────────────
create table if not exists user_active_lifts (
  user_id uuid not null references profiles (user_id) on delete cascade,
  exercise_id text not null references exercises (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);
create index if not exists user_active_lifts_user_idx on user_active_lifts (user_id);

alter table user_active_lifts enable row level security;
-- Users can only read/write their own active lifts.
create policy user_active_lifts_owner on user_active_lifts
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── logged_sets: source tag (self-reported onboarding baseline vs live log) ──
alter table logged_sets add column if not exists source text not null default 'app'
  check (source in ('app', 'onboarding'));
