"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getRepo, todayISO } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { generateProgram } from "@/lib/ai";
import type {
  ApproxDate,
  OnboardingLiftEntry,
  Profile,
  Session,
} from "@/lib/domain/types";

// Coarse "how long ago" → concrete backdated date, so a baseline reads as a real
// prior session for progression.
function backdatedISO(approx: ApproxDate | undefined): string {
  const daysAgo =
    approx === "this_week" ? 3 : approx === "over_a_month_ago" ? 45 : 18;
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString();
}

// Incremental per-step save of profile fields (PRD §6.6 save-as-you-go). Never
// stamps onboardingCompletedAt — that's only done by completeOnboardingAction.
export async function saveProfileStepAction(
  patch: Partial<Omit<Profile, "id" | "onboardingCompletedAt" | "userActiveLifts">>,
) {
  const repo = getRepo();
  await repo.updateProfile(await requireUserId(), patch);
}

// Step 2a — persist the selected active lifts.
export async function saveActiveLiftsAction(exerciseIds: string[]) {
  const repo = getRepo();
  await repo.updateProfile(await requireUserId(), { userActiveLifts: exerciseIds });
}

// Step 2b — persist baselines as backdated source:"onboarding" logged sets.
// Clears prior onboarding sets first so re-visiting the step is idempotent.
export async function saveBaselinesAction(entries: OnboardingLiftEntry[]) {
  const repo = getRepo();
  const userId = await requireUserId();
  await repo.clearOnboardingSets(userId);

  const library = await repo.listExercises();
  const byId = new Map(library.map((e) => [e.id, e]));
  for (const entry of entries) {
    // Skip blank baselines entirely — never call addLoggedSet with undefined
    // weight/reps (would violate logged_sets NOT NULL constraints).
    if (
      entry.weight == null ||
      entry.reps == null ||
      entry.weight <= 0 ||
      entry.reps <= 0
    ) {
      continue;
    }
    const ex = byId.get(entry.exerciseId);
    if (!ex) continue;
    const set = await repo.addLoggedSet(userId, {
      // No session exists at onboarding time — session_id is a nullable UUID FK,
      // not a tag. The baseline is tagged via source: "onboarding" below.
      sessionId: null,
      exerciseId: ex.id,
      exerciseName: ex.name,
      setIndex: 0,
      weight: entry.weight,
      reps: entry.reps,
      source: "onboarding",
      loggedAt: backdatedISO(entry.approxDate),
    });
    await repo.considerSetForPR(userId, set);
  }
}

// Final step — stamp completion, generate the first (progressed) session, route in.
export async function completeOnboardingAction() {
  const repo = getRepo();
  const userId = await requireUserId();

  await repo.updateProfile(userId, {
    onboardingCompletedAt: new Date().toISOString(),
  });

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
  revalidatePath("/profile");
  redirect("/today");
}
