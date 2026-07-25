// Shared enrichment: turn a generator's lightweight selections into a full Program,
// attaching AUTHORITATIVE reference data (last-time, PR) from our own store so the
// numbers Emma sees mid-set are always real, never model-hallucinated (PRD §6.2, §12).

import {
  DEFAULT_SESSION_MINUTES,
  DEFAULT_WARMUP_MINUTES,
  estimateLiftMinutes,
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

  const liftMinutes = lifts.reduce((sum, l) => sum + l.estimatedMinutes, 0);
  const warmupMinutes = DEFAULT_WARMUP_MINUTES;

  return {
    phase: result.phase,
    warmupMinutes,
    targetMinutes: ctx.profile.sessionDurationMinutes ?? DEFAULT_SESSION_MINUTES,
    estimatedMinutes: warmupMinutes + liftMinutes,
    lifts,
    contextNote: result.contextNote,
  };
}
