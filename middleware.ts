import { NextResponse, type NextRequest } from "next/server";

// Auth/onboarding gating runs only in Supabase mode. In mock-auth (local store)
// dev mode the app is open and onboarding is handled by the Today page redirect.
export async function middleware(request: NextRequest) {
  if (process.env.DATA_BACKEND !== "supabase") {
    return NextResponse.next();
  }
  const { updateSession } = await import("@/lib/supabase/middleware");
  return updateSession(request);
}

export const config = {
  // Run on everything except Next internals, static assets, and API routes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|api/).*)",
  ],
};
