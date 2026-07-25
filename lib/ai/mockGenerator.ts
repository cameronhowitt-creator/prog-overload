// Deterministic program generator — no API key required. Applies the real domain
// heuristics (session structure, phase rep-ranges, progression off the last logged
// set, corrective rotation) so the app is fully functional without Claude, and so
// the live generator has a correct reference implementation to match (PRD §6.2, §7).

import type { Exercise } from "../domain/types";
import { DEFAULT_SESSION_MINUTES, repRangeFor } from "../domain/heuristics";
import { formatWeight, nextTargetKg, resolveUnits } from "../domain/units";
import { eligibleExercises } from "./context";
import type {
  GenerationContext,
  GeneratorResult,
  LiftSelection,
  ProgramGenerator,
} from "./types";

// Rotating day focuses simulate a 4–5x/week split while keeping core lifts stable
// per slot so "last time" lines up for progression (PRD §5, §6.2).
type Slot = {
  categories: Exercise["category"][];
  muscleGroups?: string[];
  preferCore?: boolean;
  optional?: boolean; // trimmed first if the session runs long
};

const FOCUSES: { name: string; slots: Slot[] }[] = [
  {
    name: "Lower body",
    slots: [
      { categories: ["primary"], muscleGroups: ["quads", "hamstrings", "glutes"], preferCore: true },
      { categories: ["secondary"], muscleGroups: ["hamstrings", "glutes"] },
      { categories: ["secondary"], muscleGroups: ["quads", "glutes"] },
      { categories: ["accessory"], muscleGroups: ["hamstrings", "quads", "calves"], optional: true },
      { categories: ["core"] },
      { categories: ["mobility"] },
    ],
  },
  {
    name: "Upper body",
    slots: [
      { categories: ["primary"], muscleGroups: ["back", "chest", "shoulders"], preferCore: true },
      { categories: ["secondary"], muscleGroups: ["back"] },
      { categories: ["secondary"], muscleGroups: ["chest", "shoulders"] },
      { categories: ["accessory"], muscleGroups: ["biceps", "triceps", "shoulders"], optional: true },
      { categories: ["core"] },
      { categories: ["mobility"] },
    ],
  },
  {
    name: "Full body",
    slots: [
      { categories: ["primary"], muscleGroups: ["quads", "glutes"], preferCore: true },
      { categories: ["secondary"], muscleGroups: ["back"] },
      { categories: ["secondary"], muscleGroups: ["chest", "shoulders"] },
      { categories: ["accessory"], muscleGroups: ["biceps", "triceps"], optional: true },
      { categories: ["core"] },
      { categories: ["mobility"] },
    ],
  },
];

function dayIndex(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function overlaps(a: string[], b?: string[]): boolean {
  if (!b || b.length === 0) return true;
  return a.some((x) => b.includes(x));
}

// Score a candidate for a slot: history enables progression (most valuable),
// core lifts are preferred for the primary slot, name is a deterministic tiebreak.
function scoreCandidate(
  ex: Exercise,
  slot: Slot,
  ctx: GenerationContext,
): number {
  let score = 10;
  if (ctx.history[ex.id]?.lastTime) score += 100;
  if (slot.preferCore && ex.isCoreLift) score += 40;
  return score;
}

function setsFor(category: Exercise["category"]): number {
  switch (category) {
    case "primary":
      return 4;
    case "secondary":
      return 3;
    case "accessory":
      return 3;
    case "core":
      return 3;
    case "mobility":
      return 2;
  }
}

function repsFor(
  category: Exercise["category"],
  phaseRange: { low: number; high: number },
): { low: number; high: number } {
  if (category === "core") return { low: 10, high: 15 };
  if (category === "mobility") return { low: 8, high: 12 };
  return phaseRange;
}

// Progression off the last logged set — the whole point (PRD §2, §6.2).
function prescribe(
  ex: Exercise,
  ctx: GenerationContext,
  reps: { low: number; high: number },
): { weightTarget: number | null; rationale: string } {
  const last = ctx.history[ex.id]?.lastTime ?? null;
  const isLoadable = ex.equipment !== "bodyweight";

  if (!isLoadable) {
    if (ex.category === "mobility") {
      return {
        weightTarget: null,
        rationale: `Corrective work — ${reps.low}–${reps.high} controlled reps per side, quality over load.`,
      };
    }
    if (last) {
      return {
        weightTarget: null,
        rationale: `Last time: ${last.sets}×${last.reps} bodyweight. Aim to add a rep or two toward the top of the range.`,
      };
    }
    return {
      weightTarget: null,
      rationale: `Bodyweight — work in the ${reps.low}–${reps.high} rep range with clean form.`,
    };
  }

  if (last) {
    // last.weight is canonical kg; progress by a clean step in the user's unit
    // (+5 lb / +2.5 kg) and render the rationale in that unit (PRD §6.6).
    const units = resolveUnits(ctx.profile.unitsPreference);
    const targetKg = nextTargetKg(last.weight, units);
    return {
      weightTarget: targetKg,
      rationale: `Last time: ${last.sets}×${last.reps} @ ${formatWeight(last.weight, units)}. Small step up to ${formatWeight(targetKg, units)} today.`,
    };
  }

  // No history yet — the ONLY acceptable "pick a weight" moment (before any log
  // exists). Everything after this session is history-driven (PRD §6.2, §7).
  return {
    weightTarget: null,
    rationale: `First logged session for this lift — pick a weight you can control for all reps. The app progresses it from here.`,
  };
}

export class MockGenerator implements ProgramGenerator {
  readonly kind = "mock" as const;

  async generate(ctx: GenerationContext): Promise<GeneratorResult> {
    const eligible = eligibleExercises(ctx);
    const focus = FOCUSES[dayIndex(ctx.date) % FOCUSES.length];
    const phaseRange = repRangeFor(ctx.phase);

    const usedIds = new Set<string>();
    const selections: LiftSelection[] = [];

    for (const slot of focus.slots) {
      // Candidate pool for this slot.
      let pool = eligible.filter(
        (ex) =>
          !usedIds.has(ex.id) &&
          slot.categories.includes(ex.category) &&
          overlaps(ex.muscleGroups, slot.muscleGroups),
      );
      // Relax the muscle-group filter if nothing matched.
      if (pool.length === 0) {
        pool = eligible.filter(
          (ex) => !usedIds.has(ex.id) && slot.categories.includes(ex.category),
        );
      }
      if (pool.length === 0) continue;

      let chosen: Exercise;
      if (slot.categories.includes("mobility")) {
        // Correctives ROTATE: avoid ones programmed recently (PRD §6.2).
        const fresh = pool.filter(
          (ex) => !ctx.recentCorrectiveIds.includes(ex.id),
        );
        const rotationPool = fresh.length ? fresh : pool;
        chosen = rotationPool[dayIndex(ctx.date) % rotationPool.length];
      } else {
        chosen = [...pool].sort((a, b) => {
          const s = scoreCandidate(b, slot, ctx) - scoreCandidate(a, slot, ctx);
          return s !== 0 ? s : a.name.localeCompare(b.name);
        })[0];
      }

      usedIds.add(chosen.id);
      const reps = repsFor(chosen.category, phaseRange);
      const { weightTarget, rationale } = prescribe(chosen, ctx, reps);
      selections.push({
        exerciseId: chosen.id,
        sets: setsFor(chosen.category),
        repLow: reps.low,
        repHigh: reps.high,
        weightTarget,
        rationale,
      });
    }

    trimToTarget(selections, ctx, focus.slots);

    const overrideNote = ctx.activeOverride
      ? `Adjusted for: ${ctx.activeOverride.context}`
      : null;

    return {
      phase: ctx.phase,
      selections,
      contextNote: overrideNote,
    };
  }
}

// Drop optional slots (from the end) until the estimate fits the session window.
function trimToTarget(
  selections: LiftSelection[],
  ctx: GenerationContext,
  slots: Slot[],
) {
  const optionalExerciseIndexes = new Set<number>();
  // Map selections back to slots by order to find which were optional.
  slots.forEach((slot, i) => {
    if (slot.optional && selections[i]) optionalExerciseIndexes.add(i);
  });
  // Rough estimate: warm-up + ~ (sets * 1.5 min) per lift.
  const target = ctx.profile.sessionDurationMinutes ?? DEFAULT_SESSION_MINUTES;
  const estimate = () =>
    8 + selections.reduce((sum, s) => sum + s.sets * 1.5, 0);

  // Remove optional lifts from the end while over target.
  for (let i = selections.length - 1; i >= 0 && estimate() > target; i--) {
    if (optionalExerciseIndexes.has(i)) {
      selections.splice(i, 1);
    }
  }
}
