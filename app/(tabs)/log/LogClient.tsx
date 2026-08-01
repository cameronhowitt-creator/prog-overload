"use client";

import { useState, useTransition } from "react";
import type { SessionStatus } from "@/lib/domain/types";
import { fmtWeekdayDate } from "@/lib/domain/dates";
import {
  displayWeightNumber,
  formatWeight,
  toCanonicalWeightKg,
  weightUnit,
  type UnitsPreference,
} from "@/lib/domain/units";
import { deleteLoggedSetAction, editLoggedSetAction } from "./actions";

export type LogSet = { id: string; weight: number; reps: number };

export type LogSession = {
  id: string;
  date: string;
  status: SessionStatus;
  effort: number | null;
  notes: string | null;
  skipped: string[];
  groups: { exerciseId: string; exerciseName: string; sets: LogSet[] }[];
};

const STATUS_LABEL: Record<SessionStatus, string> = {
  generated: "not started",
  in_progress: "in progress",
  completed: "completed",
};

export default function LogClient({
  sessions,
  today,
  units,
}: {
  // Weights are canonical kg; converted to `units` at the input/display edge.
  sessions: LogSession[];
  today: string;
  units: UnitsPreference;
}) {
  const wLabel = weightUnit(units);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ weight: string; reps: string }>({
    weight: "",
    reps: "",
  });
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = sessions.find((s) => s.date === today) ?? null;
  const earlier = sessions.filter((s) => s.date !== today);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  function beginEdit(set: LogSet) {
    setEditing(set.id);
    setDraft({
      weight: set.weight ? String(displayWeightNumber(set.weight, units)) : "",
      reps: String(set.reps),
    });
  }

  function saveEdit(exerciseId: string, setId: string) {
    const reps = Number(draft.reps) || 0;
    const weightKg = toCanonicalWeightKg(Number(draft.weight) || 0, units);
    startTransition(async () => {
      const res = await editLoggedSetAction({ setId, exerciseId, weight: weightKg, reps });
      if (!res.ok) {
        showToast(res.error ?? "Couldn't save that");
        return;
      }
      setEditing(null);
      showToast("Set updated");
    });
  }

  function removeSet(exerciseId: string, setId: string) {
    startTransition(async () => {
      await deleteLoggedSetAction({ setId, exerciseId });
      setEditing(null);
      showToast("Set deleted");
    });
  }

  function renderSession(s: LogSession) {
    const total = s.groups.reduce((n, g) => n + g.sets.length, 0);
    return (
      <>
        {s.groups.map((g) => (
          <div className="card" key={g.exerciseId}>
            <div className="row-top">
              <p className="lift-name">{g.exerciseName}</p>
              <span className="badge-muted">
                {g.sets.length} {g.sets.length === 1 ? "set" : "sets"}
              </span>
            </div>

            {g.sets.map((set, i) =>
              editing === set.id ? (
                <div className="log-edit-row editing" key={set.id}>
                  <div className="log-fields">
                    <div className="log-field">
                      <input
                        type="number"
                        inputMode="decimal"
                        aria-label="weight"
                        value={draft.weight}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, weight: e.target.value }))
                        }
                        autoFocus
                      />
                      <span>{wLabel}</span>
                    </div>
                    <div className="log-times">×</div>
                    <div className="log-field">
                      <input
                        type="number"
                        inputMode="numeric"
                        aria-label="reps"
                        value={draft.reps}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, reps: e.target.value }))
                        }
                      />
                      <span>reps</span>
                    </div>
                  </div>
                  <div className="inline-actions">
                    <button
                      className="btn-primary"
                      type="button"
                      onClick={() => saveEdit(g.exerciseId, set.id)}
                      disabled={pending}
                    >
                      Save
                    </button>
                    <button
                      className="btn-ghost"
                      type="button"
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="del"
                      type="button"
                      onClick={() => removeSet(g.exerciseId, set.id)}
                      disabled={pending}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="log-edit-row" key={set.id}>
                  {/* Set number is positional, so deleting a middle set renumbers
                      the rest without touching stored indexes. */}
                  <span className="sl-set">Set {i + 1}</span>
                  <span className="sl-val">
                    {set.weight ? formatWeight(set.weight, units) : "BW"} × {set.reps}{" "}
                    reps
                  </span>
                  <button
                    className="text-link"
                    type="button"
                    onClick={() => beginEdit(set)}
                  >
                    Edit
                  </button>
                </div>
              ),
            )}
          </div>
        ))}

        {total === 0 && (
          <p className="empty">Nothing logged yet. Sets appear here as you log them.</p>
        )}

        {s.skipped.length > 0 && (
          <div className="cues" style={{ marginTop: 4 }}>
            <div className="clbl">Skipped</div>
            {s.skipped.map((n) => (
              <span className="cue-pill" key={n}>
                {n}
              </span>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="topbar">
        <div className="eyebrow">Your sets</div>
        <h1>Log</h1>
        <div className="meta">
          <span>
            <b>
              {current ? current.groups.reduce((n, g) => n + g.sets.length, 0) : 0}
            </b>{" "}
            sets today
          </span>
          <span>Tap any set to correct it</span>
        </div>
      </div>

      {current ? (
        <>
          <div className="section-label">
            Today · {STATUS_LABEL[current.status]}
          </div>
          {current.effort != null && (
            <div className="card">
              <div className="row-top">
                <p className="lift-name">Effort {current.effort}/10</p>
              </div>
              {current.notes ? (
                <div className="rationale">{current.notes}</div>
              ) : null}
            </div>
          )}
          {renderSession(current)}
        </>
      ) : (
        <p className="empty">
          No session today. Head to Today to generate one and start logging.
        </p>
      )}

      {earlier.length > 0 && <div className="section-label">Earlier sessions</div>}
      {earlier.map((s) => (
        <details className="collapse" key={s.id}>
          <summary>
            <span>{fmtWeekdayDate(s.date)}</span>
            <span className="badge-muted">
              {s.groups.reduce((n, g) => n + g.sets.length, 0)} sets
              {s.effort != null ? ` · effort ${s.effort}/10` : ""}
            </span>
          </summary>
          <div className="collapse-body">
            {s.notes ? <div className="rationale">{s.notes}</div> : null}
            {renderSession(s)}
          </div>
        </details>
      ))}

      {toast && <div className="toast">{toast}</div>}
      <div style={{ height: 24 }} />
    </>
  );
}
