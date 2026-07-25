import type { Repository } from "./db/repo";

// A user needs onboarding until they've completed it — the canonical signal is
// profiles.onboarding_completed_at (also what the middleware checks). Completing
// the flow stamps it, so it never re-triggers (PRD §6.6 acceptance criteria).
export async function needsOnboarding(
  repo: Repository,
  userId: string,
): Promise<boolean> {
  const profile = await repo.getProfile(userId);
  return !profile.onboardingCompletedAt;
}
