// Programming heuristics seeded from Emma's Trainerize patterns (PRD §7) and her
// stated rest mental model (PRD §7 / §11.1 — NOT the shorter logged Trainerize values).
// Kept here in one place rather than scattered through prompts (plan "Reuse Notes").

import type { Equipment, MovementCategory, RepBucket, TrainingPhase } from "./types";

// Equipment that carries no external load to progress, so prescriptions must not
// name a weight target. "bands" belongs here alongside bodyweight: it also covers
// the small unloaded kit with no other Equipment tag (ab wheel, sliders).
export const NON_LOADABLE_EQUIPMENT = new Set<Equipment>(["bodyweight", "bands"]);

export function isLoadable(equipment: Equipment): boolean {
  return !NON_LOADABLE_EQUIPMENT.has(equipment);
}

// Rep-phase heuristic (PRD §7): classify by the top of the prescribed rep range.
export function phaseForMaxReps(maxReps: number): TrainingPhase {
  if (maxReps >= 13) return "endurance";
  if (maxReps <= 6) return "strength";
  return "hypertrophy"; // 7–12
}

// PR rep-range buckets (PRD §6.4, §11.3): tracked by bucket, not exact rep count.
export function repBucketFor(reps: number): RepBucket {
  if (reps <= 5) return "1-5";
  if (reps <= 10) return "6-10";
  return "11-15"; // 11+ collapses into the top bucket
}

export const REP_BUCKETS: RepBucket[] = ["1-5", "6-10", "11-15"];

// Rest defaults per Emma's stated model (PRD §7 / §11.1), in seconds.
// Primary/secondary compound lifts: 2–3 min. Accessory/isolation: 90s–2 min.
export function restDefaultsFor(category: MovementCategory): {
  low: number;
  high: number;
} {
  switch (category) {
    case "primary":
    case "secondary":
      return { low: 120, high: 180 };
    case "accessory":
    case "core":
      return { low: 90, high: 120 };
    case "mobility":
      return { low: 30, high: 60 };
  }
}

// Default rep ranges per phase, used when the profile doesn't specify otherwise.
export function repRangeFor(phase: TrainingPhase): { low: number; high: number } {
  switch (phase) {
    case "strength":
      return { low: 4, high: 6 };
    case "hypertrophy":
      return { low: 8, high: 12 };
    case "endurance":
      return { low: 13, high: 15 };
  }
}

// Fixed session default (PRD §11.4): 60 min end-to-end incl. warm-up.
export const DEFAULT_SESSION_MINUTES = 60;
export const DEFAULT_WARMUP_MINUTES = 8; // 7–10 min dynamic warm-up (PRD §5)

// Real-world slack carved OUT of the stated session time: rest that runs long,
// waiting for a rack or machine to free up, loading and stripping plates. Without
// it a "60 min" session reliably overruns.
export const DEFAULT_BUFFER_MINUTES = 10;

// Minutes actually available for prescribed lifts, once the warm-up and the
// buffer are taken off the top. This — not the raw session length — is the budget
// both generators size a session against.
export function liftingBudgetMinutes(
  sessionMinutes: number = DEFAULT_SESSION_MINUTES,
): number {
  return Math.max(
    15,
    sessionMinutes - DEFAULT_WARMUP_MINUTES - DEFAULT_BUFFER_MINUTES,
  );
}

// Rough per-lift time estimate for session sizing so the whole thing fits the
// 60-min window (PRD §6.2, §11.4): work + rest across all sets, in minutes.
export function estimateLiftMinutes(
  sets: number,
  restSecondsHigh: number,
): number {
  const workPerSetSeconds = 45; // ramp + working set, directional
  const total = sets * (workPerSetSeconds + restSecondsHigh);
  return Math.round(total / 60);
}

// Does a candidate set beat the current bucket PR? (PRD §6.4)
// Heavier wins; on equal weight, more reps wins.
export function beatsPR(
  candidate: { weight: number; reps: number },
  current: { weight: number; reps: number } | null,
): boolean {
  if (!current) return true;
  if (candidate.weight > current.weight) return true;
  if (candidate.weight === current.weight && candidate.reps > current.reps)
    return true;
  return false;
}
