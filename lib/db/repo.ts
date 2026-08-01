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
  TrainingPlan,
} from "../domain/types";

export interface Repository {
  // Profile ------------------------------------------------------------------
  getProfile(userId: string): Promise<Profile>;
  updateProfile(userId: string, patch: Partial<Omit<Profile, "id">>): Promise<Profile>;

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
  // Sessions falling in [startISO, endISO] inclusive — backs the plan calendar,
  // which needs to know which planned days already have a session.
  listSessionsBetween(
    userId: string,
    startISO: string,
    endISO: string,
  ): Promise<Session[]>;
  saveSession(session: Session): Promise<Session>;
  updateSession(
    userId: string,
    id: string,
    patch: Partial<
      Pick<Session, "program" | "status" | "feedback" | "planId" | "planDayId">
    >,
  ): Promise<Session>;

  // Multi-week training plans (outline only; prescriptions live on sessions) ---
  getActivePlan(userId: string): Promise<TrainingPlan | null>;
  getPlan(userId: string, id: string): Promise<TrainingPlan | null>;
  // Persists a new block, archiving whatever block was previously active — at
  // most one active plan per user.
  savePlan(plan: TrainingPlan): Promise<TrainingPlan>;
  updatePlan(
    userId: string,
    id: string,
    patch: Partial<Pick<TrainingPlan, "outline" | "status" | "endsOn">>,
  ): Promise<TrainingPlan>;

  // Logged sets — authoritative history going forward (PRD §6.3, §7) ---------
  listLoggedSets(userId: string, exerciseId?: string): Promise<LoggedSet[]>;
  addLoggedSet(
    userId: string,
    // loggedAt may be supplied to backdate onboarding baselines; defaults to now.
    input: Omit<LoggedSet, "id" | "userId" | "loggedAt"> & { loggedAt?: string },
  ): Promise<LoggedSet>;
  // Correct an errant entry after the fact (Log tab). Weight is canonical kg.
  updateLoggedSet(
    userId: string,
    id: string,
    patch: { weight?: number; reps?: number },
  ): Promise<LoggedSet>;
  deleteLoggedSet(userId: string, id: string): Promise<void>;
  // Most recent logged occurrence of a lift, summarized (PRD §6.2 last-time).
  lastTimeFor(userId: string, exerciseId: string): Promise<LastTime | null>;
  // Remove all onboarding-sourced baseline sets for a user, so re-entering the
  // onboarding baseline step is idempotent (PRD §6.6).
  clearOnboardingSets(userId: string): Promise<void>;

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
  // Rebuild every bucket PR for one lift by replaying its logged sets in order.
  // Required after an edit or delete: lowering a PR-setting set must demote the
  // PR, which the incremental considerSetForPR path can't do.
  recomputePRsFor(userId: string, exerciseId: string): Promise<void>;
}
