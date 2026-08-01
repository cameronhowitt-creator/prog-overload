// Local JSON-file implementation of Repository. Zero external dependencies so the
// app runs and can be verified end-to-end with no Supabase project. Server-only
// (uses node:fs). Persists to .data/store.json. Seeds on first init.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type {
  Exclusion,
  Exercise,
  Feedback,
  FeedbackInput,
  LastTime,
  LocationOverride,
  LoggedSet,
  PR,
  Profile,
  RepBucket,
  Session,
  TrainingPlan,
} from "../domain/types";
import { beatsPR, DEFAULT_SESSION_MINUTES, repBucketFor } from "../domain/heuristics";
import { SEED_EXCLUSION, SEED_EXERCISES } from "../seed/exercises";
import { replayPRs } from "./prReplay";
import type { Repository } from "./repo";

interface DBShape {
  profiles: Profile[];
  exclusions: Exclusion[];
  overrides: LocationOverride[];
  exercises: Exercise[];
  sessions: Session[];
  loggedSets: LoggedSet[];
  prs: PR[];
  plans: TrainingPlan[];
  feedback: Feedback[];
  seededUsers: string[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

function emptyDB(): DBShape {
  return {
    profiles: [],
    exclusions: [],
    overrides: [],
    exercises: SEED_EXERCISES,
    sessions: [],
    loggedSets: [],
    prs: [],
    plans: [],
    feedback: [],
    seededUsers: [],
  };
}

// Serialize writes within a process via a single promise chain. We deliberately
// keep NO long-lived in-memory cache: `next start` runs multiple worker processes,
// and a per-process cache goes stale — combined with any write, one worker would
// clobber another's file with old data. Reading fresh from disk each op avoids that.
let writeChain: Promise<void> = Promise.resolve();

async function load(): Promise<DBShape> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as DBShape;
    // The exercise library is code-owned; always refresh it from seed so library
    // edits ship without a data migration.
    parsed.exercises = SEED_EXERCISES;
    // Collections added after a store file was first written.
    parsed.plans ??= [];
    parsed.feedback ??= [];
    return parsed;
  } catch {
    return emptyDB();
  }
}

async function persist(db: DBShape): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

// Run a mutation exclusively, returning its result.
async function mutate<T>(fn: (db: DBShape) => Promise<T> | T): Promise<T> {
  let result: T;
  const run = async () => {
    const db = await load();
    result = await fn(db);
    await persist(db);
  };
  writeChain = writeChain.then(run, run);
  await writeChain;
  return result!;
}

// Ensure a user has their seed rows (profile + the single standing exclusion).
function ensureSeeded(db: DBShape, userId: string) {
  if (db.seededUsers.includes(userId)) return;
  if (!db.profiles.find((p) => p.id === userId)) {
    db.profiles.push({
      id: userId,
      sessionDurationMinutes: DEFAULT_SESSION_MINUTES,
      equipmentAccess: "full_gym",
      userActiveLifts: [],
      onboardingCompletedAt: null,
    });
  }
  db.exclusions.push({
    id: randomUUID(),
    userId,
    exerciseId: SEED_EXCLUSION.exerciseId,
    exerciseName: SEED_EXCLUSION.exerciseName,
    reason: SEED_EXCLUSION.reason,
    createdAt: new Date().toISOString(),
  });
  db.seededUsers.push(userId);
}

export class LocalStore implements Repository {
  // Profile ------------------------------------------------------------------
  async getProfile(userId: string): Promise<Profile> {
    return mutate((db) => {
      ensureSeeded(db, userId);
      return db.profiles.find((p) => p.id === userId)!;
    });
  }

  async updateProfile(
    userId: string,
    patch: Partial<Omit<Profile, "id">>,
  ): Promise<Profile> {
    return mutate((db) => {
      ensureSeeded(db, userId);
      const p = db.profiles.find((x) => x.id === userId)!;
      Object.assign(p, patch);
      return p;
    });
  }

  // Exclusions ---------------------------------------------------------------
  async listExclusions(userId: string): Promise<Exclusion[]> {
    return mutate((db) => {
      ensureSeeded(db, userId);
      return db.exclusions
        .filter((e) => e.userId === userId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }

  async addExclusion(
    userId: string,
    input: { exerciseId: string | null; exerciseName: string; reason: string },
  ): Promise<Exclusion> {
    return mutate((db) => {
      ensureSeeded(db, userId);
      // De-dupe: if the same exercise is already excluded, update the reason.
      const existing = db.exclusions.find(
        (e) =>
          e.userId === userId &&
          ((input.exerciseId && e.exerciseId === input.exerciseId) ||
            e.exerciseName.toLowerCase() === input.exerciseName.toLowerCase()),
      );
      if (existing) {
        existing.reason = input.reason;
        return existing;
      }
      const row: Exclusion = {
        id: randomUUID(),
        userId,
        exerciseId: input.exerciseId,
        exerciseName: input.exerciseName,
        reason: input.reason,
        createdAt: new Date().toISOString(),
      };
      db.exclusions.push(row);
      return row;
    });
  }

  async removeExclusion(userId: string, id: string): Promise<void> {
    await mutate((db) => {
      db.exclusions = db.exclusions.filter(
        (e) => !(e.userId === userId && e.id === id),
      );
    });
  }

  // Overrides ----------------------------------------------------------------
  async listOverrides(userId: string): Promise<LocationOverride[]> {
    return mutate((db) =>
      db.overrides
        .filter((o) => o.userId === userId)
        .sort((a, b) => b.startsOn.localeCompare(a.startsOn)),
    );
  }

  async getActiveOverride(
    userId: string,
    dateISO: string,
  ): Promise<LocationOverride | null> {
    const db = await load();
    const active = db.overrides.filter(
      (o) => o.userId === userId && o.startsOn <= dateISO && o.expiresOn >= dateISO,
    );
    // Most recently started active override wins.
    active.sort((a, b) => b.startsOn.localeCompare(a.startsOn));
    return active[0] ?? null;
  }

  async addOverride(
    userId: string,
    input: { context: string; startsOn: string; expiresOn: string },
  ): Promise<LocationOverride> {
    return mutate((db) => {
      const row: LocationOverride = {
        id: randomUUID(),
        userId,
        context: input.context,
        startsOn: input.startsOn,
        expiresOn: input.expiresOn,
        createdAt: new Date().toISOString(),
      };
      db.overrides.push(row);
      return row;
    });
  }

  async removeOverride(userId: string, id: string): Promise<void> {
    await mutate((db) => {
      db.overrides = db.overrides.filter(
        (o) => !(o.userId === userId && o.id === id),
      );
    });
  }

  // Exercises ----------------------------------------------------------------
  async listExercises(): Promise<Exercise[]> {
    const db = await load();
    return db.exercises;
  }

  async getExercise(id: string): Promise<Exercise | null> {
    const db = await load();
    return db.exercises.find((e) => e.id === id) ?? null;
  }

  // Sessions -----------------------------------------------------------------
  async getSessionForDate(userId: string, dateISO: string): Promise<Session | null> {
    const db = await load();
    return (
      db.sessions.find((s) => s.userId === userId && s.date === dateISO) ?? null
    );
  }

  async getSession(userId: string, id: string): Promise<Session | null> {
    const db = await load();
    return db.sessions.find((s) => s.userId === userId && s.id === id) ?? null;
  }

  async listRecentSessions(userId: string, limit: number): Promise<Session[]> {
    const db = await load();
    return db.sessions
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  async listSessionsBetween(
    userId: string,
    startISO: string,
    endISO: string,
  ): Promise<Session[]> {
    const db = await load();
    return db.sessions
      .filter((s) => s.userId === userId && s.date >= startISO && s.date <= endISO)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async saveSession(session: Session): Promise<Session> {
    return mutate((db) => {
      // One session per user per date: replace any existing.
      db.sessions = db.sessions.filter(
        (s) => !(s.userId === session.userId && s.date === session.date),
      );
      db.sessions.push(session);
      return session;
    });
  }

  async updateSession(
    userId: string,
    id: string,
    patch: Partial<
      Pick<Session, "program" | "status" | "feedback" | "planId" | "planDayId">
    >,
  ): Promise<Session> {
    return mutate((db) => {
      const s = db.sessions.find((x) => x.userId === userId && x.id === id);
      if (!s) throw new Error("Session not found");
      Object.assign(s, patch);
      return s;
    });
  }

  // Training plans -----------------------------------------------------------
  async getActivePlan(userId: string): Promise<TrainingPlan | null> {
    const db = await load();
    return (
      db.plans
        .filter((p) => p.userId === userId && p.status === "active")
        .sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0] ?? null
    );
  }

  async getPlan(userId: string, id: string): Promise<TrainingPlan | null> {
    const db = await load();
    return db.plans.find((p) => p.userId === userId && p.id === id) ?? null;
  }

  async savePlan(plan: TrainingPlan): Promise<TrainingPlan> {
    return mutate((db) => {
      // At most one active block per user — archive whatever came before.
      for (const p of db.plans) {
        if (p.userId === plan.userId && p.status === "active" && p.id !== plan.id) {
          p.status = "archived";
        }
      }
      db.plans = db.plans.filter((p) => p.id !== plan.id);
      db.plans.push(plan);
      return plan;
    });
  }

  async updatePlan(
    userId: string,
    id: string,
    patch: Partial<Pick<TrainingPlan, "outline" | "status" | "endsOn">>,
  ): Promise<TrainingPlan> {
    return mutate((db) => {
      const p = db.plans.find((x) => x.userId === userId && x.id === id);
      if (!p) throw new Error("Training plan not found");
      Object.assign(p, patch, { updatedAt: new Date().toISOString() });
      return p;
    });
  }

  // Logged sets --------------------------------------------------------------
  async listLoggedSets(userId: string, exerciseId?: string): Promise<LoggedSet[]> {
    const db = await load();
    return db.loggedSets
      .filter(
        (l) => l.userId === userId && (!exerciseId || l.exerciseId === exerciseId),
      )
      .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  }

  async addLoggedSet(
    userId: string,
    input: Omit<LoggedSet, "id" | "userId" | "loggedAt"> & { loggedAt?: string },
  ): Promise<LoggedSet> {
    return mutate((db) => {
      const { loggedAt, ...rest } = input;
      const row: LoggedSet = {
        id: randomUUID(),
        userId,
        ...rest,
        loggedAt: loggedAt ?? new Date().toISOString(),
        source: rest.source ?? "app",
      };
      db.loggedSets.push(row);
      return row;
    });
  }

  async updateLoggedSet(
    userId: string,
    id: string,
    patch: { weight?: number; reps?: number },
  ): Promise<LoggedSet> {
    return mutate((db) => {
      const s = db.loggedSets.find((x) => x.userId === userId && x.id === id);
      if (!s) throw new Error("Logged set not found");
      if (patch.weight !== undefined) s.weight = patch.weight;
      if (patch.reps !== undefined) s.reps = patch.reps;
      return s;
    });
  }

  async deleteLoggedSet(userId: string, id: string): Promise<void> {
    await mutate((db) => {
      db.loggedSets = db.loggedSets.filter(
        (l) => !(l.userId === userId && l.id === id),
      );
    });
  }

  async clearOnboardingSets(userId: string): Promise<void> {
    await mutate((db) => {
      db.loggedSets = db.loggedSets.filter(
        (l) => !(l.userId === userId && l.source === "onboarding"),
      );
    });
  }

  async lastTimeFor(userId: string, exerciseId: string): Promise<LastTime | null> {
    const db = await load();
    const sets = db.loggedSets
      .filter((l) => l.userId === userId && l.exerciseId === exerciseId)
      .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
    if (sets.length === 0) return null;
    // Group the most recent session's date for this lift.
    const lastDate = sets[0].loggedAt.slice(0, 10);
    const sameDay = sets.filter((s) => s.loggedAt.slice(0, 10) === lastDate);
    // Representative top set = heaviest of that day.
    const top = sameDay.reduce((a, b) => (b.weight > a.weight ? b : a));
    return {
      weight: top.weight,
      reps: top.reps,
      sets: sameDay.length,
      date: lastDate,
    };
  }

  // PRs ----------------------------------------------------------------------
  async listPRs(userId: string, opts?: { onlyCurrent?: boolean }): Promise<PR[]> {
    const db = await load();
    return db.prs
      .filter((p) => p.userId === userId && (!opts?.onlyCurrent || !p.superseded))
      .sort((a, b) => b.dateAchieved.localeCompare(a.dateAchieved));
  }

  async currentPRFor(
    userId: string,
    exerciseId: string,
    bucket: RepBucket,
  ): Promise<PR | null> {
    const db = await load();
    return (
      db.prs.find(
        (p) =>
          p.userId === userId &&
          p.exerciseId === exerciseId &&
          p.repBucket === bucket &&
          !p.superseded,
      ) ?? null
    );
  }

  async considerSetForPR(
    userId: string,
    set: LoggedSet,
  ): Promise<{ pr: PR; isNew: boolean }> {
    return mutate((db) => {
      const bucket = repBucketFor(set.reps);
      const current =
        db.prs.find(
          (p) =>
            p.userId === userId &&
            p.exerciseId === set.exerciseId &&
            p.repBucket === bucket &&
            !p.superseded,
        ) ?? null;

      if (!beatsPR({ weight: set.weight, reps: set.reps }, current)) {
        // Not a PR — return the standing one (or a synthetic non-PR marker).
        return { pr: current!, isNew: false };
      }
      // New bucket PR: retain the old one as history, don't overwrite silently.
      if (current) current.superseded = true;
      const pr: PR = {
        id: randomUUID(),
        userId,
        exerciseId: set.exerciseId,
        exerciseName: set.exerciseName,
        repBucket: bucket,
        weight: set.weight,
        reps: set.reps,
        dateAchieved: set.loggedAt.slice(0, 10),
        superseded: false,
      };
      db.prs.push(pr);
      return { pr, isNew: true };
    });
  }

  async recomputePRsFor(userId: string, exerciseId: string): Promise<void> {
    await mutate((db) => {
      const sets = db.loggedSets
        .filter((l) => l.userId === userId && l.exerciseId === exerciseId)
        .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));

      db.prs = db.prs.filter(
        (p) => !(p.userId === userId && p.exerciseId === exerciseId),
      );
      db.prs.push(...replayPRs(userId, exerciseId, sets));
    });
  }

  // Feedback -----------------------------------------------------------------
  async listFeedback(userId: string): Promise<Feedback[]> {
    const db = await load();
    return db.feedback
      .filter((f) => f.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addFeedback(userId: string, input: FeedbackInput): Promise<Feedback> {
    return mutate((db) => {
      const row: Feedback = {
        id: randomUUID(),
        userId,
        category: input.category,
        message: input.message,
        rating: input.rating ?? null,
        path: input.path,
        appVersion: input.appVersion,
        userAgent: input.userAgent,
        sessionId: input.sessionId,
        status: "new",
        githubIssueNumber: null,
        githubIssueUrl: null,
        createdAt: new Date().toISOString(),
      };
      db.feedback.push(row);
      return row;
    });
  }

  async updateFeedback(
    userId: string,
    id: string,
    patch: Partial<
      Pick<Feedback, "status" | "githubIssueNumber" | "githubIssueUrl">
    >,
  ): Promise<Feedback> {
    return mutate((db) => {
      const row = db.feedback.find((f) => f.userId === userId && f.id === id);
      if (!row) throw new Error("Feedback not found");
      Object.assign(row, patch);
      return row;
    });
  }
}
