"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { PlanIntensity, SessionStatus } from "@/lib/domain/types";
import { fmtWeekdayDate } from "@/lib/domain/dates";
import { fmtReps } from "@/lib/domain/format";
import {
  displayWeightNumber,
  weightUnit,
  type UnitsPreference,
} from "@/lib/domain/units";
import { buildPlanAction, materializeSessionAction } from "./actions";

export type PlanDayView = {
  id: string;
  date: string;
  focus: string;
  emphasis: string[];
  intensity: PlanIntensity;
  note: string | null;
  adapted: boolean;
  candidates: string[];
  session: {
    status: SessionStatus;
    effort: number | null;
    notes: string | null;
    lifts: {
      name: string;
      sets: number;
      repLow: number;
      repHigh: number;
      weightTarget: number | null;
      skipped: boolean;
    }[];
    estimatedMinutes: number;
  } | null;
};

export type PlanWeekView = {
  weekIndex: number;
  intent: string;
  days: PlanDayView[];
};

const INTENSITY_LABEL: Record<PlanIntensity, string> = {
  light: "Light",
  moderate: "Moderate",
  hard: "Hard",
};

export default function PlanClient({
  summary,
  weeks,
  today,
  units,
  startsOn,
  endsOn,
}: {
  summary: string | null;
  weeks: PlanWeekView[];
  today: string;
  units: UnitsPreference;
  startsOn: string | null;
  endsOn: string | null;
}) {
  const wLabel = weightUnit(units);
  const [open, setOpen] = useState<PlanDayView | null>(null);
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  function generate(day: PlanDayView) {
    startTransition(async () => {
      const res = await materializeSessionAction(day.id);
      setOpen(null);
      showToast(res.ok ? "Session ready" : (res.error ?? "Couldn't generate that"));
    });
  }

  if (weeks.length === 0) {
    return (
      <>
        <div className="topbar">
          <div className="eyebrow">Training block</div>
          <h1>Plan</h1>
        </div>
        <p className="empty">
          No training block yet. Build a 4-week program laid out on the days you
          train — each week varied, with a deload at the end.
        </p>
        <form action={buildPlanAction} className="field">
          <button className="btn-primary" type="submit" style={{ width: "100%" }}>
            Build my 4-week program
          </button>
        </form>
      </>
    );
  }

  const totalDays = weeks.reduce((n, w) => n + w.days.length, 0);
  const doneDays = weeks.reduce(
    (n, w) => n + w.days.filter((d) => d.session?.status === "completed").length,
    0,
  );

  return (
    <>
      <div className="topbar">
        <div className="eyebrow">
          {startsOn && endsOn
            ? `${fmtWeekdayDate(startsOn)} – ${fmtWeekdayDate(endsOn)}`
            : "Training block"}
        </div>
        <h1>Plan</h1>
        <div className="meta">
          <span>
            <b>{weeks.length}</b> weeks
          </span>
          <span>
            <b>{doneDays}</b>/{totalDays} sessions done
          </span>
        </div>
        {summary && (
          <div className="lift-tag" style={{ marginTop: 8 }}>
            {summary}
          </div>
        )}
      </div>

      {weeks.map((week) => (
        <div key={week.weekIndex}>
          <div className="section-label">
            Week {week.weekIndex + 1}
            {week.intent ? ` · ${week.intent}` : ""}
          </div>
          {week.days.map((day) => {
            const isToday = day.date === today;
            const isPast = day.date < today;
            const done = day.session?.status === "completed";
            return (
              <button
                className={`plan-day${isToday ? " today" : ""}${done ? " done" : ""}`}
                key={day.id}
                type="button"
                onClick={() => setOpen(day)}
              >
                <div className="plan-day-main">
                  <div className="plan-day-top">
                    <span className="plan-day-date">
                      {fmtWeekdayDate(day.date)}
                    </span>
                    <span className={`intensity-badge ${day.intensity}`}>
                      {INTENSITY_LABEL[day.intensity]}
                    </span>
                  </div>
                  <div className="lift-name">{day.focus}</div>
                  {day.emphasis.length > 0 && (
                    <div className="lift-tag">{day.emphasis.join(" · ")}</div>
                  )}
                  {day.adapted && day.note && (
                    <div className="plan-day-note">↻ {day.note}</div>
                  )}
                </div>
                <div className="plan-day-state">
                  {done
                    ? `✓${day.session?.effort != null ? ` ${day.session.effort}/10` : ""}`
                    : isToday
                      ? "Today"
                      : isPast
                        ? "Missed"
                        : day.session
                          ? "Ready"
                          : ""}
                </div>
              </button>
            );
          })}
        </div>
      ))}

      <div className="field" style={{ marginTop: 18 }}>
        {confirmRebuild ? (
          <>
            <p className="empty" style={{ textAlign: "left", margin: "0 0 10px" }}>
              This replaces the remaining plan with a fresh 4-week block starting
              today. Sessions you&apos;ve already logged are kept.
            </p>
            <form action={buildPlanAction}>
              <div className="inline-actions">
                <button className="btn-primary" type="submit">
                  Yes, rebuild
                </button>
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => setConfirmRebuild(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        ) : (
          <button
            className="btn-ghost"
            type="button"
            style={{ width: "100%" }}
            onClick={() => setConfirmRebuild(true)}
          >
            Rebuild 4-week plan
          </button>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}

      {/* Day detail: the plan's intent, plus the real prescription once it exists. */}
      {open && (
        <div
          className="scrim"
          onClick={(e) => e.target === e.currentTarget && setOpen(null)}
        >
          <div className="sheet">
            <div className="sheet-handle" />
            <h2>{open.focus}</h2>
            <div className="sub">
              {fmtWeekdayDate(open.date)} · {INTENSITY_LABEL[open.intensity]} day
              {open.emphasis.length ? ` · ${open.emphasis.join(", ")}` : ""}
            </div>

            {open.note && (
              <div className="rationale" style={{ marginBottom: 12 }}>
                {open.adapted ? <b>Adjusted: </b> : <b>Why: </b>}
                {open.note}
              </div>
            )}

            {open.session ? (
              <>
                <div className="clbl" style={{ marginBottom: 8 }}>
                  Prescription · ~{open.session.estimatedMinutes} min
                </div>
                {open.session.lifts.map((l, i) => (
                  <div className="list-row" key={`${l.name}-${i}`}>
                    <div style={{ minWidth: 0 }}>
                      <div
                        className="lift-name"
                        style={{
                          fontSize: 15,
                          textDecoration: l.skipped ? "line-through" : undefined,
                          opacity: l.skipped ? 0.55 : 1,
                        }}
                      >
                        {l.name}
                      </div>
                      <div className="lift-tag">
                        {l.sets} × {fmtReps(l.repLow, l.repHigh)}
                        {l.weightTarget != null
                          ? ` @ ${displayWeightNumber(l.weightTarget, units)} ${wLabel}`
                          : ""}
                      </div>
                    </div>
                  </div>
                ))}
                {open.session.notes && (
                  <div className="rationale" style={{ marginTop: 12 }}>
                    <b>Your notes:</b> {open.session.notes}
                  </div>
                )}
                {open.date === today && (
                  <Link
                    href="/today"
                    className="btn-primary"
                    style={{ display: "block", textAlign: "center", marginTop: 16 }}
                  >
                    Open today&apos;s session
                  </Link>
                )}
              </>
            ) : (
              <>
                {open.candidates.length > 0 && (
                  <div className="cues" style={{ marginTop: 0 }}>
                    <div className="clbl">Planned around</div>
                    {open.candidates.map((n) => (
                      <span className="cue-pill" key={n}>
                        {n}
                      </span>
                    ))}
                  </div>
                )}
                {open.date >= today ? (
                  <button
                    className="btn-primary"
                    type="button"
                    style={{ marginTop: 16 }}
                    onClick={() => generate(open)}
                    disabled={pending}
                  >
                    {pending ? "Generating…" : "Generate this session"}
                  </button>
                ) : (
                  <p className="empty" style={{ textAlign: "left" }}>
                    This day has passed — it was never generated.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <div style={{ height: 24 }} />
    </>
  );
}
