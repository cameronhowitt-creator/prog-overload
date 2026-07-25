"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  MovementCategory,
  ProgramLift,
  Session,
} from "@/lib/domain/types";
import {
  CATEGORY_LABEL,
  fmtLastTime,
  fmtPR,
  fmtReps,
  fmtRest,
  fmtShortDate,
} from "@/lib/domain/format";
import {
  displayWeightNumber,
  formatWeight,
  toCanonicalWeightKg,
  weightUnit,
  type UnitsPreference,
} from "@/lib/domain/units";
import {
  excludeAndRegenerateAction,
  excludeOriginalAction,
  generateTodayAction,
  logSetAction,
  swapLiftAction,
} from "./actions";

type LoggedSet = { weight: number; reps: number };
type Draft = { weight: string; reps: string };

export type SwapExercise = {
  id: string;
  name: string;
  category: MovementCategory;
  muscleGroups: string[];
  equipment: string;
};

const EQUIP_LABEL: Record<string, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  cable: "Cable",
  bodyweight: "Bodyweight",
  kettlebell: "Kettlebell",
  bands: "Bands",
  "trap-bar": "Trap bar",
};

export default function TodayClient({
  session,
  dateLabel,
  initialLogs,
  library,
  units,
}: {
  session: Session;
  dateLabel: string;
  // Weights are canonical kg; the UI converts to `units` for display + input.
  initialLogs: Record<string, LoggedSet[]>;
  library: SwapExercise[];
  units: UnitsPreference;
}) {
  const { program } = session;
  const wLabel = weightUnit(units);
  const [excludeFor, setExcludeFor] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, LoggedSet[]>>(initialLogs);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Swap flow state
  const [swapForId, setSwapForId] = useState<string | null>(null);
  const [swapQuery, setSwapQuery] = useState("");
  const [swapSelected, setSwapSelected] = useState<string | null>(null);
  const [postSwap, setPostSwap] = useState<{ id: string; name: string } | null>(null);
  const [excludeReasonOpen, setExcludeReasonOpen] = useState(false);
  const [excludeReason, setExcludeReason] = useState("");
  const [pending, startSwapTransition] = useTransition();

  const swapLift = useMemo(
    () => program.lifts.find((l) => l.exerciseId === swapForId) ?? null,
    [program.lifts, swapForId],
  );

  // Everything logged so far this session, in program order (PRD §6.3).
  const loggedEntries = program.lifts
    .map((l) => ({ lift: l, sets: logs[l.exerciseId] ?? [] }))
    .filter((x) => x.sets.length > 0);
  const totalLogged = loggedEntries.reduce((n, x) => n + x.sets.length, 0);

  const swapOptions = useMemo(() => {
    if (!swapLift) return [];
    const q = swapQuery.trim().toLowerCase();
    if (q) {
      return library.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 12);
    }
    return library
      .filter((e) => e.id !== swapLift.exerciseId)
      .map((e) => ({
        e,
        score:
          e.muscleGroups.filter((m) => swapLift.muscleGroups.includes(m)).length *
            2 + (e.category === swapLift.category ? 1 : 0),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name))
      .slice(0, 8)
      .map((x) => x.e);
  }, [swapLift, swapQuery, library]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  // Prefill for a lift's next set (in DISPLAY units): last set logged, else the
  // prescription — all sourced from canonical kg and converted for the input.
  function defaultDraft(lift: ProgramLift): Draft {
    const done = logs[lift.exerciseId]?.length ?? 0;
    const prev = logs[lift.exerciseId]?.[done - 1];
    const baseKg = prev?.weight ?? lift.weightTarget ?? lift.lastTime?.weight ?? null;
    return {
      weight: baseKg != null ? String(displayWeightNumber(baseKg, units)) : "",
      reps: String(prev?.reps ?? lift.repHigh),
    };
  }
  function draftFor(lift: ProgramLift): Draft {
    return drafts[lift.exerciseId] ?? defaultDraft(lift);
  }
  // Merge onto the current draft (functional update to avoid stale closures) so
  // editing one field never clears the other's prefill.
  function setDraft(lift: ProgramLift, patch: Partial<Draft>) {
    setDrafts((prev) => ({
      ...prev,
      [lift.exerciseId]: { ...(prev[lift.exerciseId] ?? defaultDraft(lift)), ...patch },
    }));
  }

  // Log the set the user just completed — straight to history (PRD §6.3). The
  // draft is in DISPLAY units; convert to canonical kg for storage.
  function logSet(lift: ProgramLift) {
    const d = draftFor(lift);
    const dispW = Number(d.weight) || 0;
    const r = Number(d.reps) || 0;
    if (r <= 0) {
      showToast("Enter the reps you completed");
      return;
    }
    const weightKg = toCanonicalWeightKg(dispW, units);
    const setIndex = logs[lift.exerciseId]?.length ?? 0;
    setSavingId(lift.exerciseId);

    startTransition(async () => {
      const res = await logSetAction({
        sessionId: session.id,
        exerciseId: lift.exerciseId,
        exerciseName: lift.exerciseName,
        setIndex,
        weight: weightKg,
        reps: r,
      });
      setLogs((prev) => ({
        ...prev,
        [lift.exerciseId]: [...(prev[lift.exerciseId] ?? []), { weight: weightKg, reps: r }],
      }));
      // Keep the entered (display) weight for the next set; reps for a quick repeat.
      setDrafts((prev) => ({
        ...prev,
        [lift.exerciseId]: { weight: String(dispW), reps: String(r) },
      }));
      setSavingId(null);
      const doneNow = setIndex + 1;
      if (res.isNewPR)
        showToast(`New PR — ${formatWeight(res.prWeight, units)} (${res.bucket})`);
      else if (doneNow >= lift.sets) showToast(`${lift.exerciseName} complete`);
      else showToast("Set logged");
    });
  }

  function openSwap(lift: ProgramLift) {
    setSwapForId(lift.exerciseId);
    setSwapQuery("");
    setSwapSelected(null);
  }

  function confirmSwap() {
    if (!swapLift || !swapSelected) return;
    const original = { id: swapLift.exerciseId, name: swapLift.exerciseName };
    startSwapTransition(async () => {
      await swapLiftAction({
        sessionId: session.id,
        originalExerciseId: original.id,
        newExerciseId: swapSelected,
      });
      setSwapForId(null);
      setPostSwap(original);
      setExcludeReasonOpen(false);
      setExcludeReason("");
    });
  }

  function excludeOriginal() {
    if (!postSwap || !excludeReason.trim()) return;
    const original = postSwap;
    startSwapTransition(async () => {
      await excludeOriginalAction({
        exerciseId: original.id,
        exerciseName: original.name,
        reason: excludeReason,
      });
      setPostSwap(null);
      showToast("Excluded going forward — reason saved");
    });
  }

  let lastCategory = "";

  return (
    <>
      <div className="topbar">
        <div className="eyebrow">{dateLabel}</div>
        <h1>Today&apos;s session</h1>
        <div className="meta">
          <span>
            <b>{program.targetMinutes}</b> min target
          </span>
          <span>
            <b>{program.lifts.length}</b> lifts
          </span>
          <span>
            <b>~{program.warmupMinutes}</b> min warm-up
          </span>
        </div>
        {program.contextNote && (
          <div className="lift-tag" style={{ marginTop: 8, color: "var(--primary)" }}>
            {program.contextNote}
          </div>
        )}
      </div>

      {program.lifts.map((lift) => {
        const showLabel = lift.category !== lastCategory;
        lastCategory = lift.category;
        const isPrimary = lift.category === "primary";
        const logged = logs[lift.exerciseId] ?? [];
        const done = logged.length >= lift.sets;
        const d = draftFor(lift);
        const saving = savingId === lift.exerciseId;
        return (
          <div key={lift.exerciseId}>
            {showLabel && (
              <div className="section-label">
                {CATEGORY_LABEL[lift.category] ?? lift.category}
              </div>
            )}
            <div className={`card${isPrimary ? " primary" : ""}`}>
              <div className="row-top">
                <div style={{ minWidth: 0 }}>
                  <p className="lift-name">
                    {done ? "✓ " : ""}
                    {lift.exerciseName}
                  </p>
                  <div className="lift-tag">{lift.muscleGroups.join(" · ")}</div>
                </div>
                <button className="swap-btn" type="button" onClick={() => openSwap(lift)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M17 1l4 4-4 4" />
                    <path d="M3 11V9a4 4 0 014-4h14" />
                    <path d="M7 23l-4-4 4-4" />
                    <path d="M21 13v2a4 4 0 01-4 4H3" />
                  </svg>
                  Swap
                </button>
              </div>

              <div className="prescription">
                <div>
                  <div className="num">{lift.sets}</div>
                  <div className="lbl">sets</div>
                </div>
                <div>
                  <div className="num">{fmtReps(lift.repLow, lift.repHigh)}</div>
                  <div className="lbl">reps</div>
                </div>
                <div>
                  <div className="num">
                    {lift.equipment === "bodyweight"
                      ? "BW"
                      : lift.weightTarget !== null
                        ? displayWeightNumber(lift.weightTarget, units)
                        : "—"}
                  </div>
                  <div className="lbl">
                    {lift.equipment === "bodyweight" || lift.weightTarget === null
                      ? "target"
                      : `${wLabel} target`}
                  </div>
                </div>
                <div>
                  <div className="num">
                    {fmtRest(lift.restSecondsLow, lift.restSecondsHigh)}
                  </div>
                  <div className="lbl">rest</div>
                </div>
              </div>

              <div className="ref-row">
                <div className="ref-chip">
                  <div className="k">Last time</div>
                  <div className="v">{fmtLastTime(lift.lastTime, units)}</div>
                </div>
                <div className="ref-chip">
                  <div className="k">
                    {lift.pr ? `PR · ${lift.pr.repBucket} reps` : "PR"}
                  </div>
                  <div className="v">
                    {fmtPR(lift.pr, units)}{" "}
                    {lift.pr && <span>{fmtShortDate(lift.pr.date)}</span>}
                  </div>
                </div>
              </div>

              <div className="rationale">
                <b>Why:</b> {lift.rationale}
              </div>

              {lift.cues.length > 0 && (
                <div className="cues">
                  <div className="clbl">Focus cues</div>
                  {lift.cues.map((c) => (
                    <span className="cue-pill" key={c}>
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Logged sets so far */}
              {logged.length > 0 && (
                <div className="cues" style={{ marginTop: 10 }}>
                  <div className="clbl">Logged</div>
                  {logged.map((s, i) => (
                    <span
                      className="cue-pill"
                      key={i}
                      style={{ background: "var(--rationale-bg)", color: "var(--rationale-ink)" }}
                    >
                      {s.weight ? `${displayWeightNumber(s.weight, units)}×${s.reps}` : `BW×${s.reps}`}
                    </span>
                  ))}
                </div>
              )}

              {/* Inline set logger — type what you did, tap Log (PRD §6.3) */}
              {!done ? (
                <div className="log-inline">
                  <div className="log-set-label">
                    Set {logged.length + 1} of {lift.sets}
                  </div>
                  <div className="log-fields">
                    <div className="log-field">
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder={wLabel}
                        aria-label={`${lift.exerciseName} weight`}
                        value={d.weight}
                        onChange={(e) => setDraft(lift, { weight: e.target.value })}
                      />
                      <span>{wLabel}</span>
                    </div>
                    <div className="log-times">×</div>
                    <div className="log-field">
                      <input
                        type="number"
                        inputMode="numeric"
                        placeholder="reps"
                        aria-label={`${lift.exerciseName} reps`}
                        value={d.reps}
                        onChange={(e) => setDraft(lift, { reps: e.target.value })}
                      />
                      <span>reps</span>
                    </div>
                    <button
                      className="logbtn"
                      type="button"
                      onClick={() => logSet(lift)}
                      disabled={saving}
                    >
                      {saving ? "…" : "Log set"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="log-done">✓ All {lift.sets} sets logged</div>
              )}

              {/* Exclude going forward */}
              {excludeFor === lift.exerciseId ? (
                <form action={excludeAndRegenerateAction} style={{ marginTop: 12 }}>
                  <input type="hidden" name="exerciseId" value={lift.exerciseId} />
                  <input type="hidden" name="exerciseName" value={lift.exerciseName} />
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor={`reason-${lift.exerciseId}`}>
                      Why exclude it? (saved with the exclusion)
                    </label>
                    <input
                      id={`reason-${lift.exerciseId}`}
                      name="reason"
                      type="text"
                      placeholder="e.g. bothers my shoulder"
                      autoFocus
                    />
                  </div>
                  <div className="inline-actions">
                    <button className="btn-primary" type="submit">
                      Exclude &amp; regenerate
                    </button>
                    <button
                      className="btn-ghost"
                      type="button"
                      onClick={() => setExcludeFor(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  className="text-link"
                  style={{ marginTop: 10 }}
                  onClick={() => setExcludeFor(lift.exerciseId)}
                >
                  Don&apos;t program this again
                </button>
              )}
            </div>
          </div>
        );
      })}

      <form action={generateTodayAction} className="field" style={{ marginTop: 18 }}>
        <button className="btn-ghost" type="submit" style={{ width: "100%" }}>
          Regenerate session
        </button>
      </form>

      {/* Pinned session log — the running list of logged sets with details,
          fixed to the bottom of the session (PRD §6.3). */}
      {totalLogged > 0 && (
        <div className="session-log">
          <div className="session-log-head">
            Session log · {totalLogged} {totalLogged === 1 ? "set" : "sets"}
          </div>
          <div className="session-log-list">
            {loggedEntries.map(({ lift, sets }) => (
              <div className="session-log-group" key={lift.exerciseId}>
                <div className="session-log-name">{lift.exerciseName}</div>
                {sets.map((s, i) => (
                  <div className="session-log-row" key={i}>
                    <span className="sl-set">Set {i + 1}</span>
                    <span className="sl-val">
                      {s.weight ? formatWeight(s.weight, units) : "BW"} × {s.reps} reps
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {/* Swap picker sheet (PRD §6.5) */}
      {swapLift && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setSwapForId(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <h2>Swap exercise</h2>
            <div className="sub">
              Alternatives targeting {swapLift.muscleGroups.join(" & ")}
            </div>
            <div className="search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted-48)" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                placeholder="Search the full library"
                value={swapQuery}
                onChange={(e) => setSwapQuery(e.target.value)}
              />
            </div>
            <div className="chip-grid">
              {swapOptions.map((opt) => (
                <button
                  key={opt.id}
                  className={`chip${swapSelected === opt.id ? " selected" : ""}`}
                  type="button"
                  onClick={() => setSwapSelected(opt.id)}
                >
                  <div className="thumb">{opt.name.charAt(0)}</div>
                  <div className="txt">
                    <div className="n">{opt.name}</div>
                    <div className="e">{EQUIP_LABEL[opt.equipment] ?? opt.equipment}</div>
                  </div>
                </button>
              ))}
              {swapOptions.length === 0 && (
                <p className="empty" style={{ width: "100%" }}>
                  No matches.
                </p>
              )}
            </div>
            <button
              className="btn-primary"
              type="button"
              style={{ marginTop: 16 }}
              onClick={confirmSwap}
              disabled={!swapSelected || pending}
            >
              Confirm swap
            </button>
          </div>
        </div>
      )}

      {/* Post-swap: exclude the original going forward? (PRD §6.5) */}
      {postSwap && (
        <div className="scrim">
          <div className="sheet">
            <div className="sheet-handle" />
            <h2>Exclude this lift?</h2>
            <div className="sub">
              You swapped out {postSwap.name}. Stop programming it going forward?
            </div>
            {!excludeReasonOpen ? (
              <div className="inline-actions" style={{ marginTop: 4 }}>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => setExcludeReasonOpen(true)}
                >
                  Yes, exclude it
                </button>
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => {
                    setPostSwap(null);
                    showToast("Swap applied for today only");
                  }}
                >
                  No, just today
                </button>
              </div>
            ) : (
              <>
                <div className="field" style={{ margin: "4px 0 0" }}>
                  <label htmlFor="post-swap-reason">Why exclude it?</label>
                  <input
                    id="post-swap-reason"
                    type="text"
                    placeholder="e.g. bothers my lower back"
                    value={excludeReason}
                    onChange={(e) => setExcludeReason(e.target.value)}
                    autoFocus
                  />
                </div>
                <button
                  className="btn-primary"
                  type="button"
                  style={{ marginTop: 14 }}
                  onClick={excludeOriginal}
                  disabled={!excludeReason.trim() || pending}
                >
                  Save exclusion
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
