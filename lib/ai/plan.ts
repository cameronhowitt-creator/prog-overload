// Training-plan entry points: build a 4-week block, and adapt what's left of it
// when a session comes back high-strain.
//
// Same contract as generateProgram in ./index.ts — the live generator is used when
// a key is configured, and any failure falls back to the deterministic one so
// planning never hard-fails. Dates and stable ids are assigned HERE, not by the
// model, so a hallucinated date can't land in the calendar.

import { randomUUID } from "node:crypto";

import type { Repository } from "../db/repo";
import { addDays, planDates } from "../domain/dates";
import type {
  PlannedDay,
  PlanOutline,
  Session,
  TrainingPlan,
  Weekday,
} from "../domain/types";
import { AnthropicPlanGenerator } from "./anthropicPlanGenerator";
import { eligibleExercises } from "./context";
import { MockPlanGenerator } from "./mockPlanGenerator";
import type {
  PlanAdaptContext,
  PlanContext,
  PlanGenerator,
  PlanOutlineResult,
  PlanSlot,
} from "./planTypes";

export const PLAN_WEEKS = 4;

// Fallback when the user hasn't picked days yet (legacy profiles): Mon/Wed/Fri.
const DEFAULT_DAYS: Weekday[] = [1, 3, 5];

export function selectPlanGenerator(): PlanGenerator {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key && key.trim()) {
    const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5";
    return new AnthropicPlanGenerator(key.trim(), model);
  }
  return new MockPlanGenerator();
}

export function preferredDaysFor(days: Weekday[] | undefined): Weekday[] {
  return days && days.length > 0 ? days : DEFAULT_DAYS;
}

// ── Generation ───────────────────────────────────────────────────────────────

export interface GeneratePlanResult {
  plan: TrainingPlan;
  generatorKind: "mock" | "anthropic";
  usedFallback: boolean;
}

export async function generateTrainingPlan(
  repo: Repository,
  userId: string,
  startISO: string,
  weeks: number = PLAN_WEEKS,
): Promise<GeneratePlanResult> {
  const [profile, exclusions, library] = await Promise.all([
    repo.getProfile(userId),
    repo.listExclusions(userId),
    repo.listExercises(),
  ]);

  const days = preferredDaysFor(profile.preferredWorkoutDays);
  const laid = planDates(startISO, days, weeks);
  const slots: PlanSlot[] = laid.map((d) => ({
    key: `w${d.weekIndex}-d${d.weekday}`,
    weekIndex: d.weekIndex,
    weekday: d.weekday,
    date: d.date,
  }));

  // Same eligibility filter the session generators use — exclusions, equipment
  // access, active-lift restriction. No temporary override at block level: a
  // hotel week shouldn't reshape a 4-week plan.
  const eligible = eligibleExercises({
    profile,
    exclusions,
    activeOverride: null,
    library,
  });

  const ctx: PlanContext = {
    userId,
    startsOn: startISO,
    weeks,
    profile,
    exclusions,
    library: eligible,
    slots,
  };

  const generator = selectPlanGenerator();
  let outlineResult: PlanOutlineResult;
  let generatorKind = generator.kind;
  let usedFallback = false;

  try {
    outlineResult = await generator.generatePlan(ctx);
  } catch (err) {
    if (generator.kind === "mock") throw err;
    console.error("Live plan generation failed, falling back to mock:", err);
    outlineResult = await new MockPlanGenerator().generatePlan(ctx);
    generatorKind = "mock";
    usedFallback = true;
  }

  const outline = assemblePlanOutline(outlineResult, slots, ctx);
  // If the model dropped slots, the block would have holes — fill them
  // deterministically rather than shipping a plan with missing days.
  const covered = new Set(
    outline.weeks.flatMap((w) => w.days.map((d) => `w${d.weekIndex}-d${d.weekday}`)),
  );
  if (covered.size < slots.length) {
    const filler = assemblePlanOutline(
      await new MockPlanGenerator().generatePlan(ctx),
      slots.filter((s) => !covered.has(s.key)),
      ctx,
    );
    mergeOutlines(outline, filler);
  }

  const endsOn = slots.length
    ? slots[slots.length - 1].date
    : addDays(startISO, weeks * 7 - 1);

  const now = new Date().toISOString();
  const plan: TrainingPlan = {
    id: randomUUID(),
    userId,
    startsOn: startISO,
    endsOn,
    weeks,
    status: "active",
    outline,
    createdAt: now,
    updatedAt: now,
  };

  return { plan: await repo.savePlan(plan), generatorKind, usedFallback };
}

// Turn a generator's keyed drafts into dated, id-stamped planned days. Slot keys
// the generator invented (or repeated) are dropped — dates come from us.
function assemblePlanOutline(
  result: PlanOutlineResult,
  slots: PlanSlot[],
  ctx: PlanContext,
): PlanOutline {
  const slotByKey = new Map(slots.map((s) => [s.key, s]));
  const validIds = new Set(ctx.library.map((e) => e.id));
  const used = new Set<string>();
  const byWeek = new Map<number, PlannedDay[]>();
  const intents = new Map<number, string>();

  for (const week of result.weeks ?? []) {
    for (const day of week.days ?? []) {
      const slot = slotByKey.get(day.key);
      if (!slot || used.has(day.key)) continue;
      used.add(day.key);
      intents.set(slot.weekIndex, week.intent);

      const planned: PlannedDay = {
        id: randomUUID(),
        date: slot.date,
        weekIndex: slot.weekIndex,
        weekday: slot.weekday,
        focus: day.focus,
        emphasis: day.emphasis ?? [],
        intensity: day.intensity,
        // Drop ids the model invented — a bad id would silently narrow the
        // session generator's candidate pool later.
        candidateExerciseIds: (day.candidateExerciseIds ?? []).filter((id) =>
          validIds.has(id),
        ),
        note: day.note ?? null,
      };
      const arr = byWeek.get(slot.weekIndex);
      if (arr) arr.push(planned);
      else byWeek.set(slot.weekIndex, [planned]);
    }
  }

  return {
    summary: result.summary ?? "",
    weeks: [...byWeek.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([weekIndex, days]) => ({
        weekIndex,
        intent: intents.get(weekIndex) ?? "",
        days: days.sort((a, b) => a.date.localeCompare(b.date)),
      })),
  };
}

function mergeOutlines(target: PlanOutline, extra: PlanOutline): void {
  for (const week of extra.weeks) {
    const existing = target.weeks.find((w) => w.weekIndex === week.weekIndex);
    if (existing) {
      existing.days.push(...week.days);
      existing.days.sort((a, b) => a.date.localeCompare(b.date));
    } else {
      target.weeks.push(week);
    }
  }
  target.weeks.sort((a, b) => a.weekIndex - b.weekIndex);
}

// ── Lookup helpers ───────────────────────────────────────────────────────────

export function allPlannedDays(plan: TrainingPlan): PlannedDay[] {
  return plan.outline.weeks.flatMap((w) => w.days);
}

export function plannedDayForDate(
  plan: TrainingPlan | null,
  dateISO: string,
): PlannedDay | null {
  if (!plan) return null;
  return allPlannedDays(plan).find((d) => d.date === dateISO) ?? null;
}

export function nextPlannedDayAfter(
  plan: TrainingPlan | null,
  dateISO: string,
): PlannedDay | null {
  if (!plan) return null;
  return (
    allPlannedDays(plan)
      .filter((d) => d.date > dateISO)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  );
}

// ── Adaptation ───────────────────────────────────────────────────────────────

export interface AdaptResult {
  changedDays: number;
  summary: string | null;
}

// Re-plan the days still ahead after a session is logged. Deliberately cheap:
// a routine session (moderate effort, nothing said, nothing skipped) makes no API
// call at all and returns immediately.
export async function adaptTrainingPlan(
  repo: Repository,
  userId: string,
  session: Session,
): Promise<AdaptResult> {
  const feedback = session.feedback;
  if (!feedback) return { changedDays: 0, summary: null };

  const skippedLifts = session.program.lifts
    .filter((l) => l.skipped)
    .map((l) => l.exerciseName);
  const notes = feedback.notes.trim();

  const worthAdapting = feedback.effort >= 7 || notes.length > 0 || skippedLifts.length > 0;
  if (!worthAdapting) return { changedDays: 0, summary: null };

  const plan = await repo.getActivePlan(userId);
  if (!plan) return { changedDays: 0, summary: null };

  const remaining = allPlannedDays(plan)
    .filter((d) => d.date > session.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (remaining.length === 0) return { changedDays: 0, summary: null };

  const [profile, recent] = await Promise.all([
    repo.getProfile(userId),
    repo.listRecentSessions(userId, 6),
  ]);

  const planned = plannedDayForDate(plan, session.date);
  const ctx: PlanAdaptContext = {
    profile,
    completed: {
      focus: planned?.focus ?? "Unplanned session",
      intensity: planned?.intensity ?? "moderate",
      date: session.date,
      effort: feedback.effort,
      notes,
      skippedLifts,
      loggedLifts: session.program.lifts
        .filter((l) => !l.skipped)
        .map((l) => l.exerciseName),
    },
    priorFeedback: recent
      .filter((s) => s.id !== session.id && s.feedback)
      .slice(0, 3)
      .map((s) => ({
        date: s.date,
        effort: s.feedback!.effort,
        notes: s.feedback!.notes,
      })),
    remaining,
  };

  const generator = selectPlanGenerator();
  let result;
  try {
    result = await generator.adaptPlan(ctx);
  } catch (err) {
    if (generator.kind === "mock") {
      console.error("Plan adaptation failed:", err);
      return { changedDays: 0, summary: null };
    }
    console.error("Live plan adaptation failed, falling back to mock:", err);
    result = await new MockPlanGenerator().adaptPlan(ctx);
  }

  if (result.revisions.length === 0) return { changedDays: 0, summary: null };

  // Apply only to days that are genuinely still ahead — a stale or hallucinated
  // id must never rewrite history.
  const editable = new Map(remaining.map((d) => [d.id, d]));
  const outline: PlanOutline = {
    summary: plan.outline.summary,
    weeks: plan.outline.weeks.map((w) => ({ ...w, days: [...w.days] })),
  };

  let changed = 0;
  for (const rev of result.revisions) {
    if (!editable.has(rev.id)) continue;
    for (const week of outline.weeks) {
      const i = week.days.findIndex((d) => d.id === rev.id);
      if (i === -1) continue;
      week.days[i] = {
        ...week.days[i],
        focus: rev.focus || week.days[i].focus,
        emphasis: rev.emphasis?.length ? rev.emphasis : week.days[i].emphasis,
        intensity: rev.intensity,
        note: rev.note,
        adapted: true,
      };
      changed++;
    }
  }

  if (changed === 0) return { changedDays: 0, summary: null };
  await repo.updatePlan(userId, plan.id, { outline });
  return { changedDays: changed, summary: result.summary };
}
