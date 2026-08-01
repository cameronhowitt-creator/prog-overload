-- Product feedback submitted from inside the app (Profile → Send feedback).
--
-- Deliberately separate from sessions.session_notes (0004), which is feedback
-- about a WORKOUT. This table is feedback about the APP: bugs, ideas, exercises
-- the user wants added. App context (route, build, user agent, the session that
-- was open) is captured automatically so triage never needs a follow-up question.
--
-- github_issue_number / github_issue_url are filled in AFTER the row is written,
-- and stay null whenever the optional GitHub integration is unconfigured or its
-- API call failed — the report itself must never depend on GitHub being up.

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null default 'other' check (category in
    ('bug','idea','exercise-request','other')),
  -- Bounds mirrored in the server action so the user sees a message, not a 500.
  message text not null check (char_length(btrim(message)) between 4 and 4000),
  rating smallint check (rating is null or (rating between 1 and 5)),
  path text,
  app_version text,
  user_agent text,
  -- The session open when the feedback was sent, if any. `set null` rather than
  -- cascade: losing the session must not delete the report.
  session_id uuid references sessions (id) on delete set null,
  status text not null default 'new' check (status in ('new','triaged','done')),
  github_issue_number int,
  github_issue_url text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_user_idx on feedback (user_id, created_at desc);
-- Triage queue scan: "everything still new, newest first".
create index if not exists feedback_status_idx on feedback (status, created_at desc);

alter table feedback enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feedback'
      and policyname = 'feedback_owner'
  ) then
    create policy feedback_owner on feedback
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;
