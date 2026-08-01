// Shared types for 4-week plan generation and adaptation.
//
// Mirrors the ProgramGenerator split in ./types.ts: a generator returns a
// lightweight OUTLINE (focus / emphasis / intensity per day, by weekday slot) and
// a shared assembly step in ./plan.ts attaches real dates and stable ids. The
// generator never invents dates — those come from the user's preferred weekdays.

import type {
  Exclusion,
  Exercise,
  PlanIntensity,
  PlannedDay,
  Profile,
  Weekday,
} from "../domain/types";

// One training slot the generator has to fill, handed to it with its real date so
// it can reason about spacing (back-to-back days, weekend vs weekday).
export interface PlanSlot {
  key: string; // "w0-d1" — how the generator refers to this slot
  weekIndex: number;
  weekday: Weekday;
  date: string; // ISO
}

export interface PlanContext {
  userId: string;
  startsOn: string;
  weeks: number;
  profile: Profile;
  exclusions: Exclusion[];
  library: Exercise[]; // already filtered to eligible lifts
  slots: PlanSlot[];
}

export interface PlanDayDraft {
  key: string; // must match a PlanSlot.key
  focus: string;
  emphasis: string[];
  intensity: PlanIntensity;
  candidateExerciseIds: string[];
  note: string | null;
}

export interface PlanWeekDraft {
  weekIndex: number;
  intent: string;
  days: PlanDayDraft[];
}

export interface PlanOutlineResult {
  summary: string;
  weeks: PlanWeekDraft[];
}

// ── Adaptation ───────────────────────────────────────────────────────────────

export interface PlanAdaptContext {
  profile: Profile;
  // The day that was just trained, and how it went.
  completed: {
    focus: string;
    intensity: PlanIntensity;
    date: string;
    effort: number; // 1–10
    notes: string;
    skippedLifts: string[];
    loggedLifts: string[];
  };
  // Effort/notes from earlier sessions, newest first — a single hard day is
  // different from the third one in a row.
  priorFeedback: { date: string; effort: number; notes: string }[];
  // Only days still ahead of the user. Past days are immutable history.
  remaining: PlannedDay[];
}

export interface PlanDayRevision {
  id: string; // PlannedDay.id
  focus: string;
  emphasis: string[];
  intensity: PlanIntensity;
  note: string; // why it changed — surfaced in the Plan tab
}

export interface PlanAdaptResult {
  // Empty when nothing needs to change.
  revisions: PlanDayRevision[];
  summary: string | null;
}

export interface PlanGenerator {
  readonly kind: "mock" | "anthropic";
  generatePlan(ctx: PlanContext): Promise<PlanOutlineResult>;
  adaptPlan(ctx: PlanAdaptContext): Promise<PlanAdaptResult>;
}
