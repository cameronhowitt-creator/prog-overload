// Program generation entry point. Selects the live Claude generator when a key is
// configured, otherwise the deterministic mock — and falls back to the mock if a
// live call errors, so "generate today's session" never hard-fails (PRD §6.2).

import type { Repository } from "../db/repo";
import type { PlannedDay, Program, TrainingPhase } from "../domain/types";
import { assembleProgram } from "./assemble";
import { AnthropicGenerator } from "./anthropicGenerator";
import { buildGenerationContext } from "./context";
import { MockGenerator } from "./mockGenerator";
import type { ProgramGenerator } from "./types";

export function selectGenerator(): ProgramGenerator {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key && key.trim()) {
    const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5";
    return new AnthropicGenerator(key.trim(), model);
  }
  return new MockGenerator();
}

export interface GenerateResult {
  program: Program;
  generatorKind: "mock" | "anthropic";
  usedFallback: boolean;
}

export async function generateProgram(
  repo: Repository,
  userId: string,
  date: string,
  phase: TrainingPhase = "hypertrophy",
  // When this day belongs to an active training block, its focus/emphasis/
  // intensity constrain the session so the block actually holds together.
  plannedDay: PlannedDay | null = null,
): Promise<GenerateResult> {
  const ctx = await buildGenerationContext(repo, userId, date, phase, plannedDay);
  const generator = selectGenerator();

  try {
    const result = await generator.generate(ctx);
    return {
      program: assembleProgram(ctx, result),
      generatorKind: generator.kind,
      usedFallback: false,
    };
  } catch (err) {
    if (generator.kind === "mock") throw err;
    // Live call failed — fall back to the deterministic generator.
    console.error("Live generation failed, falling back to mock:", err);
    const result = await new MockGenerator().generate(ctx);
    return {
      program: assembleProgram(ctx, result),
      generatorKind: "mock",
      usedFallback: true,
    };
  }
}
