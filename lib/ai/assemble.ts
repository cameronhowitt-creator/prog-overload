// Shared enrichment: turn a generator's lightweight selections into a full Program,
// attaching AUTHORITATIVE reference data (last-time, PR) from our own store so the
// numbers Emma sees mid-set are always real, never model-hallucinated (PRD §6.2, §12).

import {
  DEFAULT_BUFFER_MINUTES,
  DEFAULT_SESSION_MINUTES,
  DEFAULT_WARMUP_MINUTES,
  estimateLiftMinutes,
  liftingBudgetMinutes,
  repBucketFor,
  restDefaultsFor,
} from "../domain/heuristics";
import type { Program, ProgramLift, PRReference } from "../domain/types";
import type { GenerationContext, GeneratorResult } from "./types";

export function assembleProgram(
  ctx: GenerationContext,
  result: GeneratorResult,
): Program {
  const byId = new Map(ctx.library.map((e) => [e.id, e]));

  const lifts: ProgramLift[] = [];
  for (const sel of result.selections) {
    const ex = byId.get(sel.exerciseId);
    if (!ex) continue; // generator referenced an unknown exercise — drop it

    const rest = restDefaultsFor(ex.category);
    const hist = ctx.history[ex.id];
    // The "relevant" PR bucket for a prescribed range is its midpoint — a range
    // like 8–12 sits in the 6-10 bucket, not 11-15 (PRD §6.2, §6.4).
    const midReps = Math.round((sel.repLow + sel.repHigh) / 2);
    const targetBucket = repBucketFor(midReps);
    const bucketPR = hist?.currentPRs.find((p) => p.repBucket === targetBucket);

    const pr: PRReference | null = bucketPR
      ? {
          weight: bucketPR.weight,
          reps: bucketPR.reps,
          repBucket: bucketPR.repBucket,
          date: bucketPR.dateAchieved,
        }
      : null;

    lifts.push({
      exerciseId: ex.id,
      exerciseName: ex.name,
      category: ex.category,
      muscleGroups: ex.muscleGroups,
      equipment: ex.equipment,
      sets: sel.sets,
      repLow: sel.repLow,
      repHigh: sel.repHigh,
      weightTarget: sel.weightTarget,
      restSecondsLow: rest.low,
      restSecondsHigh: rest.high,
      rationale: sel.rationale,
      // Cues are stable per lift; a generator may override but defaults to the
      // library's curated set (PRD §6.2).
      cues: (sel.cues && sel.cues.length ? sel.cues : ex.defaultCues).slice(0, 3),
      lastTime: hist?.lastTime ?? null,
      pr,
      estimatedMinutes: estimateLiftMinutes(sel.sets, rest.high),
    });
  }

  const targetMinutes =
    ctx.profile.sessionDurationMinutes ?? DEFAULT_SESSION_MINUTES;

  // Enforce the time budget for EVERY generator. The live model is told the
  // budget in the prompt but nothing made it obey; this is the backstop.
  trimToBudget(lifts, liftingBudgetMinutes(targetMinutes));

  const liftMinutes = lifts.reduce((sum, l) => sum + l.estimatedMinutes, 0);
  const warmupMinutes = DEFAULT_WARMUP_MINUTES;

  return {
    phase: result.phase,
    warmupMinutes,
    targetMinutes,
    bufferMinutes: DEFAULT_BUFFER_MINUTES,
    estimatedMinutes: warmupMinutes + liftMinutes,
    lifts,
    contextNote: result.contextNote,
  };
}

// Cut the session down until it fits the lifting budget, the way a coach would:
// first drop the most expendable whole lifts, then shave sets off what's left.
// The primary compound, the core lift and the corrective are never dropped —
// they're the session's point — but they can lose a set. Mutates in place.
function trimToBudget(lifts: ProgramLift[], budgetMinutes: number): void {
  const total = () => lifts.reduce((sum, l) => sum + l.estimatedMinutes, 0);

  // 1. Drop accessories from the end, then secondaries.
  for (const category of ["accessory", "secondary"] as const) {
    for (let i = lifts.length - 1; i >= 0 && total() > budgetMinutes; i--) {
      if (lifts[i].category === category) lifts.splice(i, 1);
    }
  }

  // 2. Still over — shave sets off the longest lift each pass, down to a floor of
  // 2 working sets. Correctives are already minimal, so they're left alone.
  const MIN_SETS = 2;
  while (total() > budgetMinutes) {
    const candidates = lifts.filter(
      (l) => l.category !== "mobility" && l.sets > MIN_SETS,
    );
    if (candidates.length === 0) break; // genuinely irreducible — ship it
    const worst = candidates.reduce((a, b) =>
      b.estimatedMinutes > a.estimatedMinutes ? b : a,
    );
    worst.sets -= 1;
    worst.estimatedMinutes = estimateLiftMinutes(worst.sets, worst.restSecondsHigh);
  }
}
