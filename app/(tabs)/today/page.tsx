import Link from "next/link";
import { redirect } from "next/navigation";
import { getRepo, todayISO } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { allowedEquipment } from "@/lib/ai/context";
import { nextPlannedDayAfter, plannedDayForDate } from "@/lib/ai/plan";
import { needsOnboarding } from "@/lib/onboarding";
import { fmtWeekdayDate } from "@/lib/domain/dates";
import { resolveUnits } from "@/lib/domain/units";
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
  const userId = await requireUserId();

  // Fresh users go through onboarding first (PRD onboarding).
  if (await needsOnboarding(repo, userId)) redirect("/onboarding");

  const date = todayISO();
  const [session, profile] = await Promise.all([
    repo.getSessionForDate(userId, date),
    repo.getProfile(userId),
  ]);
  const units = resolveUnits(profile.unitsPreference);

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
  // filtered, and — once onboarded — PRIMARY swaps limited to the active-lift list
  // (everything else is always available). Must stay in step with GATED_CATEGORIES
  // in lib/ai/context.ts or the picker will offer what generation won't program
  // (PRD §6.5, onboarding).
  const GATED = new Set(["primary"]);
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
    const active = new Set(profile.userActiveLifts ?? []);
    const restrictToActive = active.size > 0;
    swapLibrary = exercises
      .filter((ex) => {
        if (excludedIds.has(ex.id)) return false;
        if (excludedNames.has(ex.name.toLowerCase())) return false;
        if (allowed && ex.equipment !== "bodyweight" && !allowed.has(ex.equipment))
          return false;
        if (restrictToActive && GATED.has(ex.category) && !active.has(ex.id))
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
    // Where today sits in the active block, so the empty state says something
    // useful: a planned focus, or that today is a rest day and when the next one is.
    const plan = await repo.getActivePlan(userId);
    const planned = plannedDayForDate(plan, date);
    const next = plan && !planned ? nextPlannedDayAfter(plan, date) : null;

    return (
      <>
        <div className="topbar">
          <div className="eyebrow">{prettyDate(date)}</div>
          <h1>{planned ? planned.focus : "Today's session"}</h1>
          {planned && (
            <div className="meta">
              <span className={`intensity-badge ${planned.intensity}`}>
                {planned.intensity}
              </span>
              {planned.emphasis.length > 0 && (
                <span>{planned.emphasis.join(" · ")}</span>
              )}
            </div>
          )}
        </div>

        {planned ? (
          <p className="empty">
            Today&apos;s slot in your plan. Generate it to get real sets, reps and
            loads off your logged history.
          </p>
        ) : next ? (
          <p className="empty">
            Rest day. Your next session is {fmtWeekdayDate(next.date)} —{" "}
            {next.focus}. Training anyway is fine; it just won&apos;t replace a
            planned day.
          </p>
        ) : !plan ? (
          <p className="empty">
            No training block yet. Build one from the Plan tab, or generate a
            one-off session now.
          </p>
        ) : (
          <p className="empty">
            No session yet. Generate one from your profile, constraints, and logged
            history.
          </p>
        )}

        <form action={generateTodayAction} className="field">
          <button
            className={planned || !plan ? "btn-primary" : "btn-ghost"}
            type="submit"
            style={{ width: "100%" }}
          >
            {planned
              ? "Generate today's session"
              : next
                ? "Train anyway"
                : "Generate today's workout"}
          </button>
        </form>

        {!plan && (
          <Link
            href="/plan"
            className="btn-ghost"
            style={{ display: "block", textAlign: "center", marginTop: 10 }}
          >
            Build my 4-week program
          </Link>
        )}
      </>
    );
  }

  return (
    <TodayClient
      session={session}
      dateLabel={prettyDate(date)}
      initialLogs={loggedByExercise}
      library={swapLibrary}
      units={units}
    />
  );
}
