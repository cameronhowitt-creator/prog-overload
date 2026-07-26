// Server-safe auth helpers. In Supabase mode these read the real session; in
// mock-auth (local store) mode they return a fixed dev user so the app is fully
// usable without hitting Supabase Auth.
//
// IMPORTANT: the mock branch must NEVER run against the Supabase-backed store — it
// is gated on isSupabaseBackend() so it only applies to the local dev store.

import { DEV_USER_ID, isSupabaseBackend } from "@/lib/db";

export interface AuthUser {
  id: string;
  email?: string;
}

const MOCK_USER: AuthUser = { id: DEV_USER_ID, email: "dev@local.test" };

export async function getUser(): Promise<AuthUser | null> {
  if (!isSupabaseBackend()) return MOCK_USER; // dev mock — local store only
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email } : null;
}

// The authoritative user id for the current request. In mock-auth (local store)
// mode this is the fixed dev id; in Supabase mode it is STRICTLY the authenticated
// session user — it never falls back to DEV_USER_ID or any env value. Throws when
// no session is present so callers fail loudly instead of writing to a phantom id.
export async function requireUserId(): Promise<string> {
  const user = await getUser();
  if (!user?.id) {
    throw new Error(
      "No authenticated user — a valid Supabase session is required for this action.",
    );
  }
  return user.id;
}

export async function getSession() {
  if (!isSupabaseBackend()) return { user: MOCK_USER };
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signOut(): Promise<void> {
  if (!isSupabaseBackend()) return; // nothing to sign out of in dev
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
