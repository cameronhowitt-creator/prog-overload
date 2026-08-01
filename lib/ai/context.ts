// Assembles the full generation context from the persistent store (PRD §6.2).
// This is the whole point of the app: context comes from a durable backend, not a
// recycling chat memory (PRD §2, §8).

import type { Repository } from "../db/repo";
import type { PlannedDay, TrainingPhase } from "../domain/types";
import type { ExerciseHistory, GenerationContext } from "./types";

export async function buildGenerationContext(
  repo: Repository,
  userId: string,
  date: string,
  phase: TrainingPhase = "hypertrophy",
  plannedDay: PlannedDay | null = null,
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

  // Correctives and core work programmed recently, so both rotations avoid
  // immediate repeats.
  const recentLifts = recentSessions.flatMap((s) => s.program.lifts);
  const recentCorrectiveIds = recentLifts
    .filter((l) => l.category === "mobility")
    .map((l) => l.exerciseId);
  const recentCoreIds = recentLifts
    .filter((l) => l.category === "core")
    .map((l) => l.exerciseId);

  // How the last few sessions actually felt — newest first. A session after a
  // 9/10 grinder should not be blindly progressed.
  const recentFeedback = recentSessions
    .filter((s) => s.date < date && s.feedback)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .map((s) => s.feedback!);

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
    recentCoreIds,
    plannedDay,
    recentFeedback,
  };
}

// Onboarding asks only which MAIN lifts the user trains, so only "primary" is
// gated by the active-lift list. Secondary, accessory, core and mobility work is
// programmed supplementally around those choices — gating them too would filter
// out everything the user was never asked about.
const GATED_CATEGORIES = new Set(["primary"]);

// Which library exercises are eligible: not excluded, equipment-compatible (if a
// temporary override restricts equipment), and — once the user has onboarded — a
// PRIMARY lift only if it's in their active-lift list. Empty active list means
// unrestricted (legacy / pre-onboarding). Free-text override is keyword-scanned
// for equipment terms; bodyweight is always allowed (PRD §6.1, §6.5, onboarding).
// Takes only the fields it actually needs, so the plan layer (which has no full
// GenerationContext) can reuse it rather than duplicating the filter.
export type EligibilityContext = Pick<
  GenerationContext,
  "profile" | "exclusions" | "activeOverride" | "library"
>;

export function eligibleExercises(ctx: EligibilityContext) {
  const excludedIds = new Set(
    ctx.exclusions.map((e) => e.exerciseId).filter(Boolean) as string[],
  );
  const excludedNames = new Set(
    ctx.exclusions.map((e) => e.exerciseName.toLowerCase()),
  );

  // A temporary override takes precedence over the profile's standing equipment
  // access (e.g. hotel this week overrides "full gym"); otherwise the profile
  // equipmentAccess (from onboarding) constrains what can be prescribed.
  const overrideAllowed = allowedEquipment(ctx.activeOverride?.context ?? null);
  const allowed = overrideAllowed ?? equipmentForAccess(ctx.profile.equipmentAccess);
  const active = ctx.profile.userActiveLifts ?? [];
  const restrictToActive = active.length > 0;
  const activeSet = new Set(active);

  return ctx.library.filter((ex) => {
    if (excludedIds.has(ex.id)) return false;
    if (excludedNames.has(ex.name.toLowerCase())) return false;
    if (allowed && ex.equipment !== "bodyweight" && !allowed.has(ex.equipment)) {
      return false;
    }
    if (
      restrictToActive &&
      GATED_CATEGORIES.has(ex.category) &&
      !activeSet.has(ex.id)
    ) {
      return false;
    }
    return true;
  });
}

// Which equipment the profile's standing access supports (PRD §6.6). null = all.
export function equipmentForAccess(
  access: import("../domain/types").EquipmentAccess | undefined,
): Set<string> | null {
  switch (access) {
    case "home_gym":
      return new Set(["barbell", "dumbbell", "kettlebell", "bands", "trap-bar", "bodyweight"]);
    case "limited_dumbbells":
      return new Set(["dumbbell", "kettlebell", "bands", "bodyweight"]);
    case "bodyweight":
      return new Set(["bodyweight"]);
    case "full_gym":
    default:
      return null; // everything
  }
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
