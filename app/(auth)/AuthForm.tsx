"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Shared email/password form for sign-in and sign-up (PRD §1).
export default function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isSignUp = mode === "sign-up";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = isSignUp
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      if (isSignUp) {
        // Depending on email-confirmation settings the session may not exist yet.
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setNotice("Check your email to confirm your account, then sign in.");
          return;
        }
      }
      // New users land on onboarding via middleware; returning users on Today.
      router.replace("/today");
      router.refresh();
    });
  }

  return (
    <div className="app-shell">
      <div className="scroll-area">
        <div className="ob-step" style={{ paddingTop: 48 }}>
          <h1 className="ob-title">{isSignUp ? "Create your account" : "Welcome back"}</h1>
          <p className="ob-lead">
            {isSignUp
              ? "Sign up to build your training profile and start progressing."
              : "Sign in to pick up your training."}
          </p>
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="field" style={{ color: "var(--danger)", fontSize: 14 }}>{error}</p>}
            {notice && <p className="field" style={{ color: "var(--success)", fontSize: 14 }}>{notice}</p>}
            <div className="field">
              <button className="btn-primary" type="submit" disabled={pending}>
                {pending ? "…" : isSignUp ? "Sign up" : "Sign in"}
              </button>
            </div>
          </form>
          <p className="ob-lead" style={{ marginTop: 8 }}>
            {isSignUp ? (
              <>Already have an account? <Link href="/sign-in">Sign in</Link></>
            ) : (
              <>New here? <Link href="/sign-up">Create an account</Link></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
