// Live 4-week plan generator + adapter via the Claude API. Same shape as
// anthropicGenerator.ts: forced tool calls for structured output, no parsing.
//
// This produces an OUTLINE only — focus, emphasis, intensity and candidate lifts
// per day. Full prescriptions are generated per session when the day is opened, so
// week-3 loads are never guessed before week 1 has been logged.

import Anthropic from "@anthropic-ai/sdk";

import { WEEKDAY_LONG } from "../domain/dates";
import type { Exercise } from "../domain/types";
import type {
  PlanAdaptContext,
  PlanAdaptResult,
  PlanContext,
  PlanDayRevision,
  PlanGenerator,
  PlanOutlineResult,
  PlanWeekDraft,
} from "./planTypes";

const PLAN_TOOL = "submit_plan";
const REVISE_TOOL = "submit_plan_revision";

const INTENSITY = {
  type: "string",
  enum: ["light", "moderate", "hard"],
} as const;

const planSchema = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "One or two sentences describing the block: what it builds and how it progresses.",
    },
    weeks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          weekIndex: { type: "integer", minimum: 0 },
          intent: {
            type: "string",
            description: "Short label, e.g. 'Base', 'Accumulation', 'Deload'.",
          },
          days: {
            type: "array",
            items: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Must be one of the slot keys given in the prompt.",
                },
                focus: {
                  type: "string",
                  description:
                    "Short session title, e.g. 'Lower body — squat emphasis'.",
                },
                emphasis: {
                  type: "array",
                  items: { type: "string" },
                  description: "Muscle groups this day drives, from the library tags.",
                },
                intensity: INTENSITY,
                candidateExerciseIds: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "3-6 exercise ids from the library that suit this day. Hints, not a final prescription.",
                },
                note: {
                  type: ["string", "null"],
                  description:
                    "Optional one-line reason this day is shaped the way it is.",
                },
              },
              required: [
                "key",
                "focus",
                "emphasis",
                "intensity",
                "candidateExerciseIds",
                "note",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["weekIndex", "intent", "days"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "weeks"],
  additionalProperties: false,
} as const;

const reviseSchema = {
  type: "object",
  properties: {
    summary: {
      type: ["string", "null"],
      description:
        "One sentence for the lifter explaining the adjustment, or null if nothing changed.",
    },
    revisions: {
      type: "array",
      description:
        "Only the days you are CHANGING. Return an empty array if the plan should stand as-is.",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "The planned day's id, verbatim." },
          focus: { type: "string" },
          emphasis: { type: "array", items: { type: "string" } },
          intensity: INTENSITY,
          note: {
            type: "string",
            description:
              "One plain sentence on why this day changed, addressed to the lifter.",
          },
        },
        required: ["id", "focus", "emphasis", "intensity", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "revisions"],
  additionalProperties: false,
} as const;

function libraryFor(library: Exercise[]) {
  // Outline-level: no history needed, so keep the payload small.
  return library.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    muscleGroups: e.muscleGroups,
    isCoreLift: !!e.isCoreLift,
  }));
}

function buildPlanPrompt(ctx: PlanContext): string {
  const p = ctx.profile;
  // Count from a FULL week — the block can start mid-week, leaving week 1 short.
  const counts = new Map<number, number>();
  for (const s of ctx.slots) counts.set(s.weekIndex, (counts.get(s.weekIndex) ?? 0) + 1);
  const perWeek = Math.max(...counts.values(), 0);
  const firstWeek = counts.get(0) ?? 0;
  const slotLines = ctx.slots.map(
    (s) =>
      `  ${s.key} — week ${s.weekIndex + 1}, ${WEEKDAY_LONG[s.weekday]} ${s.date}`,
  );

  return [
    `You are designing a ${ctx.weeks}-week training block for one lifter.`,
    `They train ${perWeek} day${perWeek === 1 ? "" : "s"} a week. Produce ONE session outline per slot below, using the slot key verbatim:`,
    ...slotLines,
    firstWeek > 0 && firstWeek < perWeek
      ? `Note: the block starts mid-week, so week 1 has only ${firstWeek} of their ${perWeek} usual days — the remaining days of that week have already passed. This is expected. Describe the lifter as training ${perWeek}x a week; do not remark on week 1 being short.`
      : null,
    ``,
    `Lifter profile:`,
    `- Primary goal: ${p.primaryGoal ?? "general strength"}. Experience: ${p.experienceLevel ?? "unknown"}.`,
    `- Session length: ${p.sessionDurationMinutes ?? 60} min end to end. Equipment: ${p.equipmentAccess ?? "full_gym"}.`,
    p.injuryFlags?.length
      ? `- INJURY flags: ${p.injuryFlags.join(", ")}. Do not build a day around loading these; spread the risk across the week.`
      : null,
    p.mobilityFlags?.length
      ? `- Mobility limitations: ${p.mobilityFlags.join(", ")}.`
      : null,
    p.typicalSleepHours != null || p.stressLevel || p.activityOutsideGym
      ? `- Recovery baseline: sleep ~${p.typicalSleepHours ?? "?"}h, stress ${p.stressLevel ?? "?"}, outside-gym activity ${p.activityOutsideGym ?? "?"}. If recovery looks compromised, use fewer hard days.`
      : null,
    p.cycleTrackingOptIn
      ? `- Menstrual-cycle-aware programming is opted in (cycle ~${p.cycleLengthDays ?? "?"} days). Bias the harder weeks accordingly.`
      : null,
    ``,
    `Rules — the block is judged on these:`,
    `- VARIETY IS MANDATORY. Within any single week, every day must have a DIFFERENT focus and a different primary emphasis. Never schedule the same session twice in one week. A week of near-identical days is a failed plan.`,
    `- Rotate movement patterns across each week: squat, hinge, horizontal push, horizontal pull, vertical push, vertical pull, carry/core. Cover the body over the week rather than repeating one region.`,
    `- Vary week to week as well — don't make week 2 a carbon copy of week 1. Shift emphases and exercise choices while keeping the lifter's core lifts recurring often enough to track progression.`,
    `- Never place two "hard" days back to back, and never load the same muscle group hard on consecutive training days. Check the dates above — consecutive calendar days matter, not just adjacent slots.`,
    `- Weeks 1 to ${ctx.weeks - 1} progress in difficulty. Week ${ctx.weeks} is a DELOAD: every day drops an intensity step and the week's intent says so.`,
    `- Only reference exercise ids that exist in the library below. Never suggest an excluded exercise.`,
    ``,
    `Excluded (never program): ${JSON.stringify(ctx.exclusions.map((e) => e.exerciseName))}.`,
    ``,
    `Exercise library (already filtered to this lifter's active lifts + equipment):`,
    JSON.stringify(libraryFor(ctx.library)),
    ``,
    `Call ${PLAN_TOOL} with the full block. Every slot key above must appear exactly once.`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function buildAdaptPrompt(ctx: PlanAdaptContext): string {
  const c = ctx.completed;
  return [
    `A lifter just finished a training session and rated how it felt. Decide whether the REMAINING days of their training block should change.`,
    ``,
    `Session just completed (${c.date}):`,
    `- Focus: ${c.focus} (planned intensity: ${c.intensity}).`,
    `- Perceived effort: ${c.effort}/10.`,
    `- Their notes: ${c.notes ? JSON.stringify(c.notes) : "(none)"}`,
    c.skippedLifts.length
      ? `- Lifts they SKIPPED: ${c.skippedLifts.join(", ")}. Treat a skip as a signal — fatigue, pain, or the lift not working for them.`
      : null,
    c.loggedLifts.length ? `- Lifts they logged: ${c.loggedLifts.join(", ")}.` : null,
    ``,
    ctx.priorFeedback.length
      ? `Earlier sessions (newest first): ${ctx.priorFeedback
          .map((f) => `${f.date} effort ${f.effort}/10${f.notes ? ` — ${JSON.stringify(f.notes)}` : ""}`)
          .join("; ")}. Repeated high effort matters more than one hard day.`
      : `No earlier feedback recorded.`,
    ctx.profile.injuryFlags?.length
      ? `Standing injury flags: ${ctx.profile.injuryFlags.join(", ")}.`
      : null,
    ``,
    `Remaining planned days (only these can be changed):`,
    JSON.stringify(
      ctx.remaining.map((d) => ({
        id: d.id,
        date: d.date,
        focus: d.focus,
        emphasis: d.emphasis,
        intensity: d.intensity,
      })),
    ),
    ``,
    `Rules:`,
    `- High strain (effort 8+) or notes describing pain, failure, or being pushed to a limit means the NEXT day or two must give that area time to recover: drop intensity a step and shift emphasis away from what was just worked hard.`,
    `- Notes naming a specific body part (e.g. lower back, knee) take priority — move load off it for at least the next session, even if the effort rating was moderate.`,
    `- Change as FEW days as the situation warrants. A single hard-but-fine session usually needs no change at all — return an empty revisions array in that case.`,
    `- Preserve the block's variety: don't turn several remaining days into the same session while easing off.`,
    `- Never raise intensity here. This step only backs work off.`,
    `- Every note must be one plain sentence the lifter will read in their plan, explaining why that day changed.`,
    ``,
    `Call ${REVISE_TOOL}.`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export class AnthropicPlanGenerator implements PlanGenerator {
  readonly kind = "anthropic" as const;
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generatePlan(ctx: PlanContext): Promise<PlanOutlineResult> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 8192,
      tools: [
        {
          name: PLAN_TOOL,
          description: "Submit the full multi-week training block outline.",
          input_schema: planSchema as unknown as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: PLAN_TOOL },
      messages: [{ role: "user", content: buildPlanPrompt(ctx) }],
    });

    const block = message.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      throw new Error("Claude did not return a structured training plan");
    }
    const input = block.input as {
      summary: string;
      weeks: PlanWeekDraft[];
    };
    return { summary: input.summary, weeks: input.weeks };
  }

  async adaptPlan(ctx: PlanAdaptContext): Promise<PlanAdaptResult> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      tools: [
        {
          name: REVISE_TOOL,
          description:
            "Submit revisions to the remaining planned days, or an empty list if none are needed.",
          input_schema: reviseSchema as unknown as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: REVISE_TOOL },
      messages: [{ role: "user", content: buildAdaptPrompt(ctx) }],
    });

    const block = message.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      throw new Error("Claude did not return a structured plan revision");
    }
    const input = block.input as {
      summary: string | null;
      revisions: PlanDayRevision[];
    };
    return { summary: input.summary, revisions: input.revisions ?? [] };
  }
}
