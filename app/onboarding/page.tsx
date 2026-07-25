import { getRepo, getUserId } from "@/lib/db";
import type { MovementCategory } from "@/lib/domain/types";
import OnboardingFlow, { type OnboardingLift } from "./OnboardingFlow";

export const dynamic = "force-dynamic";

// Strength categories the user picks from — core/mobility are programmed for them.
const GROUPS: { category: MovementCategory; label: string }[] = [
  { category: "primary", label: "Primary / compound" },
  { category: "secondary", label: "Secondary compound" },
  { category: "accessory", label: "Accessory / isolation" },
];

export default async function OnboardingPage() {
  const repo = getRepo();
  const userId = getUserId();
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
