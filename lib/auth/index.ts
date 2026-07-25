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
