// Mid-workout swap support (PRD §6.5). Building a swapped-in lift is a pure library
// + history operation — NO AI generation call, so it's instant and works offline.

import type { Repository } from "../db/repo";
import type { Exercise, ProgramLift, PRReference } from "../domain/types";
import {
  estimateLiftMinutes,
  isLoadable,
  repBucketFor,
  restDefaultsFor,
} from "../domain/heuristics";
import {
  formatWeight,
  nextTargetKg,
  resolveUnits,
  type UnitsPreference,
} from "../domain/units";

export interface SwapTemplate {
  sets: number;
  repLow: number;
  repHigh: number;
}

// Rebuild a full ProgramLift for the replacement exercise, keeping the original
// slot's set/rep template and attaching authoritative last-time/PR (PRD §6.2, §6.5).
export async function buildSwapLift(
  repo: Repository,
  userId: string,
  exercise: Exercise,
  template: SwapTemplate,
  unitsPref?: UnitsPreference,
): Promise<ProgramLift> {
  const units = resolveUnits(unitsPref);
  const [lastTime, currentPRs] = await Promise.all([
    repo.lastTimeFor(userId, exercise.id),
    repo.listPRs(userId, { onlyCurrent: true }),
  ]);

  const rest = restDefaultsFor(exercise.category);
  const midReps = Math.round((template.repLow + template.repHigh) / 2);
  const bucket = repBucketFor(midReps);
  const bucketPR = currentPRs.find(
    (p) => p.exerciseId === exercise.id && p.repBucket === bucket,
  );
  const pr: PRReference | null = bucketPR
    ? {
        weight: bucketPR.weight,
        reps: bucketPR.reps,
        repBucket: bucketPR.repBucket,
        date: bucketPR.dateAchieved,
      }
    : null;

  let weightTarget: number | null = null;
  let rationale: string;
  if (!isLoadable(exercise.equipment)) {
    const noun = exercise.equipment === "bodyweight" ? "bodyweight" : "no added load";
    rationale = `Swapped in — ${noun}, ${template.repLow}–${template.repHigh} clean reps.`;
  } else if (lastTime) {
    // last-time is canonical kg; step up by a clean unit-appropriate increment.
    weightTarget = nextTargetKg(lastTime.weight, units);
    rationale = `Swapped in. Last time: ${lastTime.sets}×${lastTime.reps} @ ${formatWeight(lastTime.weight, units)} — step up to ${formatWeight(weightTarget, units)}.`;
  } else {
    rationale = `Swapped in — no history yet, pick a controlled working weight. The app tracks it from here.`;
  }

  return {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    category: exercise.category,
    muscleGroups: exercise.muscleGroups,
    equipment: exercise.equipment,
    sets: template.sets,
    repLow: template.repLow,
    repHigh: template.repHigh,
    weightTarget,
    restSecondsLow: rest.low,
    restSecondsHigh: rest.high,
    rationale,
    cues: exercise.defaultCues.slice(0, 3),
    lastTime,
    pr,
    estimatedMinutes: estimateLiftMinutes(template.sets, rest.high),
  };
}

// Rank same-pattern alternatives for the swap picker: most muscle-group overlap +
// same category first (PRD §6.5). Caller supplies the already-eligible library
// (exclusions + equipment already filtered).
export function rankAlternatives(
  original: { exerciseId: string; category: string; muscleGroups: string[] },
  library: Exercise[],
): Exercise[] {
  return library
    .filter((ex) => ex.id !== original.exerciseId)
    .map((ex) => {
      const overlap = ex.muscleGroups.filter((m) =>
        original.muscleGroups.includes(m),
      ).length;
      const sameCat = ex.category === original.category ? 1 : 0;
      return { ex, score: overlap * 2 + sameCat };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name))
    .map((x) => x.ex);
}
