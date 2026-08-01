"use client";

import { useState, useTransition } from "react";
import { WEEKDAY_ORDER, WEEKDAY_SHORT } from "@/lib/domain/dates";
import type { Weekday } from "@/lib/domain/types";
import { setTrainingDaysAction } from "./actions";

export default function TrainingDaysField({ days }: { days: Weekday[] }) {
  const [selected, setSelected] = useState<Weekday[]>(days);
  const [saved, setSaved] = useState(false);
  const [rebuild, setRebuild] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty =
    selected.length !== days.length || selected.some((d) => !days.includes(d));

  function toggle(d: Weekday) {
    setSaved(false);
    setSelected((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }

  function save() {
    startTransition(async () => {
      await setTrainingDaysAction({ days: selected, rebuildPlan: rebuild });
      setSaved(true);
      setRebuild(false);
    });
  }

  return (
    <div className="card">
      <div className="lift-tag" id="training-days-label" style={{ marginBottom: 10 }}>
        Your 4-week plan schedules one session on each of these days.
      </div>
      <div
        className="day-picker"
        role="group"
        aria-labelledby="training-days-label"
      >
        {WEEKDAY_ORDER.map((d) => (
          <button
            key={d}
            type="button"
            className={`day-chip${selected.includes(d) ? " selected" : ""}`}
            aria-pressed={selected.includes(d)}
            onClick={() => toggle(d)}
          >
            {WEEKDAY_SHORT[d]}
          </button>
        ))}
      </div>

      {dirty && (
        <label className="checkline" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={rebuild}
            onChange={(e) => setRebuild(e.target.checked)}
          />
          <span>
            Rebuild my 4-week plan on these days (replaces the remaining block)
          </span>
        </label>
      )}

      <button
        className="btn-ghost"
        type="button"
        style={{ width: "100%", marginTop: 12 }}
        onClick={save}
        disabled={pending || selected.length === 0 || (!dirty && saved)}
      >
        {pending
          ? "Saving…"
          : saved && !dirty
            ? "Saved"
            : selected.length === 0
              ? "Pick at least one day"
              : "Save training days"}
      </button>
    </div>
  );
}
