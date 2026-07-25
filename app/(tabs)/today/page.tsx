import { getRepo, getUserId, todayISO } from "@/lib/db";
import { allowedEquipment } from "@/lib/ai/context";
import { generateTodayAction } from "./actions";
import TodayClient, { type SwapExercise } from "./TodayClient";

export const dynamic = "force-dynamic";

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default async function TodayPage() {
  const repo = getRepo();
  const userId = getUserId();
  const date = todayISO();
  const session = await repo.getSessionForDate(userId, date);

  // Sets already logged for this session, so logging survives reloads (PRD §6.3).
  const loggedByExercise: Record<string, { weight: number; reps: number }[]> = {};
  if (session) {
    const sets = await repo.listLoggedSets(userId);
    for (const s of sets.filter((x) => x.sessionId === session.id)) {
      (loggedByExercise[s.exerciseId] ??= []).push({
        weight: s.weight,
        reps: s.reps,
      });
    }
  }

  // Eligible library for the swap picker: exclusions + active-override equipment
  // filtered, slimmed to what the picker needs (PRD §6.5).
  let swapLibrary: SwapExercise[] = [];
  if (session) {
    const [exercises, exclusions, activeOverride] = await Promise.all([
      repo.listExercises(),
      repo.listExclusions(userId),
      repo.getActiveOverride(userId, date),
    ]);
    const excludedIds = new Set(
      exclusions.map((e) => e.exerciseId).filter(Boolean) as string[],
    );
    const excludedNames = new Set(exclusions.map((e) => e.exerciseName.toLowerCase()));
    const allowed = allowedEquipment(activeOverride?.context ?? null);
    swapLibrary = exercises
      .filter((ex) => {
        if (excludedIds.has(ex.id)) return false;
        if (excludedNames.has(ex.name.toLowerCase())) return false;
        if (allowed && ex.equipment !== "bodyweight" && !allowed.has(ex.equipment))
          return false;
        return true;
      })
      .map((ex) => ({
        id: ex.id,
        name: ex.name,
        category: ex.category,
        muscleGroups: ex.muscleGroups,
        equipment: ex.equipment,
      }));
  }

  if (!session) {
    return (
      <>
        <div className="topbar">
          <div className="eyebrow">{prettyDate(date)}</div>
          <h1>Today&apos;s session</h1>
        </div>
        <p className="empty">
          No session yet. Generate one from your profile, constraints, and logged
          history.
        </p>
        <form action={generateTodayAction} className="field">
          <button className="btn-primary" type="submit">
            Generate today&apos;s workout
          </button>
        </form>
      </>
    );
  }

  return (
    <TodayClient
      session={session}
      dateLabel={prettyDate(date)}
      initialLogs={loggedByExercise}
      library={swapLibrary}
    />
  );
}
