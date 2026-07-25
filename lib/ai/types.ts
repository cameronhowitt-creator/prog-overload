// Shared types for program generation (PRD §6.2).
//
// Both generators (mock + Anthropic) produce a lightweight GeneratorResult of lift
// SELECTIONS. A single shared enrichment step (assembleProgram) then attaches the
// AUTHORITATIVE last-time and PR reference data from our own store — the model is
// never trusted for those numbers (PRD §6.2, §12; §7 data-quality note).

import type {
  Exclusion,
  Exercise,
  LastTime,
  LocationOverride,
  PR,
  Profile,
  TrainingPhase,
} from "../domain/types";

export interface ExerciseHistory {
  lastTime: LastTime | null;
  currentPRs: PR[]; // current (non-superseded) PRs across buckets
}

export interface GenerationContext {
  userId: string;
  date: string; // ISO yyyy-mm-dd
  profile: Profile;
  exclusions: Exclusion[];
  activeOverride: LocationOverride | null;
  library: Exercise[];
  phase: TrainingPhase;
  // Per-exercise history keyed by exercise id, for progression decisions +
  // reference chips.
  history: Record<string, ExerciseHistory>;
  // Correctives seen in recent sessions, so the rotation avoids repeats (PRD §6.2).
  recentCorrectiveIds: string[];
}

export interface LiftSelection {
  exerciseId: string;
  sets: number;
  repLow: number;
  repHigh: number;
  weightTarget: number | null; // null for bodyweight / holds
  rationale: string; // plain-language, references the actual last set
  cues?: string[]; // optional override; defaults to the exercise's stable cues
}

export interface GeneratorResult {
  phase: TrainingPhase;
  selections: LiftSelection[];
  contextNote: string | null; // e.g. which override was applied
}

export interface ProgramGenerator {
  readonly kind: "mock" | "anthropic";
  generate(ctx: GenerationContext): Promise<GeneratorResult>;
}
