// Deterministic 4-week plan generator — no API key required. Mirrors
// mockGenerator.ts: it applies the real programming rules so the app is fully
// functional without Claude, AND gives the live generator a reference
// implementation to match.
//
// The rule that matters most here: a week must never repeat a session. Templates
// are dealt round-robin from a rotating start offset, so a 3-day week gets three
// different sessions and week 2 doesn't open with the same one week 1 did.

import type { Exercise, PlanIntensity } from "../domain/types";
import type {
  PlanAdaptContext,
  PlanAdaptResult,
  PlanContext,
  PlanDayDraft,
  PlanGenerator,
  PlanOutlineResult,
  PlanSlot,
  PlanWeekDraft,
} from "./planTypes";

type Template = {
  focus: string;
  emphasis: string[];
  // Movement pattern this day owns, so consecutive days don't collide.
  pattern: "squat" | "hinge" | "h-push" | "h-pull" | "v-push" | "v-pull" | "full";
};

// Ordered so that dealing them sequentially already alternates lower/upper and
// push/pull — the round-robin gets variety for free.
const TEMPLATES: Template[] = [
  { focus: "Lower body — squat emphasis", emphasis: ["quads", "glutes"], pattern: "squat" },
  { focus: "Upper body — horizontal push/pull", emphasis: ["chest", "back"], pattern: "h-push" },
  { focus: "Posterior chain — hinge emphasis", emphasis: ["hamstrings", "glutes", "back"], pattern: "hinge" },
  { focus: "Upper body — vertical push/pull", emphasis: ["shoulders", "back"], pattern: "v-pull" },
  { focus: "Full body — power & carries", emphasis: ["quads", "back", "shoulders"], pattern: "full" },
  { focus: "Arms, core & conditioning", emphasis: ["biceps", "triceps", "abs"], pattern: "h-pull" },
];

const INTENSITY_CYCLE: PlanIntensity[] = ["hard", "moderate", "moderate", "light"];

function stepDown(i: PlanIntensity): PlanIntensity {
  if (i === "hard") return "moderate";
  if (i === "moderate") return "light";
  return "light";
}

// Best candidate lifts for a template from the eligible library: prefer exercises
// whose muscle groups overlap the emphasis, core lifts first for trackability.
function candidatesFor(t: Template, library: Exercise[]): string[] {
  return library
    .filter((e) => e.category !== "mobility")
    .map((e) => ({
      e,
      score:
        e.muscleGroups.filter((m) => t.emphasis.includes(m)).length * 2 +
        (e.isCoreLift ? 1 : 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name))
    .slice(0, 6)
    .map((x) => x.e.id);
}

export class MockPlanGenerator implements PlanGenerator {
  readonly kind = "mock" as const;

  async generatePlan(ctx: PlanContext): Promise<PlanOutlineResult> {
    const byWeek = new Map<number, PlanSlot[]>();
    for (const s of ctx.slots) {
      const arr = byWeek.get(s.weekIndex);
      if (arr) arr.push(s);
      else byWeek.set(s.weekIndex, [s]);
    }

    const lastWeek = ctx.weeks - 1;
    const weeks: PlanWeekDraft[] = [];

    for (const [weekIndex, slots] of [...byWeek.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      const deload = weekIndex === lastWeek;
      const days: PlanDayDraft[] = slots.map((slot, i) => {
        // Rotate the starting template each week so weeks don't look identical,
        // while staying distinct WITHIN a week (i increments across the week).
        const t = TEMPLATES[(weekIndex + i) % TEMPLATES.length];
        let intensity = INTENSITY_CYCLE[i % INTENSITY_CYCLE.length];
        if (deload) intensity = stepDown(intensity);

        return {
          key: slot.key,
          focus: t.focus,
          emphasis: t.emphasis,
          intensity,
          candidateExerciseIds: candidatesFor(t, ctx.library),
          note: deload
            ? "Deload week — same movements, backed-off load and volume."
            : null,
        };
      });

      weeks.push({
        weekIndex,
        intent: deload
          ? "Deload — recover and consolidate"
          : weekIndex === 0
            ? "Base — establish loads"
            : "Accumulation — add volume",
        days,
      });
    }

    const perWeek = byWeek.get(0)?.length ?? 0;
    return {
      summary: `${ctx.weeks}-week block, ${perWeek} sessions a week, rotating through squat, hinge, push and pull emphases with a deload in week ${ctx.weeks}.`,
      weeks,
    };
  }

  // Deterministic fallback adaptation: a genuinely hard session eases the very
  // next training day. Deliberately conservative — it only touches one day,
  // because without a model reading the notes we can't justify more.
  async adaptPlan(ctx: PlanAdaptContext): Promise<PlanAdaptResult> {
    const { effort } = ctx.completed;
    if (effort < 8 || ctx.remaining.length === 0) {
      return { revisions: [], summary: null };
    }

    const next = ctx.remaining[0];
    const eased = stepDown(next.intensity);
    // Shift emphasis off whatever was just hammered so the next day isn't more
    // of the same.
    const overlap = next.emphasis.filter((m) =>
      ctx.completed.focus.toLowerCase().includes(m),
    );
    const emphasis =
      overlap.length > 0 && next.emphasis.length > overlap.length
        ? next.emphasis.filter((m) => !overlap.includes(m))
        : next.emphasis;

    return {
      revisions: [
        {
          id: next.id,
          focus: next.focus,
          emphasis,
          intensity: eased,
          note: `Eased back after a ${effort}/10 effort session on ${ctx.completed.date}.`,
        },
      ],
      summary: `Pulled the next session back to ${eased} to let you recover.`,
    };
  }
}
