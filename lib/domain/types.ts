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

export interface Profile {
  userId: string;
  sessionLengthMin: number; // fixed default 60, end-to-end incl. warm-up (PRD §11.4)
  goals: string[];
  defaultEquipmentContext: string; // e.g. "Full gym"
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

export interface LoggedSet {
  id: string;
  userId: string;
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  weight: number;
  reps: number;
  loggedAt: string; // ISO
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
  // Duration bookkeeping so the whole session fits the 60-min window (PRD §11.4).
  estimatedMinutes: number;
}

export interface Program {
  phase: TrainingPhase;
  warmupMinutes: number;
  targetMinutes: number;
  estimatedMinutes: number;
  lifts: ProgramLift[];
  // Short note on the active context used (e.g. which override was applied).
  contextNote: string | null;
}

export type SessionStatus = "generated" | "in_progress" | "completed";

export interface Session {
  id: string;
  userId: string;
  date: string; // ISO date
  program: Program;
  status: SessionStatus;
  createdAt: string;
}
