"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getRepo, todayISO } from "@/lib/db";
import { requireUserId, signOut } from "@/lib/auth";
import { generateTrainingPlan } from "@/lib/ai/plan";

export async function signOutAction() {
  await signOut();
  redirect("/sign-in");
}

import type {
  CreatineStatus,
  EquipmentAccess,
  Profile,
  UnitsPreference,
  Weekday,
} from "@/lib/domain/types";
import { resolveUnits, toCanonicalWeightKg } from "@/lib/domain/units";

// Change the units preference. Display/input only — never re-scales stored values
// (weights stay canonical kg), so history reads the same numbers (PRD §6.6).
export async function setUnitsAction(formData: FormData) {
  const u = String(formData.get("unitsPreference") ?? "");
  if (u !== "imperial" && u !== "metric") return;
  const repo = getRepo();
  await repo.updateProfile((await requireUserId()), { unitsPreference: u as UnitsPreference });
  revalidatePath("/profile");
  revalidatePath("/today");
  revalidatePath("/log");
}

// Change which weekdays the user trains. daysPerWeek is derived from the count so
// it stays consistent for anything that still reads it. Optionally rebuilds the
// 4-week block, since an existing block is laid out on the OLD days.
export async function setTrainingDaysAction(input: {
  days: Weekday[];
  rebuildPlan: boolean;
}): Promise<void> {
  const days = [...new Set(input.days)]
    .filter((d): d is Weekday => d >= 0 && d <= 6)
    .sort((a, b) => a - b);
  if (days.length === 0) return;

  const repo = getRepo();
  const userId = await requireUserId();
  await repo.updateProfile(userId, {
    preferredWorkoutDays: days,
    daysPerWeek: days.length,
  });

  if (input.rebuildPlan) {
    await generateTrainingPlan(repo, userId, todayISO());
  }

  revalidatePath("/profile");
  revalidatePath("/plan");
  revalidatePath("/today");
}

// Inline profile edits from the Profile tab — weight, primary goal, creatine
// status (PRD §6.1), plus session length + equipment. Writes straight to profiles
// without touching onboarding (PRD §6.6). Only sets fields actually present. The
// weight input is in the user's DISPLAY unit; converted to canonical kg here.
export async function updateProfileAction(formData: FormData) {
  const repo = getRepo();
  const userId = await requireUserId();
  const patch: Partial<Omit<Profile, "id">> = {};

  if (formData.has("weight")) {
    const w = Number(formData.get("weight"));
    if (Number.isFinite(w) && w > 0) {
      const profile = await repo.getProfile(userId);
      patch.weightKg = toCanonicalWeightKg(w, resolveUnits(profile.unitsPreference));
    }
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
  const userId = await requireUserId();
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
  await repo.removeExclusion((await requireUserId()), id);
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
  await repo.addOverride((await requireUserId()), { context, startsOn, expiresOn });
  revalidatePath("/profile");
  revalidatePath("/today");
}

export async function removeOverrideAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const repo = getRepo();
  await repo.removeOverride((await requireUserId()), id);
  revalidatePath("/profile");
  revalidatePath("/today");
}
