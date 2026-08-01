// Core domain types for the Progressive Overload app.
// User-scoped from day one (every persistent entity carries userId) so multi-user
// support later needs no schema rewrite — see PRD §5, §8.

export type RepBucket = "1-5" | "6-10" | "11-15";

export type MovementCategory =
  | "primary"
  | "secondary"
  | "accessory"
  | "core"
  | "mobility";

// Equipment tag drives swap availability and gym-context filtering (PRD §6.5).
export type Equipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "kettlebell"
  | "bands"
  | "trap-bar";

// Rep-phase heuristic buckets (PRD §7).
export type TrainingPhase = "endurance" | "hypertrophy" | "strength";

export interface Exercise {
  id: string;
  name: string;
  muscleGroups: string[];
  category: MovementCategory;
  equipment: Equipment;
  // Two to three stable form cues, chosen for injury-risk + target support (PRD §6.2).
  defaultCues: string[];
  // Designated "core" lifts (squat, bench, pull-ups, deadlift) stay stable across
  // sessions for trackable progression rather than being rotated (PRD §6.2, §6.4).
  isCoreLift?: boolean;
  // Correctives are rotated from a small pool per standing goal (e.g. "apt" =
  // anterior pelvic tilt) to avoid staleness (PRD §6.2).
  correctiveGoal?: string;
}

export type ExperienceLevel = "new" | "under_1yr" | "1_3yr" | "3yr_plus";
export type EquipmentAccess =
  | "full_gym"
  | "home_gym"
  | "limited_dumbbells"
  | "bodyweight";
export type StressLevel = "low" | "moderate" | "high";
export type ActivityOutsideGym = "sedentary" | "active_job" | "other_sport";
export type CreatineStatus = "yes" | "no" | "considering";

// Whether the user enters/sees imperial (lb, ft-in) or metric (kg, cm). No default —
// chosen as the first onboarding step. Storage is always canonical metric (PRD §6.6).
export type UnitsPreference = "imperial" | "metric";

// Day of week, matching JS `Date.getDay()` — 0 = Sunday … 6 = Saturday. The user
// picks the days they actually train in onboarding; the 4-week plan is laid out
// on exactly those days.
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Full user profile captured across onboarding (PRD §6.6). `id` is the auth user id.
// Most fields are optional because onboarding saves incrementally, step by step.
export interface Profile {
  id: string;
  unitsPreference?: UnitsPreference; // display/input only; storage stays metric
  name?: string;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  primaryGoal?: string;
  experienceLevel?: ExperienceLevel;
  // The specific weekdays the user trains. daysPerWeek is derived from its length
  // and kept in sync so existing consumers keep working.
  preferredWorkoutDays?: Weekday[];
  daysPerWeek?: number;
  sessionDurationMinutes?: number; // end-to-end incl. warm-up (PRD §11.4)
  equipmentAccess?: EquipmentAccess;
  injuryFlags?: string[];
  mobilityFlags?: string[];
  medicalClearanceStatus?: string;
  pregnancyPostpartumStatus?: string;
  cycleTrackingOptIn?: boolean;
  cycleLengthDays?: number;
  typicalSleepHours?: number;
  stressLevel?: StressLevel;
  activityOutsideGym?: ActivityOutsideGym;
  creatineStatus?: CreatineStatus;
  dislikedExercises?: string[];
  onboardingCompletedAt?: string | null;
  // The lifts the user currently trains (own table on Supabase, field on the local
  // store). Drives which strength lifts the generator programs and which appear in
  // the logging flow. Empty = unrestricted (pre-onboarding / legacy users).
  userActiveLifts: string[]; // exercise ids
}

export interface Exclusion {
  id: string;
  userId: string;
  exerciseId: string | null; // may be a free-text name not yet in the library
  exerciseName: string;
  reason: string; // required — always recorded with the exclusion (PRD §6.1)
  createdAt: string; // ISO
}

// Temporary, dated equipment/location override that AUTO-EXPIRES rather than
// sticking indefinitely — the inverse of exclusions (PRD §6.1).
export interface LocationOverride {
  id: string;
  userId: string;
  context: string; // e.g. "Hotel gym — dumbbells + machines only"
  startsOn: string; // ISO date (yyyy-mm-dd)
  expiresOn: string; // ISO date — active only through this date
  createdAt: string;
}

// Where a logged set came from: live in-app logging vs. a self-reported baseline
// captured during onboarding (PRD §6.6). DB column defaults to "app".
export type LogSource = "app" | "onboarding";

export interface LoggedSet {
  id: string;
  userId: string;
  // Nullable UUID FK to sessions — null for onboarding baselines (no session yet).
  sessionId: string | null;
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  weight: number;
  reps: number;
  loggedAt: string; // ISO
  source?: LogSource; // defaults to "live"
}

// How recently the user last performed a lift, captured in onboarding. Mapped to
// a concrete backdated date when persisted as a logged set.
export type ApproxDate = "this_week" | "few_weeks_ago" | "over_a_month_ago";

// A self-reported baseline entered during onboarding, before it's persisted as a
// source: "onboarding" logged set (PRD §6.6).
export interface OnboardingLiftEntry {
  exerciseId: string;
  weight?: number;
  reps?: number;
  approxDate?: ApproxDate;
  source: "onboarding";
}

// A PR is tracked per lift AND per rep-range bucket. A new set overwrites its
// bucket PR only if it beats it; beaten PRs are retained as history (PRD §6.4).
export interface PR {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseName: string;
  repBucket: RepBucket;
  weight: number;
  reps: number;
  dateAchieved: string; // ISO date
  superseded: boolean; // false = current bucket PR, true = retained history
}

// Persistent reference context shown alongside every prescription (PRD §6.2).
export interface LastTime {
  weight: number;
  reps: number;
  sets: number;
  date: string;
}

export interface PRReference {
  weight: number;
  reps: number;
  repBucket: RepBucket;
  date: string;
}

// One prescribed lift within a generated program.
export interface ProgramLift {
  exerciseId: string;
  exerciseName: string;
  category: MovementCategory;
  muscleGroups: string[];
  equipment: Equipment;
  sets: number;
  repLow: number;
  repHigh: number;
  weightTarget: number | null; // null for bodyweight / hold work
  restSecondsLow: number;
  restSecondsHigh: number;
  // Plain-language rationale referencing an actual prior logged set (PRD §6.2).
  rationale: string;
  cues: string[];
  lastTime: LastTime | null;
  pr: PRReference | null;
  // Duration bookkeeping so the whole session fits the available window.
  estimatedMinutes: number;
  // Passed on mid-session without swapping it for anything else. Session-only —
  // skipping never writes a standing Exclusion (that's what Swap is for).
  skipped?: boolean;
}

export interface Program {
  phase: TrainingPhase;
  warmupMinutes: number;
  targetMinutes: number; // total time the user said they have, end to end
  // Reserved slack for rest overruns, waiting on equipment, changing plates. The
  // generator's real budget is targetMinutes - warmupMinutes - bufferMinutes.
  bufferMinutes: number;
  estimatedMinutes: number;
  lifts: ProgramLift[];
  // Short note on the active context used (e.g. which override was applied).
  contextNote: string | null;
}

export type SessionStatus = "generated" | "in_progress" | "completed";

// How the session actually felt, captured when the user ends it. Drives the
// adaptation of the remaining days in the training plan.
export interface SessionFeedback {
  effort: number; // 1–10 perceived effort / strain
  notes: string; // free text — "lower back felt it on the last deadlift set"
  completedAt: string; // ISO timestamp
}

export interface Session {
  id: string;
  userId: string;
  date: string; // ISO date
  program: Program;
  status: SessionStatus;
  createdAt: string;
  // Set when the session was materialized from a day in a training plan.
  planId?: string | null;
  planDayId?: string | null;
  feedback?: SessionFeedback | null;
}

// ---------------------------------------------------------------------------
// Multi-week training plan
//
// A plan is an OUTLINE, not a set of full prescriptions: each planned day carries
// its focus, emphasis and intensity, and the full sets/reps/loads are generated
// on demand when the day is opened — so week-3 targets aren't guessed before any
// of week 1 has been logged.
// ---------------------------------------------------------------------------

export type PlanIntensity = "light" | "moderate" | "hard";

export interface PlannedDay {
  id: string; // stable — sessions and adaptations reference this
  date: string; // ISO date (yyyy-mm-dd)
  weekIndex: number; // 0-based within the block
  weekday: Weekday;
  focus: string; // e.g. "Lower body — squat emphasis"
  emphasis: string[]; // muscle groups this day drives
  intensity: PlanIntensity;
  // Suggested lifts for this day, by exercise id — a hint for generation, not a
  // hard prescription.
  candidateExerciseIds: string[];
  // Why this day looks like this, or why it was changed by an adaptation.
  note: string | null;
  adapted?: boolean;
}

export interface PlanWeek {
  weekIndex: number;
  intent: string; // e.g. "Accumulation", "Deload"
  days: PlannedDay[];
}

export interface PlanOutline {
  summary: string;
  weeks: PlanWeek[];
}

export type PlanStatus = "active" | "completed" | "archived";

export interface TrainingPlan {
  id: string;
  userId: string;
  startsOn: string; // ISO date
  endsOn: string; // ISO date
  weeks: number;
  status: PlanStatus;
  outline: PlanOutline;
  createdAt: string;
  updatedAt: string;
}
