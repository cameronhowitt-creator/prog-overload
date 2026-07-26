import { getRepo } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { CATEGORY_LABEL, fmtShortDate } from "@/lib/domain/format";
import { formatWeight, resolveUnits } from "@/lib/domain/units";
import type { MovementCategory } from "@/lib/domain/types";
import LiftChart from "./LiftChart";

export const dynamic = "force-dynamic";

const ORDER: MovementCategory[] = ["primary", "secondary", "accessory", "core"];

export default async function HistoryPage() {
  const repo = getRepo();
  const userId = await requireUserId();

  const [sets, prs, exercises, profile] = await Promise.all([
    repo.listLoggedSets(userId),
    repo.listPRs(userId, { onlyCurrent: true }),
    repo.listExercises(),
    repo.getProfile(userId),
  ]);
  const units = resolveUnits(profile.unitsPreference);

  const exById = new Map(exercises.map((e) => [e.id, e]));

  // Per-exercise: daily top-set weights (chronological) + last logged + top PR.
  type Row = {
    exerciseId: string;
    name: string;
    category: MovementCategory;
    weights: number[];
    lastWeight: number;
    lastReps: number;
    lastDate: string;
    prWeight: number | null;
    prBucket: string | null;
  };

  const byExercise = new Map<string, typeof sets>();
  for (const s of sets) {
    const arr = byExercise.get(s.exerciseId);
    if (arr) arr.push(s);
    else byExercise.set(s.exerciseId, [s]);
  }

  const rows: Row[] = [];
  for (const [exId, exSets] of byExercise) {
    const ex = exById.get(exId);
    if (!ex) continue;
    // Top weight per day, chronological.
    const dayTop = new Map<string, { weight: number; reps: number }>();
    for (const s of exSets) {
      const day = s.loggedAt.slice(0, 10);
      const cur = dayTop.get(day);
      if (!cur || s.weight > cur.weight) dayTop.set(day, { weight: s.weight, reps: s.reps });
    }
    const days = [...dayTop.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const last = exSets.reduce((a, b) => (b.loggedAt > a.loggedAt ? b : a));
    const exPRs = prs.filter((p) => p.exerciseId === exId);
    const topPR = exPRs.reduce<(typeof exPRs)[number] | null>(
      (best, p) => (!best || p.weight > best.weight ? p : best),
      null,
    );
    rows.push({
      exerciseId: exId,
      name: ex.name,
      category: ex.category,
      weights: days.map(([, v]) => v.weight),
      lastWeight: last.weight,
      lastReps: last.reps,
      lastDate: last.loggedAt.slice(0, 10),
      prWeight: topPR?.weight ?? null,
      prBucket: topPR?.repBucket ?? null,
    });
  }

  const hasData = rows.length > 0;

  return (
    <>
      <div className="topbar">
        <div className="eyebrow">Progress</div>
        <h1>History &amp; PRs</h1>
      </div>

      {!hasData && (
        <p className="empty">
          No logged history yet. Log sets during a workout and your lifts appear
          here with weight trends and PRs.
        </p>
      )}

      {ORDER.map((cat) => {
        const catRows = rows
          .filter((r) => r.category === cat)
          .sort((a, b) => a.name.localeCompare(b.name));
        if (catRows.length === 0) return null;
        return (
          <div key={cat}>
            <div className="section-label">{CATEGORY_LABEL[cat]}</div>
            {catRows.map((r) => (
              <div className="card" key={r.exerciseId}>
                <div className="row-top" style={{ alignItems: "center" }}>
                  <div className="lift-name">{r.name}</div>
                  {r.prWeight !== null && (
                    <div className="pr-badge">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l2.9 6.6L22 9.3l-5 4.9 1.2 7.1L12 17.8l-6.2 3.5L7 14.2 2 9.3l7.1-.7z" />
                      </svg>
                      {formatWeight(r.prWeight, units)} PR
                    </div>
                  )}
                </div>
                <LiftChart weights={r.weights} />
                <div className="hist-foot">
                  <span>
                    {r.prBucket ? `${r.prBucket} rep bucket` : "logged"}
                  </span>
                  <span>
                    Last:{" "}
                    <b>{r.lastWeight ? formatWeight(r.lastWeight, units) : "BW"}</b>{" "}
                    × {r.lastReps} on {fmtShortDate(r.lastDate)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <div style={{ height: 24 }} />
    </>
  );
}
