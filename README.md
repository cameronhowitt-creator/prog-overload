# Progressive Overload — Workout App

A mobile-web app that plans progressive-overload strength sessions, remembers Emma's
constraints and history reliably, and is used live in the gym to log sets and guide
the session. Built to the spec in `Progressive_Overload_App_PRD_v1.md`, styled to the
locked Apple-derived system in `DESIGN-apple.md`.

The core idea: **durable, structured memory** (profile, constraints, logged
performance) that is actually fed into program generation — fixing the "forgotten
constraints / sticky temporary context / unused history" failures of the old
CustomGPT setup (PRD §2).

## Stack

- **Next.js (App Router, React 19)** — mobile-first PWA, deployable to Vercel.
- **Data layer** behind one `Repository` interface (`lib/db/repo.ts`):
  - **Local JSON store** (`lib/db/localStore.ts`) — default, zero-setup, writes to
    `.data/store.json`. Runs and is fully verifiable with no external services.
  - **Supabase/Postgres** (`lib/db/supabaseStore.ts`) — production/multi-user,
    user-scoped with RLS. Enable with `DATA_BACKEND=supabase`.
- **Program generation** behind one interface (`lib/ai/`):
  - **Mock generator** (`mockGenerator.ts`) — deterministic, applies the real §7
    heuristics. The no-API-key fallback.
  - **Claude generator** (`anthropicGenerator.ts`) — live, structured tool-use
    output. Used automatically when `ANTHROPIC_API_KEY` is set; falls back to the
    mock on error.
  - A shared enrichment step (`assemble.ts`) attaches **authoritative** last-time/PR
    numbers from the store so on-screen references are never model-invented (§6.2).

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in as needed (works out of the box on defaults)
npm run dev                     # http://localhost:3000  → redirects to /today
```

Out of the box it runs on the **local JSON store** with the **mock generator** — no
Supabase project or Anthropic key required. First load seeds the profile, the
chest-supported-row exclusion (§6.1), and the exercise library.

### Enable live Claude generation

Set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`, default `claude-sonnet-5`)
in `.env.local`. Generation switches to the live call automatically; the mock stays
as the fallback.

### Enable Supabase (production / multi-user)

1. Apply the schema: paste each file in `supabase/migrations/` into the Supabase SQL
   editor in order, `0001` through `0004` (creates the user-scoped tables + RLS).
2. Seed the exercise catalog: `npm run seed:supabase`.
3. Set `DATA_BACKEND=supabase` in `.env.local` (and the `NEXT_PUBLIC_SUPABASE_URL` /
   `SUPABASE_SERVICE_ROLE_KEY` values).

Auth is single-user in dev (`DEV_USER_ID`); wiring Supabase Auth flips on real
per-user scoping without a schema change (§5, §8).

## Project map

```
app/(auth)            Email/password sign-in + sign-up (Supabase)
app/onboarding        12-step first-run flow (incremental save)
app/(tabs)/log        Today's logged sets + earlier sessions · edit/delete a set
app/(tabs)/today      Generate session · live logging · swap · skip · finish workout
app/(tabs)/plan       4-week training block · per-day detail · generate a day
app/(tabs)/profile    Quick edits · training days · lifts · exclusions · progress charts
app/manifest.ts       PWA manifest (add-to-home-screen)
middleware.ts         Auth + onboarding gating (Supabase mode only)
lib/auth              getUser / getSession / signOut (mock in dev)
lib/supabase          SSR browser/server/middleware clients
lib/domain            Types, §7 heuristics, PR logic, formatters, date/weekday helpers
lib/db                Repository interface + local + supabase stores, PR replay
lib/ai                Context assembly, mock + Claude generators, swap builder,
                      4-week plan generation + adaptation (plan.ts, *PlanGenerator.ts)
lib/onboarding        New-vs-returning detection
lib/seed              Starter exercise library + seed exclusion
supabase/migrations   Postgres schema + RLS (0001 init, 0002 profiles/onboarding,
                      0003 units, 0004 plans/feedback/training days)
```

## Auth & onboarding

**Auth (Supabase, PRD §6.6).** Email/password via `@supabase/ssr`. `middleware.ts`
protects the app: unauthenticated users → `/sign-in`, and authenticated users whose
`profiles.onboarding_completed_at` is null → `/onboarding`. In **mock-auth mode**
(the default local-store dev path) the middleware is a no-op and a fixed dev user is
used, so the app runs with zero Supabase setup — the mock branch is gated on
`isSupabaseBackend()` and never touches the Supabase store. `lib/auth` exposes
`getUser` / `getSession` / `signOut`; `lib/supabase/{client,server,middleware}.ts`
hold the SSR clients.

**Onboarding.** A fresh user is routed through a 12-step flow (`app/onboarding`):
welcome → **units (imperial/metric, no default)** → basic info → goals/experience →
training logistics → lift selection → baselines → health & safety (with privacy
copy) → cycle-tracking opt-in (off by default; cycle length only requested/stored
if opted in) → recovery & lifestyle → extras → confirmation. **Every data step saves incrementally** to `profiles` (so a
closed tab doesn't lose progress). Selected lifts become `profile.userActiveLifts`
(the generator + swap picker only surface these strength lifts; core/mobility is
programmed for them). Baselines are stored as backdated `source: "onboarding"`
logged sets, driving the same progression as live logs (squat 3×8 @ 130 lb → 135 lb
prescription). The full profile (equipment, injuries, recovery, cycle) feeds the AI
context (`lib/ai/context.ts` + the Claude prompt). Re-runnable from Profile.

## Units (imperial / metric)

Chosen explicitly as the first onboarding step — **no default** (`profile.units_preference`,
migration `0003_units_preference.sql`). **Storage is always canonical metric**: kg for
weight (profile, logged sets, PRs, program targets) and cm for height. `lib/domain/units.ts`
converts at the input/display edges only, so changing the preference later (from Profile)
re-labels everything **without re-scaling stored values** — a set logged at 130 lb (stored
58.97 kg) shows 130 lb for imperial or ~59 kg for metric. Load-increment logic is
unit-aware (`nextTargetKg`): a clean +5 lb step for imperial, +2.5 kg for metric — the
mock generator and the Claude prompt both work in the user's unit and store canonical kg.

### Going live on Supabase (handoff)

The local store is the default and fully exercised; the Supabase path is coded but
needs your project to apply + verify:
1. Apply `0001_init.sql`, `0002_profiles_and_onboarding.sql`, `0003_units_preference.sql`,
   then `0004_plans_feedback_days.sql` in the Supabase SQL editor.
   **All four are already applied to the live project — do not re-run them.** They are
   written to be idempotent (`if not exists`) but re-running is still unnecessary.
2. `npm run seed:supabase` to seed the exercise catalog.
3. Set `DATA_BACKEND=supabase` in `.env.local`. Until this flips, the `training_plans`
   table and the new `sessions` feedback columns exist but go unused.
4. Verify RLS with Supabase's `get_advisors` (security) — the policies scope every
   table to `auth.uid()`. Note: `SupabaseStore` currently uses the service-role key
   (server-trusted, manually scoped by user id); switching it to a session-scoped
   client so RLS is enforced end-to-end is the remaining prod-hardening step.

## Scope

V1 covers PRD §6.1–§6.5 and §9. Deferred (§4, §10): YouTube link-out, in-app rest
timers, calendar/travel detection, media embedding.

<!-- deploy trigger -->
