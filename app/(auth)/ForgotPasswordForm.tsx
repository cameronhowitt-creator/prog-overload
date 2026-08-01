"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSiteOrigin } from "@/lib/auth/site-url";

// Request a password reset email. The link it sends is consumed by
// app/auth/confirm/route.ts, which verifies it and forwards to /update-password.
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  // createSupabaseBrowserClient() throws when the URL is unset, which is the case
  // in local-store dev mode. NEXT_PUBLIC_SUPABASE_URL is the only backend signal a
  // client component can see (DATA_BACKEND is server-only).
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <div className="app-shell">
        <div className="scroll-area">
          <div className="ob-step" style={{ paddingTop: 48 }}>
            <h1 className="ob-title">Not available in local mode</h1>
            <p className="ob-lead">
              Password reset requires the Supabase backend. Set{" "}
              <code>DATA_BACKEND=supabase</code> and the Supabase keys in{" "}
              <code>.env.local</code> to use it.
            </p>
            <p className="ob-lead" style={{ marginTop: 8 }}>
              <Link className="text-link" href="/sign-in">
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getSiteOrigin()}/auth/confirm`,
      });
      // Deliberately NOT surfacing error.message: distinguishing "no such account"
      // from success would let anyone enumerate registered addresses. The notice
      // below is identical either way. A 429 is the one safe exception — a throttle
      // says nothing about whether the address exists.
      if (error?.status === 429) {
        setError("Too many requests — try again in a few minutes.");
        return;
      }
      setSent(true);
    });
  }

  return (
    <div className="app-shell">
      <div className="scroll-area">
        <div className="ob-step" style={{ paddingTop: 48 }}>
          <h1 className="ob-title">Reset your password</h1>
          <p className="ob-lead">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                disabled={sent}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && (
              <p className="field" style={{ color: "var(--danger)", fontSize: 14 }}>
                {error}
              </p>
            )}
            {sent && (
              <p className="field" style={{ color: "var(--success)", fontSize: 14 }}>
                If an account exists for that email, we&apos;ve sent a reset link.
                Check your inbox.
              </p>
            )}
            <div className="field">
              <button className="btn-primary" type="submit" disabled={pending || sent}>
                {pending ? "…" : sent ? "Link sent" : "Send reset link"}
              </button>
            </div>
          </form>
          <p className="ob-lead" style={{ marginTop: 8 }}>
            <Link className="text-link" href="/sign-in">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
