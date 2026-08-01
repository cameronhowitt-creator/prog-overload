"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getRepo, todayISO } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { generateProgram } from "@/lib/ai";
import { allPlannedDays, generateTrainingPlan } from "@/lib/ai/plan";
import type { Session } from "@/lib/domain/types";

// Build (or rebuild) the 4-week block starting today. Rebuilding archives the
// previous block rather than deleting it — sessions already logged against it
// keep their planId.
export async function buildPlanAction(): Promise<void> {
  const repo = getRepo();
  const userId = await requireUserId();
  await generateTrainingPlan(repo, userId, todayISO());
  revalidatePath("/plan");
  revalidatePath("/today");
}

// Turn one planned day into a full session with real sets, reps and loads. Past
// days can't be materialized — the point of the plan is what's ahead.
export async function materializeSessionAction(
  planDayId: string,
): Promise<{ ok: boolean; error?: string }> {
  const repo = getRepo();
  const userId = await requireUserId();

  const plan = await repo.getActivePlan(userId);
  if (!plan) return { ok: false, error: "No active plan" };

  const day = allPlannedDays(plan).find((d) => d.id === planDayId);
  if (!day) return { ok: false, error: "That day isn't in your plan" };

  const today = todayISO();
  if (day.date < today) {
    return { ok: false, error: "That day has already passed" };
  }

  const existing = await repo.getSessionForDate(userId, day.date);
  const { program } = await generateProgram(
    repo,
    userId,
    day.date,
    "hypertrophy",
    day,
  );
  const session: Session = {
    // Reuse the existing id so anything already logged for that date stays attached.
    id: existing?.id ?? randomUUID(),
    userId,
    date: day.date,
    program,
    status: "generated",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    planId: plan.id,
    planDayId: day.id,
  };
  await repo.saveSession(session);

  revalidatePath("/plan");
  revalidatePath("/today");
  return { ok: true };
}
