// Data-access interface. All persistence goes through this so the storage backend
// is swappable: a local JSON-file store (default, zero-setup dev + verification) and
// a Supabase/Postgres adapter (production, user-scoped with RLS — PRD §8).
//
// Every method is user-scoped by userId so multi-user needs no rewrite (PRD §5, §8).

import type {
  Exclusion,
  Exercise,
  LastTime,
  LocationOverride,
  LoggedSet,
  PR,
  Profile,
  RepBucket,
  Session,
} from "../domain/types";

export interface Repository {
  // Profile ------------------------------------------------------------------
  getProfile(userId: string): Promise<Profile>;
  updateProfile(userId: string, patch: Partial<Omit<Profile, "userId">>): Promise<Profile>;

  // Standing exclusions (persist indefinitely — PRD §6.1) --------------------
  listExclusions(userId: string): Promise<Exclusion[]>;
  addExclusion(
    userId: string,
    input: { exerciseId: string | null; exerciseName: string; reason: string },
  ): Promise<Exclusion>;
  removeExclusion(userId: string, id: string): Promise<void>;

  // Temporary, dated location/equipment overrides (auto-expire — PRD §6.1) ---
  listOverrides(userId: string): Promise<LocationOverride[]>;
  // Returns the override active on `dateISO` (yyyy-mm-dd), or null. Expiry is by
  // date so it auto-reverts without any manual undo (PRD §12).
  getActiveOverride(userId: string, dateISO: string): Promise<LocationOverride | null>;
  addOverride(
    userId: string,
    input: { context: string; startsOn: string; expiresOn: string },
  ): Promise<LocationOverride>;
  removeOverride(userId: string, id: string): Promise<void>;

  // Exercise library (PRD §6.5) ----------------------------------------------
  listExercises(): Promise<Exercise[]>;
  getExercise(id: string): Promise<Exercise | null>;

  // Sessions -----------------------------------------------------------------
  getSessionForDate(userId: string, dateISO: string): Promise<Session | null>;
  getSession(userId: string, id: string): Promise<Session | null>;
  listRecentSessions(userId: string, limit: number): Promise<Session[]>;
  saveSession(session: Session): Promise<Session>;
  updateSession(
    userId: string,
    id: string,
    patch: Partial<Pick<Session, "program" | "status">>,
  ): Promise<Session>;

  // Logged sets — authoritative history going forward (PRD §6.3, §7) ---------
  listLoggedSets(userId: string, exerciseId?: string): Promise<LoggedSet[]>;
  addLoggedSet(
    userId: string,
    input: Omit<LoggedSet, "id" | "userId" | "loggedAt">,
  ): Promise<LoggedSet>;
  // Most recent logged occurrence of a lift, summarized (PRD §6.2 last-time).
  lastTimeFor(userId: string, exerciseId: string): Promise<LastTime | null>;

  // PRs — per lift per rep-range bucket (PRD §6.4) ---------------------------
  listPRs(userId: string, opts?: { onlyCurrent?: boolean }): Promise<PR[]>;
  currentPRFor(
    userId: string,
    exerciseId: string,
    bucket: RepBucket,
  ): Promise<PR | null>;
  // Considers a logged set for a PR: overwrites the bucket PR only if it beats
  // the current one, retaining the beaten PR as history (PRD §6.4).
  considerSetForPR(userId: string, set: LoggedSet): Promise<{ pr: PR; isNew: boolean }>;
}
