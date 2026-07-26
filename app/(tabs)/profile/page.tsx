import Link from "next/link";
import { getRepo, todayISO } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import ThemeToggle from "./ThemeToggle";
import { displayWeightNumber, resolveUnits, weightUnit } from "@/lib/domain/units";
import {
  addExclusionAction,
  addOverrideAction,
  removeExclusionAction,
  removeOverrideAction,
  setUnitsAction,
  signOutAction,
  updateProfileAction,
} from "./actions";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const off = dt.getTimezoneOffset();
  return new Date(dt.getTime() - off * 60_000).toISOString().slice(0, 10);
}

export default async function ProfilePage() {
  const repo = getRepo();
  const userId = await requireUserId();
  const today = todayISO();

  const [profile, exclusions, overrides, activeOverride, exercises] =
    await Promise.all([
      repo.getProfile(userId),
      repo.listExclusions(userId),
      repo.listOverrides(userId),
      repo.getActiveOverride(userId, today),
      repo.listExercises(),
    ]);

  const nameById = new Map(exercises.map((e) => [e.id, e.name]));
  const activeLiftNames = (profile.userActiveLifts ?? [])
    .map((id) => nameById.get(id))
    .filter(Boolean) as string[];

  const units = resolveUnits(profile.unitsPreference);
  const weightDisplay =
    profile.weightKg != null ? displayWeightNumber(profile.weightKg, units) : "";

  return (
    <>
      <div className="topbar">
        <div className="eyebrow">Settings</div>
        <h1>Profile</h1>
      </div>

      {/* Your lifts / starting point ---------------------------------------*/}
      <div className="section-label">Your lifts</div>
      <div className="card">
        {activeLiftNames.length > 0 ? (
          <>
            <div className="lift-tag" style={{ marginBottom: 10 }}>
              {activeLiftNames.length} active{" "}
              {activeLiftNames.length === 1 ? "lift" : "lifts"} in your rotation
            </div>
            <div className="cues" style={{ marginTop: 0 }}>
              {activeLiftNames.map((n) => (
                <span className="cue-pill" key={n}>
                  {n}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="lift-tag" style={{ marginBottom: 10 }}>
            No active lifts set — all lifts are eligible.
          </div>
        )}
        <Link href="/onboarding" className="btn-ghost" style={{ display: "block", textAlign: "center", marginTop: 14 }}>
          Update my lifts / starting point
        </Link>
      </div>

      {/* Appearance ---------------------------------------------------------*/}
      <div className="section-label">Appearance</div>
      <ThemeToggle />

      {/* Units — display/input only; never re-scales stored values (PRD §6.6). */}
      <div className="section-label">Units</div>
      <form action={setUnitsAction} className="field">
        <label htmlFor="unitsPreference">Show weights &amp; height in</label>
        <select id="unitsPreference" name="unitsPreference" defaultValue={units}>
          <option value="imperial">Imperial (lb · ft/in)</option>
          <option value="metric">Metric (kg · cm)</option>
        </select>
        <button className="btn-ghost" type="submit" style={{ width: "100%", marginTop: 10 }}>
          Save units
        </button>
      </form>

      {/* Quick edits — weight, goal, creatine (PRD §6.1): no onboarding needed. */}
      <div className="section-label">Quick edits</div>
      <form action={updateProfileAction}>
        <div className="field">
          <label htmlFor="weight">Bodyweight ({weightUnit(units)})</label>
          <input
            id="weight"
            name="weight"
            type="number"
            step="0.1"
            inputMode="decimal"
            defaultValue={weightDisplay}
          />
        </div>
        <div className="field">
          <label htmlFor="primaryGoal">Primary goal</label>
          <input
            id="primaryGoal"
            name="primaryGoal"
            type="text"
            defaultValue={profile.primaryGoal ?? ""}
            placeholder="e.g. build strength"
          />
        </div>
        <div className="field">
          <label htmlFor="creatineStatus">Creatine</label>
          <select
            id="creatineStatus"
            name="creatineStatus"
            defaultValue={profile.creatineStatus ?? ""}
          >
            <option value="">—</option>
            <option value="yes">Taking it</option>
            <option value="no">Not taking it</option>
            <option value="considering">Considering</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="sessionDurationMinutes">Session length (min)</label>
          <input
            id="sessionDurationMinutes"
            name="sessionDurationMinutes"
            type="number"
            min={20}
            max={120}
            inputMode="numeric"
            defaultValue={profile.sessionDurationMinutes ?? 60}
          />
        </div>
        <div className="field">
          <label htmlFor="equipmentAccess">Equipment access</label>
          <select
            id="equipmentAccess"
            name="equipmentAccess"
            defaultValue={profile.equipmentAccess ?? "full_gym"}
          >
            <option value="full_gym">Full gym</option>
            <option value="home_gym">Home gym</option>
            <option value="limited_dumbbells">Limited / dumbbells</option>
            <option value="bodyweight">Bodyweight only</option>
          </select>
        </div>
        <div className="field">
          <button className="btn-primary" type="submit">
            Save
          </button>
        </div>
      </form>

      {/* Temporary location override — dated, auto-expiring (PRD §6.1) -------*/}
      <div className="section-label">Temporary location / equipment</div>
      {activeOverride ? (
        <div className="card" style={{ borderColor: "var(--primary)" }}>
          <div className="row-top">
            <div>
              <p className="lift-name">{activeOverride.context}</p>
              <div className="lift-tag">
                Active until {fmtDate(activeOverride.expiresOn)} · auto-reverts
              </div>
            </div>
            <form action={removeOverrideAction}>
              <input type="hidden" name="id" value={activeOverride.id} />
              <button className="del" type="submit">
                End now
              </button>
            </form>
          </div>
        </div>
      ) : (
        <p className="empty">
          No active override. Your default gym is used. Set one below for travel —
          it reverts on its own.
        </p>
      )}

      <form action={addOverrideAction}>
        <div className="field">
          <label htmlFor="context">Where are you training?</label>
          <input
            id="context"
            name="context"
            type="text"
            placeholder="e.g. Hotel gym — dumbbells + machines only"
          />
        </div>
        <div className="field" style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="startsOn">From</label>
            <input id="startsOn" name="startsOn" type="date" defaultValue={today} />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="expiresOn">Until</label>
            <input
              id="expiresOn"
              name="expiresOn"
              type="date"
              defaultValue={addDays(today, 3)}
            />
          </div>
        </div>
        <div className="field">
          <button className="btn-ghost" type="submit" style={{ width: "100%" }}>
            Set temporary override
          </button>
        </div>
      </form>

      {overrides.filter((o) => o.expiresOn < today).length > 0 && (
        <>
          <div className="section-label">Past overrides (expired)</div>
          {overrides
            .filter((o) => o.expiresOn < today)
            .slice(0, 5)
            .map((o) => (
              <div className="list-row" key={o.id}>
                <div>
                  <div className="lift-name" style={{ fontSize: 15 }}>
                    {o.context}
                  </div>
                  <div className="lift-tag">
                    {fmtDate(o.startsOn)} – {fmtDate(o.expiresOn)}
                  </div>
                </div>
                <span className="badge-muted">expired</span>
              </div>
            ))}
        </>
      )}

      {/* Standing exclusions — persist indefinitely (PRD §6.1) --------------*/}
      <div className="section-label">Standing exclusions</div>
      {exclusions.length === 0 ? (
        <p className="empty">No exclusions yet.</p>
      ) : (
        exclusions.map((e) => (
          <div className="list-row" key={e.id}>
            <div style={{ minWidth: 0 }}>
              <div className="lift-name" style={{ fontSize: 15 }}>
                {e.exerciseName}
              </div>
              <div className="lift-tag">{e.reason} · excluded indefinitely</div>
            </div>
            <form action={removeExclusionAction}>
              <input type="hidden" name="id" value={e.id} />
              <button className="del" type="submit">
                Remove
              </button>
            </form>
          </div>
        ))
      )}

      <form action={addExclusionAction}>
        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor="exerciseName">Exclude an exercise</label>
          <input
            id="exerciseName"
            name="exerciseName"
            type="text"
            placeholder="Exercise name"
          />
        </div>
        <div className="field">
          <label htmlFor="reason">Reason (required)</label>
          <input
            id="reason"
            name="reason"
            type="text"
            placeholder="e.g. bothers my lower back"
          />
        </div>
        <div className="field">
          <button className="btn-ghost" type="submit" style={{ width: "100%" }}>
            Add exclusion
          </button>
        </div>
      </form>

      {/* Account -----------------------------------------------------------*/}
      <div className="section-label">Account</div>
      <form action={signOutAction} className="field">
        <button className="btn-ghost" type="submit" style={{ width: "100%" }}>
          Sign out
        </button>
      </form>

      <div style={{ height: 24 }} />
    </>
  );
}
