"use server";

import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

// Correct an errant entry. PRs are rebuilt for the affected lift afterwards:
// lowering the set that SET a PR has to demote it, which the incremental
// considerSetForPR path can't do (it only ever ratchets upward).
export async function editLoggedSetAction(input: {
  setId: string;
  exerciseId: string;
  weight: number;
  reps: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isFinite(input.reps) || input.reps <= 0) {
    return { ok: false, error: "Reps must be at least 1" };
  }
  if (!Number.isFinite(input.weight) || input.weight < 0) {
    return { ok: false, error: "Weight can't be negative" };
  }

  const repo = getRepo();
  const userId = await requireUserId();
  await repo.updateLoggedSet(userId, input.setId, {
    weight: input.weight,
    reps: input.reps,
  });
  await repo.recomputePRsFor(userId, input.exerciseId);

  revalidatePath("/log");
  revalidatePath("/today");
  revalidatePath("/profile");
  return { ok: true };
}

export async function deleteLoggedSetAction(input: {
  setId: string;
  exerciseId: string;
}): Promise<void> {
  const repo = getRepo();
  const userId = await requireUserId();
  await repo.deleteLoggedSet(userId, input.setId);
  await repo.recomputePRsFor(userId, input.exerciseId);

  revalidatePath("/log");
  revalidatePath("/today");
  revalidatePath("/profile");
}
