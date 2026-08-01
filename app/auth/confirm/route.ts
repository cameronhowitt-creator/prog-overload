// Shared consumer for every emailed auth link — password recovery AND sign-up
// confirmation. Before this existed nothing consumed those links at all: the
// sign-up form told users to check their email, but the link had nowhere to land
// and the middleware bounced it to /sign-in.
//
// Uses token_hash + verifyOtp rather than exchangeCodeForSession because
// createBrowserClient defaults to PKCE, where the code verifier lives in the
// ORIGINATING browser's storage. Recovery emails are usually opened on a different
// device (requested on a laptop, tapped on a phone), which a PKCE exchange can
// never complete. The hashed token in the URL is self-contained, so verifying it
// server-side lands the session on whatever device opened the link.
//
// Note this route sits outside the (auth) route group — a group contributes no
// path segment, so the URL is /auth/confirm with no collision against app/(auth)/*.

import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Anything outside this set is a malformed or hostile link.
const ALLOWED_TYPES: EmailOtpType[] = [
  "recovery",
  "email",
  "signup",
  "email_change",
  "magiclink",
  "invite",
];

// Where each link type lands on success. Recovery must reach /update-password;
// confirmations go to /today and let the middleware forward to /onboarding.
const DEFAULT_NEXT: Partial<Record<EmailOtpType, string>> = {
  recovery: "/update-password",
};

// Only same-origin paths, so ?next= can't be turned into an open redirect.
//
// A leading-slash pattern test is NOT sufficient: the WHATWG URL parser treats
// backslashes as slashes for http(s), so "/\evil.com" passes any /^\/(?!\/)/ style
// check and still resolves to http://evil.com/. The only reliable guard is to
// resolve the candidate and compare origins.
function safeNext(next: string | null, base: URL): string | null {
  if (!next || !next.startsWith("/")) return null;
  let candidate: URL;
  try {
    candidate = new URL(next, base);
  } catch {
    return null;
  }
  if (candidate.origin !== base.origin) return null;
  return candidate.pathname + candidate.search;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.redirect(new URL("/auth/error?reason=invalid", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    // Expired, already consumed, or tampered with — all indistinguishable to the
    // user and all recoverable the same way: request a fresh link.
    return NextResponse.redirect(
      new URL(`/auth/error?reason=expired&type=${type}`, request.url),
    );
  }

  const base = new URL(request.url);
  const destination =
    safeNext(params.get("next"), base) ?? DEFAULT_NEXT[type] ?? "/today";
  return NextResponse.redirect(new URL(destination, base));
}
