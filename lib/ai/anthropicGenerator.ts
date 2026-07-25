// Live program generator via the Claude API (PRD §6.2). Emits structured output
// through a forced tool call so we get a typed LiftSelection[] with no parsing.
// It only PICKS exercises + prescriptions + rationale; authoritative last-time/PR
// numbers are attached afterward by assembleProgram (PRD §6.2, §12).

import Anthropic from "@anthropic-ai/sdk";
import { repRangeFor, restDefaultsFor } from "../domain/heuristics";
import {
  displayWeightNumber,
  resolveUnits,
  toCanonicalWeightKg,
} from "../domain/units";
import { eligibleExercises } from "./context";
import type {
  GenerationContext,
  GeneratorResult,
  LiftSelection,
  ProgramGenerator,
} from "./types";

const TOOL_NAME = "submit_program";

const inputSchema = {
  type: "object",
  properties: {
    phase: { type: "string", enum: ["endurance", "hypertrophy", "strength"] },
    contextNote: {
      type: ["string", "null"],
      description: "Short note on any temporary override applied, else null.",
    },
    lifts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          exerciseId: { type: "string", description: "Must be an id from the provided library." },
          sets: { type: "integer", minimum: 1, maximum: 6 },
          repLow: { type: "integer", minimum: 1, maximum: 30 },
          repHigh: { type: "integer", minimum: 1, maximum: 30 },
          weightTarget: {
            type: ["number", "null"],
            description:
              "Target load in the unit stated in the prompt, or null for bodyweight/hold work.",
          },
          rationale: {
            type: "string",
            description:
              "One plain-language sentence. If the lift has history, reference the actual last set.",
          },
        },
        required: ["exerciseId", "sets", "repLow", "repHigh", "weightTarget", "rationale"],
        additionalProperties: false,
      },
    },
  },
  required: ["phase", "lifts", "contextNote"],
  additionalProperties: false,
} as const;

function buildPrompt(ctx: GenerationContext): string {
  const eligible = eligibleExercises(ctx);
  const units = resolveUnits(ctx.profile.unitsPreference);
  // History is stored canonical kg; present it to the model in the user's unit so
  // its increments + rationale come back in that unit (PRD §6.6).
  const w = (kg: number) => displayWeightNumber(kg, units);
  const library = eligible.map((ex) => {
    const h = ctx.history[ex.id];
    return {
      id: ex.id,
      name: ex.name,
      category: ex.category,
      muscleGroups: ex.muscleGroups,
      equipment: ex.equipment,
      isCoreLift: !!ex.isCoreLift,
      correctiveGoal: ex.correctiveGoal ?? null,
      lastTime: h?.lastTime
        ? { weight: w(h.lastTime.weight), reps: h.lastTime.reps, sets: h.lastTime.sets, date: h.lastTime.date }
        : null,
      currentPRs: h?.currentPRs.map((p) => ({
        bucket: p.repBucket,
        weight: w(p.weight),
        reps: p.reps,
      })),
    };
  });

  const range = repRangeFor(ctx.phase);
  const restCompound = restDefaultsFor("primary");
  const restIso = restDefaultsFor("accessory");
  const p = ctx.profile;
  const sessionMin = p.sessionDurationMinutes ?? 60;

  const unitLabel = units === "imperial" ? "lb" : "kg";
  const stepHint = units === "imperial" ? "~2.5–5 lb" : "~1–2.5 kg";

  return [
    `You are programming ONE strength session for a lifter.`,
    `Date: ${ctx.date}. Training phase: ${ctx.phase} (default rep range ${range.low}-${range.high}).`,
    `ALL weights in this prompt and in your response are in ${unitLabel}. Use ${unitLabel} everywhere, including weightTarget and any weights in the rationale. Progress loads by a clean ${stepHint} step when a lift has history.`,
    `Session must fit ${sessionMin} minutes END TO END including a ~8 min warm-up.`,
    ctx.activeOverride
      ? `TEMPORARY context override in effect (do not treat as permanent): "${ctx.activeOverride.context}". Only use exercises whose equipment is available in this context.`
      : `Equipment access: ${p.equipmentAccess ?? "full_gym"}. Only prescribe lifts this equipment supports.`,
    ``,
    `Lifter profile (adapt the session to this):`,
    p.experienceLevel ? `- Experience: ${p.experienceLevel}. Primary goal: ${p.primaryGoal ?? "general strength"}.` : null,
    p.injuryFlags?.length ? `- INJURY flags: ${p.injuryFlags.join(", ")}. Prefer lifts that don't load these; add explicit technique-gating cues, and avoid aggravating ranges.` : null,
    p.mobilityFlags?.length ? `- Mobility limitations: ${p.mobilityFlags.join(", ")}. Choose ranges/variations that respect these.` : null,
    (p.typicalSleepHours != null || p.stressLevel || p.activityOutsideGym)
      ? `- Recovery baseline: sleep ~${p.typicalSleepHours ?? "?"}h, stress ${p.stressLevel ?? "?"}, outside-gym activity ${p.activityOutsideGym ?? "?"}. If recovery looks compromised, bias toward the conservative end of load progression.`
      : null,
    p.cycleTrackingOptIn ? `- Menstrual-cycle-aware programming is opted in (cycle length ~${p.cycleLengthDays ?? "?"} days). Apply phase-appropriate load/volume guidance.` : null,
    p.dislikedExercises?.length ? `- Disliked (avoid unless no alternative): ${JSON.stringify(p.dislikedExercises)}.` : null,
    ``,
    `Rules:`,
    `- Structure: 1 primary compound -> 2-3 secondary compounds/accessories -> 1-2 accessory/isolation -> 1 core -> 1 corrective (mobility).`,
    `- Keep designated core lifts (isCoreLift) stable across sessions for trackable progression; ROTATE the corrective so it isn't the same one repeatedly. Recently used correctives to avoid: ${JSON.stringify(ctx.recentCorrectiveIds)}.`,
    `- Rest is implied by category (compound ${restCompound.low}-${restCompound.high}s, isolation ${restIso.low}-${restIso.high}s) — you do not set rest.`,
    `- For every lift WITH history, the rationale MUST reference the actual last set (weight x reps) and justify the target. Progress conservatively. Onboarding-sourced history counts the same as live logs.`,
    `- For a lift with NO history, set weightTarget null and say it's the first logged session.`,
    `- Only pick exercises from the library below, by id. Never program an excluded exercise.`,
    ``,
    `Excluded (never program): ${JSON.stringify(ctx.exclusions.map((e) => e.exerciseName))}.`,
    ``,
    `Exercise library (id, tags, and this lifter's history — already filtered to their active lifts + equipment):`,
    JSON.stringify(library),
    ``,
    `Call ${TOOL_NAME} with the session.`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export class AnthropicGenerator implements ProgramGenerator {
  readonly kind = "anthropic" as const;
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generate(ctx: GenerationContext): Promise<GeneratorResult> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      tools: [
        {
          name: TOOL_NAME,
          description: "Submit the generated workout session.",
          input_schema: inputSchema as unknown as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: buildPrompt(ctx) }],
    });

    const block = message.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      throw new Error("Claude did not return a structured program");
    }
    const input = block.input as {
      phase: GeneratorResult["phase"];
      contextNote: string | null;
      lifts: LiftSelection[];
    };

    // The model worked in the user's unit; convert weightTarget back to canonical
    // kg for storage. Rationale text stays in the user's unit for display.
    const units = resolveUnits(ctx.profile.unitsPreference);
    const selections = input.lifts.map((l) => ({
      ...l,
      weightTarget:
        l.weightTarget == null ? null : toCanonicalWeightKg(l.weightTarget, units),
    }));

    return {
      phase: input.phase,
      contextNote: input.contextNote,
      selections,
    };
  }
}
