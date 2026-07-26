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

// True when the app is backed by real Supabase (auth + Postgres). When false we
// run the local JSON store with a mock dev user — auth is stubbed.
export function isSupabaseBackend(): boolean {
  return process.env.DATA_BACKEND === "supabase";
}

export function getRepo(): Repository {
  if (!repo) {
    repo = isSupabaseBackend() ? new SupabaseStore() : new LocalStore();
  }
  return repo;
}

// The fixed dev/single-user id used when auth is mocked (local store).
export const DEV_USER_ID =
  process.env.DEV_USER_ID ?? "00000000-0000-0000-0000-000000000001";

// Resolve the current user id for LOCAL/mock-auth mode only (the fixed dev UUID).
// In Supabase mode this MUST NOT be used — DEV_USER_ID is a dev-only construct and
// writing to it in production produces phantom rows / FK violations. Authenticated
// entrypoints resolve the real session id via `requireUserId()` from lib/auth; this
// throws in Supabase mode so a stray caller fails loudly instead of silently using
// the dev id.
export function getUserId(): string {
  if (isSupabaseBackend()) {
    throw new Error(
      "getUserId() is local-mode only. In Supabase mode use requireUserId() from lib/auth to resolve the authenticated session user.",
    );
  }
  return DEV_USER_ID;
}

// Today's date as yyyy-mm-dd in local time — the key for one-session-per-day and
// for evaluating dated overrides.
export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}
