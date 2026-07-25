"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client for the sign-in / sign-up forms. Uses the public
// anon key (RLS-scoped). Safe to run in the browser.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
