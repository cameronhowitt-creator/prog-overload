"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getRepo, getUserId } from "@/lib/db";
import { signOut } from "@/lib/auth";

export async function signOutAction() {
  await signOut();
  redirect("/sign-in");
}

import type {
  CreatineStatus,
  EquipmentAccess,
  Profile,
} from "@/lib/domain/types";

// Inline profile edits from the Profile tab — weight, primary goal, creatine
// status (PRD §6.1), plus session length + equipment. Writes straight to profiles
// without touching onboarding (PRD §6.6). Only sets fields actually present.
export async function updateProfileAction(formData: FormData) {
  const repo = getRepo();
  const userId = getUserId();
  const patch: Partial<Omit<Profile, "id">> = {};

  if (formData.has("weightKg")) {
    const w = Number(formData.get("weightKg"));
    if (Number.isFinite(w) && w > 0) patch.weightKg = w;
  }
  if (formData.has("primaryGoal")) {
    const g = String(formData.get("primaryGoal") ?? "").trim();
    if (g) patch.primaryGoal = g;
  }
  if (formData.has("creatineStatus")) {
    const c = String(formData.get("creatineStatus") ?? "");
    if (["yes", "no", "considering"].includes(c))
      patch.creatineStatus = c as CreatineStatus;
  }
  if (formData.has("sessionDurationMinutes")) {
    const s = Number(formData.get("sessionDurationMinutes"));
    if (Number.isFinite(s) && s > 0) patch.sessionDurationMinutes = s;
  }
  if (formData.has("equipmentAccess")) {
    const e = String(formData.get("equipmentAccess") ?? "");
    if (["full_gym", "home_gym", "limited_dumbbells", "bodyweight"].includes(e))
      patch.equipmentAccess = e as EquipmentAccess;
  }

  if (Object.keys(patch).length > 0) await repo.updateProfile(userId, patch);
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
