// The origin Supabase should send auth emails back to.
//
// Lives in its own module rather than lib/auth/index.ts because that one imports
// @/lib/db (server-only) and this is needed from client components.
//
// NEXT_PUBLIC_SITE_URL wins so preview deployments — whose hostname is not on the
// Supabase redirect allowlist — still emit links pointing at the canonical app.
// window.location.origin is the dev fallback, so localhost works with no extra env.
export function getSiteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "")
  );
}
