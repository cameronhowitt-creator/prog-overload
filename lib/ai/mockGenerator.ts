// Deterministic program generator — no API key required. Applies the real domain
// heuristics (session structure, phase rep-ranges, progression off the last logged
// set, corrective rotation) so the app is fully functional without Claude, and so
// the live generator has a correct reference implementation to match (PRD §6.2, §7).

import type {
  Exercise,
  MovementCategory,
  PlanIntensity,
  PlannedDay,
} from "../domain/types";
import {
  DEFAULT_SESSION_MINUTES,
  estimateLiftMinutes,
  isLoadable,
  liftingBudgetMinutes,
  repRangeFor,
  restDefaultsFor,
} from "../domain/heuristics";
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

// Build slots that drive a planned day's emphasis, so the deterministic generator
// respects the block instead of rotating through its own split. Structure matches
// the FOCUSES templates: primary -> two secondaries -> optional accessory -> core
// -> corrective.
function focusForPlannedDay(day: PlannedDay): { name: string; slots: Slot[] } {
  const groups = day.emphasis.length ? day.emphasis : undefined;
  return {
    name: day.focus,
    slots: [
      { categories: ["primary"], muscleGroups: groups, preferCore: true },
      { categories: ["secondary"], muscleGroups: groups },
      { categories: ["secondary", "accessory"], muscleGroups: groups },
      { categories: ["accessory"], muscleGroups: groups, optional: true },
      { categories: ["core"] },
      { categories: ["mobility"] },
    ],
  };
}

// A light day sheds a set per lift; a hard day earns one on the primary.
function intensityAdjustedSets(
  base: number,
  category: Exercise["category"],
  intensity: PlanIntensity | undefined,
): number {
  if (intensity === "light") return Math.max(2, base - 1);
  if (intensity === "hard" && category === "primary") return base + 1;
  return base;
}

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

  if (!isLoadable(ex.equipment)) {
    if (ex.category === "mobility") {
      return {
        weightTarget: null,
        rationale: `Corrective work — ${reps.low}–${reps.high} controlled reps per side, quality over load.`,
      };
    }
    // Band/ab-wheel style work isn't "bodyweight" — don't call it that.
    const noun = ex.equipment === "bodyweight" ? "bodyweight" : "no added load";
    if (last) {
      return {
        weightTarget: null,
        rationale: `Last time: ${last.sets}×${last.reps} at ${noun}. Aim to add a rep or two toward the top of the range.`,
      };
    }
    return {
      weightTarget: null,
      rationale: `Progress by reps — work in the ${reps.low}–${reps.high} range at ${noun} with clean form.`,
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
    // A planned day dictates what this session covers; without one, fall back to
    // the date-rotated split.
    const focus = ctx.plannedDay
      ? focusForPlannedDay(ctx.plannedDay)
      : FOCUSES[dayIndex(ctx.date) % FOCUSES.length];
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
      // Correctives and core work ROTATE: avoid ones programmed recently (PRD
      // §6.2). Without this the core slot would pick the same exercise forever —
      // every history-less candidate scores the same and ties break on name.
      const rotates =
        slot.categories.includes("mobility") || slot.categories.includes("core");
      if (rotates) {
        const recent = slot.categories.includes("mobility")
          ? ctx.recentCorrectiveIds
          : ctx.recentCoreIds;
        const fresh = pool.filter((ex) => !recent.includes(ex.id));
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
        sets: intensityAdjustedSets(
          setsFor(chosen.category),
          chosen.category,
          ctx.plannedDay?.intensity,
        ),
        repLow: reps.low,
        repHigh: reps.high,
        weightTarget,
        rationale,
      });
    }

    const categoryById = new Map(eligible.map((e) => [e.id, e.category]));
    trimToTarget(selections, ctx, focus.slots, (id) => categoryById.get(id));

    const contextNote = ctx.activeOverride
      ? `Adjusted for: ${ctx.activeOverride.context}`
      : ctx.plannedDay
        ? `${ctx.plannedDay.focus} · ${ctx.plannedDay.intensity} day`
        : null;

    return {
      phase: ctx.phase,
      selections,
      contextNote,
    };
  }
}

// Drop optional slots (from the end) until the estimate fits the lifting budget —
// the session length MINUS the warm-up and the 10-min real-world buffer, not the
// raw session length. Uses the same estimateLiftMinutes that assembleProgram and
// the displayed per-lift minutes use, so both generators size sessions alike.
function trimToTarget(
  selections: LiftSelection[],
  ctx: GenerationContext,
  slots: Slot[],
  categoryOf: (exerciseId: string) => MovementCategory | undefined,
) {
  // Map each selection back to the slot it filled. Slots with no eligible
  // candidate are skipped entirely, so index-to-index alignment is not safe —
  // walk both in order instead.
  const optional = new Set<string>();
  let si = 0;
  for (const slot of slots) {
    const sel = selections[si];
    if (!sel) break;
    const cat = categoryOf(sel.exerciseId);
    if (cat && slot.categories.includes(cat)) {
      if (slot.optional) optional.add(sel.exerciseId);
      si++;
    }
  }

  const budget = liftingBudgetMinutes(
    ctx.profile.sessionDurationMinutes ?? DEFAULT_SESSION_MINUTES,
  );
  const estimate = () =>
    selections.reduce((sum, s) => {
      const cat = categoryOf(s.exerciseId);
      const rest = restDefaultsFor(cat ?? "accessory");
      return sum + estimateLiftMinutes(s.sets, rest.high);
    }, 0);

  for (let i = selections.length - 1; i >= 0 && estimate() > budget; i--) {
    if (optional.has(selections[i].exerciseId)) selections.splice(i, 1);
  }
}
