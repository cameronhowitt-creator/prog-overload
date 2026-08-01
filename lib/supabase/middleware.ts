import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Reachable without a session. /auth/confirm is the critical one: the matcher in
// middleware.ts only excludes api/, so an emailed auth link WOULD be bounced to
// /sign-in — and it is unauthenticated by definition, since consuming it is what
// creates the session in the first place.
const PUBLIC_PATHS = new Set([
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/auth/confirm",
  "/auth/error",
]);

// A signed-in user has no business here. /forgot-password is deliberately absent:
// it's harmless for a signed-in user, and bouncing it would strand anyone who
// started a reset in another tab.
const SIGNED_IN_REDIRECT = new Set(["/sign-in", "/sign-up"]);

// Authenticated, but exempt from the onboarding gate. /update-password matters most:
// someone resetting a password may never have onboarded, and a bounce to /onboarding
// would abandon the recovery session before the password is actually changed.
const ONBOARDING_EXEMPT = new Set([
  "/onboarding",
  "/update-password",
  "/auth/confirm",
  "/auth/error",
]);

// Session refresh + route gating for Supabase mode (PRD §1). Redirects:
//  - unauthenticated users → /sign-in (except on PUBLIC_PATHS)
//  - authenticated users on sign-in/sign-up → /today
//  - authenticated users with an incomplete profile → /onboarding
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && !PUBLIC_PATHS.has(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }
  if (user && SIGNED_IN_REDIRECT.has(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/today";
    return NextResponse.redirect(url);
  }
  if (user && !SIGNED_IN_REDIRECT.has(path) && !ONBOARDING_EXEMPT.has(path)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile || !profile.onboarding_completed_at) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
