import { getRepo, todayISO } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { resolveUnits } from "@/lib/domain/units";
import LogClient, { type LogSession } from "./LogClient";

export const dynamic = "force-dynamic";

const RECENT_SESSIONS = 10;

export default async function LogPage() {
  const repo = getRepo();
  const userId = await requireUserId();
  const today = todayISO();

  const [profile, sessions, allSets] = await Promise.all([
    repo.getProfile(userId),
    repo.listRecentSessions(userId, RECENT_SESSIONS),
    repo.listLoggedSets(userId),
  ]);
  const units = resolveUnits(profile.unitsPreference);

  // Group logged sets by session. Onboarding baselines have no session id and
  // aren't part of any workout log, so they're intentionally excluded here.
  const bySession = new Map<string, typeof allSets>();
  for (const s of allSets) {
    if (!s.sessionId) continue;
    const arr = bySession.get(s.sessionId);
    if (arr) arr.push(s);
    else bySession.set(s.sessionId, [s]);
  }

  const nameById = new Map(
    sessions.flatMap((s) =>
      s.program.lifts.map((l) => [l.exerciseId, l.exerciseName] as const),
    ),
  );

  const logSessions: LogSession[] = sessions
    .map((session): LogSession => {
      const sets = (bySession.get(session.id) ?? []).sort((a, b) =>
        a.loggedAt.localeCompare(b.loggedAt),
      );
      // Group by exercise, preserving the order lifts appear in the program so the
      // log reads in the order the workout was actually done.
      const order = session.program.lifts.map((l) => l.exerciseId);
      const groups = new Map<string, LogSession["groups"][number]>();
      for (const s of sets) {
        let g = groups.get(s.exerciseId);
        if (!g) {
          g = {
            exerciseId: s.exerciseId,
            exerciseName:
              s.exerciseName || nameById.get(s.exerciseId) || s.exerciseId,
            sets: [],
          };
          groups.set(s.exerciseId, g);
        }
        g.sets.push({ id: s.id, weight: s.weight, reps: s.reps });
      }
      return {
        id: session.id,
        date: session.date,
        status: session.status,
        effort: session.feedback?.effort ?? null,
        notes: session.feedback?.notes ?? null,
        skipped: session.program.lifts
          .filter((l) => l.skipped)
          .map((l) => l.exerciseName),
        groups: [...groups.values()].sort(
          (a, b) => order.indexOf(a.exerciseId) - order.indexOf(b.exerciseId),
        ),
      };
    })
    .filter((s) => s.groups.length > 0 || s.date === today);

  return (
    <LogClient sessions={logSessions} today={today} units={units} />
  );
}
