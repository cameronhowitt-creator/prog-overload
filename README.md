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

1. Apply the schema: paste `supabase/migrations/0001_init.sql` into the Supabase SQL
   editor and run it (creates the user-scoped tables + RLS).
2. Seed the exercise catalog: `npm run seed:supabase`.
3. Set `DATA_BACKEND=supabase` in `.env.local` (and the `NEXT_PUBLIC_SUPABASE_URL` /
   `SUPABASE_SERVICE_ROLE_KEY` values).

Auth is single-user in dev (`DEV_USER_ID`); wiring Supabase Auth flips on real
per-user scoping without a schema change (§5, §8).

## Project map

```
app/(tabs)/today      Generate session · live logging · swap · in-flow exclude
app/(tabs)/history    Per-lift weight charts + PR badges
app/(tabs)/profile    Session settings · exclusions · dated overrides · theme
app/manifest.ts       PWA manifest (add-to-home-screen)
lib/domain            Types, §7 heuristics, PR logic, formatters
lib/db                Repository interface + local + supabase stores
lib/ai                Context assembly, mock + Claude generators, swap builder
lib/seed              Starter exercise library + seed exclusion
supabase/migrations   Postgres schema + RLS
```

## Scope

V1 covers PRD §6.1–§6.5 and §9. Deferred (§4, §10): YouTube link-out, in-app rest
timers, calendar/travel detection, media embedding.
