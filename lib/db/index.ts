// Repository selection + user scoping.
//
// Default backend is the local JSON-file store (zero-setup dev + verification).
// A Supabase/Postgres adapter is the production target (schema in
// supabase/migrations); wiring it is deployment work — the interface is identical
// so it's a drop-in swap with no changes to callers.

import type { Repository } from "./repo";
import { LocalStore } from "./localStore";
import { SupabaseStore } from "./supabaseStore";

let repo: Repository | null = null;

export function getRepo(): Repository {
  if (!repo) {
    repo =
      process.env.DATA_BACKEND === "supabase"
        ? new SupabaseStore()
        : new LocalStore();
  }
  return repo;
}

// Resolve the current user id. In dev/single-user mode this is a fixed UUID; when
// Supabase Auth is wired, this reads the authenticated session (PRD §5, §8).
export function getUserId(): string {
  return process.env.DEV_USER_ID ?? "00000000-0000-0000-0000-000000000001";
}

// Today's date as yyyy-mm-dd in local time — the key for one-session-per-day and
// for evaluating dated overrides.
export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}
