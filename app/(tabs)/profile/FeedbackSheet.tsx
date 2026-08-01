"use client";

// Product feedback entry point. Opens the same scrim + bottom-sheet pattern used
// by the finish and swap sheets on Today, so it needs no new CSS.

import { useState, useTransition } from "react";
import { submitFeedbackAction } from "./actions";

const CATEGORIES = [
  { key: "bug", label: "Bug" },
  { key: "idea", label: "Idea" },
  { key: "exercise-request", label: "Exercise request" },
  { key: "other", label: "Other" },
] as const;

const MAX_LENGTH = 4000;

export default function FeedbackSheet() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("idea");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0); // 0 = not answered
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      // Read browser context here rather than at render: it must not affect the
      // server-rendered markup.
      const res = await submitFeedbackAction({
        category,
        message,
        rating: rating || undefined,
        path: window.location.pathname,
        userAgent: navigator.userAgent,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setMessage("");
      setRating(0);
      setCategory("idea");
      setToast("Thanks — feedback sent.");
      setTimeout(() => setToast(null), 2400);
    });
  }

  return (
    <>
      <button
        type="button"
        className="list-row"
        style={{ width: "calc(100% - 40px)", textAlign: "left" }}
        onClick={() => setOpen(true)}
      >
        <div>
          <div className="lift-name">Send feedback</div>
          <div className="lift-tag">
            Bugs, ideas, exercises you want added
          </div>
        </div>
        <span className="badge-muted">Write</span>
      </button>

      {open && (
        <div
          className="scrim"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="sheet">
            <div className="sheet-handle" />
            <h2>Send feedback</h2>
            <div className="sub">
              Goes straight to the person building this.
            </div>

            <div className="field">
              <label>What kind of feedback?</label>
              <div className="chip-grid">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={`chip${category === c.key ? " selected" : ""}`}
                    style={{ width: "calc(50% - 5px)", justifyContent: "center" }}
                    onClick={() => setCategory(c.key)}
                  >
                    <div className="txt">
                      <div className="n">{c.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor="feedback-message">Tell me about it</label>
              <textarea
                id="feedback-message"
                rows={5}
                maxLength={MAX_LENGTH}
                autoFocus
                placeholder="What happened, or what would make this better?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              {message.length > MAX_LENGTH - 400 && (
                <div className="lift-tag">
                  {MAX_LENGTH - message.length} characters left
                </div>
              )}
            </div>

            <div className="field">
              <label>How's the app so far? (optional)</label>
              <div className="chip-grid">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`chip${rating === n ? " selected" : ""}`}
                    style={{ width: "calc(20% - 8px)", justifyContent: "center" }}
                    onClick={() => setRating(rating === n ? 0 : n)}
                  >
                    <div className="txt">
                      <div className="n">{n}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="empty" style={{ margin: "0 0 12px", textAlign: "left" }}>
                {error}
              </p>
            )}

            <button
              className="btn-primary"
              type="button"
              onClick={submit}
              disabled={pending || message.trim().length < 4}
            >
              {pending ? "Sending…" : "Send feedback"}
            </button>
            <button
              className="btn-ghost"
              type="button"
              style={{ width: "100%", marginTop: 10 }}
              onClick={close}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
