"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getRepo, todayISO } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { generateProgram } from "@/lib/ai";
import { adaptTrainingPlan, plannedDayForDate } from "@/lib/ai/plan";
import { buildSwapLift } from "@/lib/ai/swap";
import type { Repository } from "@/lib/db/repo";
import type { PlannedDay, Session } from "@/lib/domain/types";

// The day in the user's active block that `date` falls on, if any. Null when they
// have no plan or it's a rest day — generation still works, just unconstrained.
async function planFor(
  repo: Repository,
  userId: string,
  date: string,
): Promise<{ planId: string | null; day: PlannedDay | null }> {
  const plan = await repo.getActivePlan(userId);
  if (!plan) return { planId: null, day: null };
  return { planId: plan.id, day: plannedDayForDate(plan, date) };
}

// Log one working set during the workout (PRD §6.3). Writes to history and updates
// the PR for the set's rep-range bucket, returning whether it set a new PR so the
// UI can confirm it live (PRD §6.4).
export async function logSetAction(input: {
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  weight: number;
  reps: number;
}): Promise<{ isNewPR: boolean; prWeight: number | null; bucket: string | null }> {
  const repo = getRepo();
  const userId = await requireUserId();

  const set = await repo.addLoggedSet(userId, {
    sessionId: input.sessionId,
    exerciseId: input.exerciseId,
    exerciseName: input.exerciseName,
    setIndex: input.setIndex,
    weight: input.weight,
    reps: input.reps,
  });
  const { pr, isNew } = await repo.considerSetForPR(userId, set);

  // Mark the session in-progress on first logged set.
  await repo.updateSession(userId, input.sessionId, { status: "in_progress" });

  revalidatePath("/log");
  revalidatePath("/profile");
  return {
    isNewPR: isNew,
    prWeight: isNew ? pr.weight : null,
    bucket: isNew ? pr.repBucket : null,
  };
}

// Generate (or regenerate) today's session and persist it (PRD §6.2). When today
// is a day in the active block, the session is built to that day's focus.
export async function generateTodayAction() {
  const repo = getRepo();
  const userId = await requireUserId();
  const date = todayISO();

  const { planId, day } = await planFor(repo, userId, date);
  const { program } = await generateProgram(repo, userId, date, "hypertrophy", day);
  const existing = await repo.getSessionForDate(userId, date);
  const session: Session = {
    // Reuse the existing id so sets already logged today stay attached.
    id: existing?.id ?? randomUUID(),
    userId,
    date,
    program,
    status: "generated",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    planId,
    planDayId: day?.id ?? null,
  };
  await repo.saveSession(session);
  revalidatePath("/today");
  revalidatePath("/plan");
}

// Skip a lift for THIS session only — passed on without swapping it for anything
// else. Deliberately does not write an Exclusion: "not today" and "never again"
// are different intents, and the swap flow already covers the latter.
export async function skipLiftAction(input: {
  sessionId: string;
  exerciseId: string;
  skipped: boolean;
}): Promise<void> {
  const repo = getRepo();
  const userId = await requireUserId();
  const session = await repo.getSession(userId, input.sessionId);
  if (!session) return;

  const lifts = session.program.lifts.map((l) =>
    l.exerciseId === input.exerciseId ? { ...l, skipped: input.skipped } : l,
  );
  await repo.updateSession(userId, input.sessionId, {
    program: { ...session.program, lifts },
  });
  revalidatePath("/today");
}

// End the workout: record how it felt, then re-plan whatever is left of the block
// if the session was a hard one. Returns what changed so the UI can say so.
export async function completeSessionAction(input: {
  sessionId: string;
  effort: number;
  notes: string;
}): Promise<{ changedDays: number; summary: string | null }> {
  const repo = getRepo();
  const userId = await requireUserId();

  const effort = Math.min(10, Math.max(1, Math.round(input.effort)));
  const session = await repo.updateSession(userId, input.sessionId, {
    status: "completed",
    feedback: {
      effort,
      notes: input.notes.trim(),
      completedAt: new Date().toISOString(),
    },
  });

  // Adaptation is best-effort: a failure here must not lose the logged session.
  let result = { changedDays: 0, summary: null as string | null };
  try {
    result = await adaptTrainingPlan(repo, userId, session);
  } catch (err) {
    console.error("Plan adaptation failed after session completion:", err);
  }

  revalidatePath("/today");
  revalidatePath("/log");
  revalidatePath("/plan");
  revalidatePath("/profile");
  return result;
}

// Mid-workout swap: replace one lift in this session's program with a library
// alternative. Session-only by default — does NOT create an exclusion (PRD §6.5).
export async function swapLiftAction(input: {
  sessionId: string;
  originalExerciseId: string;
  newExerciseId: string;
}): Promise<void> {
  const repo = getRepo();
  const userId = await requireUserId();
  const session = await repo.getSession(userId, input.sessionId);
  if (!session) return;

  const idx = session.program.lifts.findIndex(
    (l) => l.exerciseId === input.originalExerciseId,
  );
  if (idx === -1) return;
  const original = session.program.lifts[idx];
  const newExercise = await repo.getExercise(input.newExerciseId);
  if (!newExercise) return;

  const profile = await repo.getProfile(userId);
  const newLift = await buildSwapLift(
    repo,
    userId,
    newExercise,
    {
      sets: original.sets,
      repLow: original.repLow,
      repHigh: original.repHigh,
    },
    profile.unitsPreference,
  );

  const lifts = [...session.program.lifts];
  lifts[idx] = newLift;
  await repo.updateSession(userId, input.sessionId, {
    program: { ...session.program, lifts },
  });
  revalidatePath("/today");
}

// After a swap, if Emma chooses to exclude the ORIGINAL going forward, write it to
// the persistent exclusion list with her reason (PRD §6.5). Declining is a no-op —
// the swap stays session-only.
export async function excludeOriginalAction(input: {
  exerciseId: string;
  exerciseName: string;
  reason: string;
}): Promise<void> {
  if (!input.exerciseName || !input.reason.trim()) return;
  const repo = getRepo();
  const userId = await requireUserId();
  await repo.addExclusion(userId, {
    exerciseId: input.exerciseId || null,
    exerciseName: input.exerciseName,
    reason: input.reason.trim(),
  });
  revalidatePath("/profile");
}

// In-flow "don't program this again": writes to the persistent exclusion list with
// a reason, then regenerates so the excluded lift disappears immediately (PRD §6.1).
export async function excludeAndRegenerateAction(formData: FormData) {
  const exerciseId = String(formData.get("exerciseId") ?? "");
  const exerciseName = String(formData.get("exerciseName") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!exerciseName || !reason) return;

  const repo = getRepo();
  const userId = await requireUserId();
  await repo.addExclusion(userId, {
    exerciseId: exerciseId || null,
    exerciseName,
    reason,
  });

  const date = todayISO();
  const { planId, day } = await planFor(repo, userId, date);
  const { program } = await generateProgram(repo, userId, date, "hypertrophy", day);
  const existing = await repo.getSessionForDate(userId, date);
  const session: Session = {
    id: existing?.id ?? randomUUID(),
    userId,
    date,
    program,
    status: "generated",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    planId,
    planDayId: day?.id ?? null,
  };
  await repo.saveSession(session);
  revalidatePath("/today");
  revalidatePath("/profile");
}
