import { getRepo, todayISO } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { resolveUnits } from "@/lib/domain/units";
import PlanClient, { type PlanDayView, type PlanWeekView } from "./PlanClient";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const repo = getRepo();
  const userId = await requireUserId();
  const today = todayISO();

  const [profile, plan, exercises] = await Promise.all([
    repo.getProfile(userId),
    repo.getActivePlan(userId),
    repo.listExercises(),
  ]);
  const units = resolveUnits(profile.unitsPreference);
  const nameById = new Map(exercises.map((e) => [e.id, e.name]));

  if (!plan) {
    return (
      <PlanClient
        summary={null}
        weeks={[]}
        today={today}
        units={units}
        startsOn={null}
        endsOn={null}
      />
    );
  }

  // Which planned days already have a real session, and its detail for the sheet.
  const sessions = await repo.listSessionsBetween(userId, plan.startsOn, plan.endsOn);
  const byDate = new Map(sessions.map((s) => [s.date, s]));

  const weeks: PlanWeekView[] = plan.outline.weeks.map((w) => ({
    weekIndex: w.weekIndex,
    intent: w.intent,
    days: w.days.map((d): PlanDayView => {
      const session = byDate.get(d.date) ?? null;
      return {
        id: d.id,
        date: d.date,
        focus: d.focus,
        emphasis: d.emphasis,
        intensity: d.intensity,
        note: d.note,
        adapted: !!d.adapted,
        candidates: d.candidateExerciseIds
          .map((id) => nameById.get(id))
          .filter(Boolean) as string[],
        session: session
          ? {
              status: session.status,
              effort: session.feedback?.effort ?? null,
              notes: session.feedback?.notes ?? null,
              lifts: session.program.lifts.map((l) => ({
                name: l.exerciseName,
                sets: l.sets,
                repLow: l.repLow,
                repHigh: l.repHigh,
                weightTarget: l.weightTarget,
                skipped: !!l.skipped,
              })),
              estimatedMinutes: session.program.estimatedMinutes,
            }
          : null,
      };
    }),
  }));

  return (
    <PlanClient
      summary={plan.outline.summary}
      weeks={weeks}
      today={today}
      units={units}
      startsOn={plan.startsOn}
      endsOn={plan.endsOn}
    />
  );
}
