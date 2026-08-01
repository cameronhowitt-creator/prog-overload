"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Set a new password. Reached only after app/auth/confirm/route.ts verified a
// recovery link, which establishes a session — that session is what authorises the
// change without knowing the old password.
export default function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // null = still checking. The middleware already blocks the unauthenticated case;
  // this catches a session that lapses while the page sits open, or someone
  // arriving from a bookmark.
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  const supabaseConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setHasSession(!!data.session);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return; // no network call — nothing to verify server-side
    }
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }
      // Middleware forwards to /onboarding if this user never completed it.
      router.replace("/today");
      router.refresh();
    });
  }

  // See ForgotPasswordForm — NEXT_PUBLIC_SUPABASE_URL is the only backend signal
  // available to a client component.
  if (!supabaseConfigured) {
    return (
      <Shell title="Not available in local mode">
        <p className="ob-lead">
          Password reset requires the Supabase backend. Set{" "}
          <code>DATA_BACKEND=supabase</code> and the Supabase keys in{" "}
          <code>.env.local</code> to use it.
        </p>
        <BackToSignIn />
      </Shell>
    );
  }

  if (hasSession === false) {
    return (
      <Shell title="Your reset link has expired">
        <p className="ob-lead">
          Reset links can only be used once and expire after a short time. Request a
          new one to continue.
        </p>
        <div className="field">
          <Link
            className="btn-primary"
            href="/forgot-password"
            style={{ display: "block", textAlign: "center" }}
          >
            Send a new reset link
          </Link>
        </div>
        <BackToSignIn />
      </Shell>
    );
  }

  return (
    <Shell title="Set a new password">
      <p className="ob-lead">
        Choose a new password for your account. You&apos;ll stay signed in afterwards.
      </p>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="password">New password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirm new password</label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && (
          <p className="field" style={{ color: "var(--danger)", fontSize: 14 }}>
            {error}
          </p>
        )}
        <div className="field">
          <button
            className="btn-primary"
            type="submit"
            disabled={pending || hasSession === null}
          >
            {pending ? "…" : "Save new password"}
          </button>
        </div>
      </form>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <div className="scroll-area">
        <div className="ob-step" style={{ paddingTop: 48 }}>
          <h1 className="ob-title">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

function BackToSignIn() {
  return (
    <p className="ob-lead" style={{ marginTop: 8 }}>
      <Link className="text-link" href="/sign-in">
        Back to sign in
      </Link>
    </p>
  );
}
