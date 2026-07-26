"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getRepo, todayISO } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { generateProgram } from "@/lib/ai";
import { buildSwapLift } from "@/lib/ai/swap";
import type { Session } from "@/lib/domain/types";

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

  revalidatePath("/history");
  return {
    isNewPR: isNew,
    prWeight: isNew ? pr.weight : null,
    bucket: isNew ? pr.repBucket : null,
  };
}

// Generate (or regenerate) today's session and persist it (PRD §6.2).
export async function generateTodayAction() {
  const repo = getRepo();
  const userId = await requireUserId();
  const date = todayISO();

  const { program } = await generateProgram(repo, userId, date);
  const session: Session = {
    id: randomUUID(),
    userId,
    date,
    program,
    status: "generated",
    createdAt: new Date().toISOString(),
  };
  await repo.saveSession(session);
  revalidatePath("/today");
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
  const { program } = await generateProgram(repo, userId, date);
  const existing = await repo.getSessionForDate(userId, date);
  const session: Session = {
    id: existing?.id ?? randomUUID(),
    userId,
    date,
    program,
    status: "generated",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  await repo.saveSession(session);
  revalidatePath("/today");
  revalidatePath("/profile");
}
