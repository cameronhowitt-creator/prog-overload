import { getRepo } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import type { MovementCategory } from "@/lib/domain/types";
import OnboardingFlow, { type OnboardingLift } from "./OnboardingFlow";

export const dynamic = "force-dynamic";

// Only the main compound lifts are picked here. Secondary, accessory, core and
// mobility work is programmed AROUND those choices rather than enumerated by the
// user — which keeps this step short as the library grows, and keeps the baseline
// step (which iterates the selection) to the lifts worth having a starting point
// for. The eligibility gate in lib/ai/context.ts matches: only "primary" is
// restricted to this list.
const GROUPS: { category: MovementCategory; label: string }[] = [
  { category: "primary", label: "Your main lifts" },
];

export default async function OnboardingPage() {
  const repo = getRepo();
  const userId = await requireUserId();
  const [exercises, profile] = await Promise.all([
    repo.listExercises(),
    repo.getProfile(userId),
  ]);

  const groups = GROUPS.map((g) => ({
    label: g.label,
    lifts: exercises
      .filter((e) => e.category === g.category)
      .map(
        (e): OnboardingLift => ({
          id: e.id,
          name: e.name,
          muscleGroups: e.muscleGroups,
          equipment: e.equipment,
        }),
      ),
  })).filter((g) => g.lifts.length > 0);

  return (
    <OnboardingFlow
      groups={groups}
      prefillActive={profile.userActiveLifts ?? []}
      prefill={profile}
      returning={!!profile.onboardingCompletedAt}
    />
  );
}
