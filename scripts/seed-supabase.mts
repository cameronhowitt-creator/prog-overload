// Seeds the global `exercises` catalog into Supabase (PRD §6.5, §7).
// Run AFTER applying supabase/migrations/0001_init.sql in the Supabase SQL editor.
//
//   npx tsx scripts/seed-supabase.mts
//
// Idempotent: upserts by id. Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// from .env.local.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SEED_EXERCISES } from "../lib/seed/exercises.ts";

// Minimal .env.local loader (this runs outside Next, which normally injects these).
function loadEnv() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* no .env.local — rely on the ambient environment */
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const rows = SEED_EXERCISES.map((e) => ({
  id: e.id,
  name: e.name,
  muscle_groups: e.muscleGroups,
  category: e.category,
  equipment: e.equipment,
  default_cues: e.defaultCues,
  is_core_lift: !!e.isCoreLift,
  corrective_goal: e.correctiveGoal ?? null,
}));

const { error, count } = await db
  .from("exercises")
  .upsert(rows, { onConflict: "id", count: "exact" });

if (error) {
  console.error("Seed failed:", error.message);
  console.error("Did you apply supabase/migrations/0001_init.sql first?");
  process.exit(1);
}
console.log(`Seeded ${count ?? rows.length} exercises into Supabase.`);
