"use server";

import { revalidatePath } from "next/cache";
import { getRepo, getUserId } from "@/lib/db";

export async function updateProfileAction(formData: FormData) {
  const repo = getRepo();
  const userId = getUserId();
  const sessionLengthMin = Number(formData.get("sessionLengthMin"));
  const defaultEquipmentContext = String(
    formData.get("defaultEquipmentContext") ?? "",
  ).trim();

  await repo.updateProfile(userId, {
    ...(Number.isFinite(sessionLengthMin) && sessionLengthMin > 0
      ? { sessionLengthMin }
      : {}),
    ...(defaultEquipmentContext ? { defaultEquipmentContext } : {}),
  });
  revalidatePath("/profile");
  revalidatePath("/today");
}

export async function addExclusionAction(formData: FormData) {
  const exerciseName = String(formData.get("exerciseName") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!exerciseName || !reason) return; // both required (PRD §6.1)

  const repo = getRepo();
  const userId = getUserId();
  // If the name matches a library exercise, capture its id too.
  const exercises = await repo.listExercises();
  const match = exercises.find(
    (e) => e.name.toLowerCase() === exerciseName.toLowerCase(),
  );
  await repo.addExclusion(userId, {
    exerciseId: match?.id ?? null,
    exerciseName,
    reason,
  });
  revalidatePath("/profile");
  revalidatePath("/today");
}

export async function removeExclusionAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const repo = getRepo();
  await repo.removeExclusion(getUserId(), id);
  revalidatePath("/profile");
  revalidatePath("/today");
}

export async function addOverrideAction(formData: FormData) {
  const context = String(formData.get("context") ?? "").trim();
  const startsOn = String(formData.get("startsOn") ?? "").trim();
  const expiresOn = String(formData.get("expiresOn") ?? "").trim();
  if (!context || !startsOn || !expiresOn) return;
  if (expiresOn < startsOn) return; // guard against inverted ranges

  const repo = getRepo();
  await repo.addOverride(getUserId(), { context, startsOn, expiresOn });
  revalidatePath("/profile");
  revalidatePath("/today");
}

export async function removeOverrideAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const repo = getRepo();
  await repo.removeOverride(getUserId(), id);
  revalidatePath("/profile");
  revalidatePath("/today");
}
