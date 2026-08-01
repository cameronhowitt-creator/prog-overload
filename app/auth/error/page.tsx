import Link from "next/link";

// Landing page when /auth/confirm can't verify a link. A dedicated page rather than
// an ?error= param on /sign-in: the handler is shared between recovery and sign-up
// confirmation, so the recovery CTA has to differ from the confirmation one.

export const dynamic = "force-dynamic";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; type?: string }>;
}) {
  const { reason, type } = await searchParams;
  const isRecovery = type === "recovery";
  const invalid = reason === "invalid";

  return (
    <div className="app-shell">
      <div className="scroll-area">
        <div className="ob-step" style={{ paddingTop: 48 }}>
          <h1 className="ob-title">
            {invalid ? "That link isn't valid" : "This link has expired"}
          </h1>
          <p className="ob-lead">
            {invalid
              ? "The link is missing information we need to verify it. Request a new one below."
              : "Password reset and confirmation links can only be used once, and they expire after a short time. Request a new one below."}
          </p>
          <div className="field">
            <Link
              className="btn-primary"
              href={isRecovery ? "/forgot-password" : "/sign-up"}
              style={{ display: "block", textAlign: "center" }}
            >
              {isRecovery ? "Send a new reset link" : "Back to sign up"}
            </Link>
          </div>
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
