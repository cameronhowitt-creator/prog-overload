-- Multi-week training plans, session feedback, and preferred training days.
--
-- Three related additions:
--   1. profiles.preferred_workout_days — the specific weekdays the user trains,
--      which the 4-week plan is laid out on. days_per_week is now derived from it.
--   2. training_plans — a 4-week block stored as an OUTLINE (focus / emphasis /
--      intensity per day). Full prescriptions still live in sessions.program and
--      are generated on demand, so week-3 loads aren't guessed before week 1 is
--      logged.
--   3. sessions.effort_rating / session_notes / completed_at — how the workout
--      actually felt, captured when the user ends it. High strain drives an
--      adaptation of the remaining planned days.

-- 1. Preferred training days ------------------------------------------------
-- smallint[] of 0–6 matching JS Date.getDay() (0 = Sunday). Empty = not yet set.
alter table profiles
  add column if not exists preferred_workout_days smallint[] not null default '{}';

-- 2. Training plans ----------------------------------------------------------
create table if not exists training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  weeks int not null default 4,
  status text not null default 'active' check (status in
    ('active','completed','archived')),
  outline jsonb not null,           -- { summary, weeks: [{ weekIndex, intent, days }] }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_plans_user_idx
  on training_plans (user_id, status, starts_on desc);

-- At most one active block per user; building a new one archives the old.
create unique index if not exists training_plans_one_active_idx
  on training_plans (user_id) where status = 'active';

alter table training_plans enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'training_plans'
      and policyname = 'training_plans_owner'
  ) then
    create policy training_plans_owner on training_plans
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- 3. Session feedback + plan linkage ----------------------------------------
alter table sessions
  add column if not exists effort_rating smallint
    check (effort_rating is null or (effort_rating between 1 and 10));
alter table sessions
  add column if not exists session_notes text;
alter table sessions
  add column if not exists completed_at timestamptz;
alter table sessions
  add column if not exists plan_id uuid references training_plans (id) on delete set null;
-- The PlannedDay.id this session was materialized from (an id inside outline jsonb,
-- not a table key — hence text rather than a FK).
alter table sessions
  add column if not exists plan_day_id text;

-- No index needed for the calendar's date-range scan: 0001's
-- `unique (user_id, date)` already provides exactly that index.
