// Assembles the full generation context from the persistent store (PRD §6.2).
// This is the whole point of the app: context comes from a durable backend, not a
// recycling chat memory (PRD §2, §8).

import type { Repository } from "../db/repo";
import type { TrainingPhase } from "../domain/types";
import type { ExerciseHistory, GenerationContext } from "./types";

export async function buildGenerationContext(
  repo: Repository,
  userId: string,
  date: string,
  phase: TrainingPhase = "hypertrophy",
): Promise<GenerationContext> {
  const [profile, exclusions, activeOverride, library, recentSessions] =
    await Promise.all([
      repo.getProfile(userId),
      repo.listExclusions(userId),
      repo.getActiveOverride(userId, date),
      repo.listExercises(),
      repo.listRecentSessions(userId, 4),
    ]);

  // Per-exercise history: last logged occurrence + current PRs across buckets.
  const allPRs = await repo.listPRs(userId, { onlyCurrent: true });
  const history: Record<string, ExerciseHistory> = {};
  await Promise.all(
    library.map(async (ex) => {
      const lastTime = await repo.lastTimeFor(userId, ex.id);
      history[ex.id] = {
        lastTime,
        currentPRs: allPRs.filter((p) => p.exerciseId === ex.id),
      };
    }),
  );

  // Correctives programmed recently, so rotation avoids immediate repeats.
  const recentCorrectiveIds = recentSessions
    .flatMap((s) => s.program.lifts)
    .filter((l) => l.category === "mobility")
    .map((l) => l.exerciseId);

  return {
    userId,
    date,
    profile,
    exclusions,
    activeOverride,
    library,
    phase,
    history,
    recentCorrectiveIds,
  };
}

// Which library exercises are eligible: not excluded, and (if a temporary override
// restricts equipment) equipment-compatible. Free-text override is keyword-scanned
// for equipment terms — bodyweight is always allowed (PRD §6.1, §6.5).
export function eligibleExercises(ctx: GenerationContext) {
  const excludedIds = new Set(
    ctx.exclusions.map((e) => e.exerciseId).filter(Boolean) as string[],
  );
  const excludedNames = new Set(
    ctx.exclusions.map((e) => e.exerciseName.toLowerCase()),
  );

  const allowed = allowedEquipment(ctx.activeOverride?.context ?? null);

  return ctx.library.filter((ex) => {
    if (excludedIds.has(ex.id)) return false;
    if (excludedNames.has(ex.name.toLowerCase())) return false;
    if (allowed && ex.equipment !== "bodyweight" && !allowed.has(ex.equipment)) {
      return false;
    }
    return true;
  });
}

const EQUIPMENT_KEYWORDS: Record<string, string[]> = {
  dumbbell: ["dumbbell", "dumbbells", "db"],
  barbell: ["barbell", "barbells"],
  machine: ["machine", "machines", "selectorized"],
  cable: ["cable", "cables"],
  kettlebell: ["kettlebell", "kettlebells", "kb"],
  bands: ["band", "bands", "resistance band"],
  "trap-bar": ["trap bar", "trap-bar", "hex bar"],
};

// Returns the set of allowed equipment if the override text names specific gear,
// otherwise null (no restriction).
export function allowedEquipment(overrideText: string | null): Set<string> | null {
  if (!overrideText) return null;
  const text = overrideText.toLowerCase();
  const found = new Set<string>();
  for (const [equip, words] of Object.entries(EQUIPMENT_KEYWORDS)) {
    if (words.some((w) => text.includes(w))) found.add(equip);
  }
  return found.size > 0 ? found : null;
}
