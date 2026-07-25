-- Progressive Overload app — initial schema (PRD §8).
-- User-scoped from day one with row-level security so multi-user needs no rewrite.
-- Mirrors lib/domain/types.ts and the Repository interface. The running app uses
-- the local JSON store by default; this is the production/multi-user target.

create extension if not exists "pgcrypto";

-- Profiles ------------------------------------------------------------------
create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  session_length_min int not null default 60,
  goals text[] not null default '{}',
  default_equipment_context text not null default 'Full gym',
  updated_at timestamptz not null default now()
);

-- Standing exclusions — persist indefinitely (PRD §6.1) ---------------------
create table if not exists exclusions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text,                 -- may be null for a free-text name
  exercise_name text not null,
  reason text not null,             -- always recorded with the exclusion
  created_at timestamptz not null default now()
);
create index if not exists exclusions_user_idx on exclusions (user_id);

-- Temporary dated location/equipment overrides — auto-expire (PRD §6.1) -----
create table if not exists location_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  context text not null,
  starts_on date not null,
  expires_on date not null,         -- active only through this date
  created_at timestamptz not null default now()
);
create index if not exists overrides_user_active_idx
  on location_overrides (user_id, starts_on, expires_on);

-- Exercise library (PRD §6.5). Library is code-owned/global (no user_id); seeded
-- from lib/seed/exercises.ts. Kept as a table so swap queries can filter by tags.
create table if not exists exercises (
  id text primary key,
  name text not null,
  muscle_groups text[] not null default '{}',
  category text not null check (category in
    ('primary','secondary','accessory','core','mobility')),
  equipment text not null,
  default_cues text[] not null default '{}',
  is_core_lift boolean not null default false,
  corrective_goal text
);

-- Sessions ------------------------------------------------------------------
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  program jsonb not null,           -- snapshot incl. rationale, cues, last-time/PR
  status text not null default 'generated' check (status in
    ('generated','in_progress','completed')),
  created_at timestamptz not null default now(),
  unique (user_id, date)            -- one session per user per day
);

-- Logged sets — authoritative history going forward (PRD §6.3, §7) ----------
create table if not exists logged_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid references sessions (id) on delete set null,
  exercise_id text not null,
  exercise_name text not null,
  set_index int not null,
  weight numeric not null,
  reps int not null,
  logged_at timestamptz not null default now()
);
create index if not exists logged_sets_user_ex_idx
  on logged_sets (user_id, exercise_id, logged_at desc);

-- PRs — per lift per rep-range bucket (PRD §6.4). Beaten PRs are retained with
-- superseded = true rather than being overwritten in place.
create table if not exists prs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  exercise_name text not null,
  rep_bucket text not null check (rep_bucket in ('1-5','6-10','11-15')),
  weight numeric not null,
  reps int not null,
  date_achieved date not null,
  superseded boolean not null default false
);
create index if not exists prs_user_current_idx
  on prs (user_id, exercise_id, rep_bucket) where superseded = false;

-- Row-level security: a user can only see and write their own rows. ---------
alter table profiles          enable row level security;
alter table exclusions        enable row level security;
alter table location_overrides enable row level security;
alter table sessions          enable row level security;
alter table logged_sets       enable row level security;
alter table prs               enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','exclusions','location_overrides','sessions','logged_sets','prs'
  ] loop
    execute format($f$
      create policy %1$s_owner on %1$s
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- Exercise library is world-readable (global catalog), no writes from clients.
alter table exercises enable row level security;
create policy exercises_read on exercises for select using (true);
