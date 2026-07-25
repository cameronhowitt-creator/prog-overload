import { getRepo, getUserId, todayISO } from "@/lib/db";
import ThemeToggle from "./ThemeToggle";
import {
  addExclusionAction,
  addOverrideAction,
  removeExclusionAction,
  removeOverrideAction,
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
  const userId = getUserId();
  const today = todayISO();

  const [profile, exclusions, overrides, activeOverride] = await Promise.all([
    repo.getProfile(userId),
    repo.listExclusions(userId),
    repo.listOverrides(userId),
    repo.getActiveOverride(userId, today),
  ]);

  return (
    <>
      <div className="topbar">
        <div className="eyebrow">Settings</div>
        <h1>Profile</h1>
      </div>

      {/* Appearance ---------------------------------------------------------*/}
      <div className="section-label">Appearance</div>
      <ThemeToggle />

      {/* Session settings ---------------------------------------------------*/}
      <div className="section-label">Session</div>
      <form action={updateProfileAction}>
        <div className="field">
          <label htmlFor="sessionLengthMin">Session length (min)</label>
          <input
            id="sessionLengthMin"
            name="sessionLengthMin"
            type="number"
            min={20}
            max={120}
            defaultValue={profile.sessionLengthMin}
            inputMode="numeric"
          />
        </div>
        <div className="field">
          <label htmlFor="defaultEquipmentContext">Default gym / equipment</label>
          <input
            id="defaultEquipmentContext"
            name="defaultEquipmentContext"
            type="text"
            defaultValue={profile.defaultEquipmentContext}
          />
        </div>
        <div className="field">
          <button className="btn-primary" type="submit">
            Save session settings
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

      <div style={{ height: 24 }} />
    </>
  );
}
