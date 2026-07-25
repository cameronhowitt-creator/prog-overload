// Local JSON-file implementation of Repository. Zero external dependencies so the
// app runs and can be verified end-to-end with no Supabase project. Server-only
// (uses node:fs). Persists to .data/store.json. Seeds on first init.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

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
import { beatsPR, DEFAULT_SESSION_MINUTES, repBucketFor } from "../domain/heuristics";
import { SEED_EXCLUSION, SEED_EXERCISES } from "../seed/exercises";
import type { Repository } from "./repo";

interface DBShape {
  profiles: Profile[];
  exclusions: Exclusion[];
  overrides: LocationOverride[];
  exercises: Exercise[];
  sessions: Session[];
  loggedSets: LoggedSet[];
  prs: PR[];
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
    seededUsers: [],
  };
}

// Serialize all reads/writes through a single promise chain to avoid interleaved
// read-modify-write races within this process.
let writeChain: Promise<void> = Promise.resolve();
let cache: DBShape | null = null;

async function load(): Promise<DBShape> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as DBShape;
    // Always refresh the exercise library from seed so library edits ship without
    // a data migration (the library is code-owned; user data is not).
    parsed.exercises = SEED_EXERCISES;
    cache = parsed;
  } catch {
    cache = emptyDB();
  }
  return cache;
}

async function persist(db: DBShape): Promise<void> {
  cache = db;
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
  if (!db.profiles.find((p) => p.userId === userId)) {
    db.profiles.push({
      userId,
      sessionLengthMin: DEFAULT_SESSION_MINUTES,
      goals: ["Progressive overload strength", "Hypertrophy"],
      defaultEquipmentContext: "Full gym",
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
      return db.profiles.find((p) => p.userId === userId)!;
    });
  }

  async updateProfile(
    userId: string,
    patch: Partial<Omit<Profile, "userId">>,
  ): Promise<Profile> {
    return mutate((db) => {
      ensureSeeded(db, userId);
      const p = db.profiles.find((x) => x.userId === userId)!;
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
    return mutate((db) => {
      const active = db.overrides.filter(
        (o) => o.userId === userId && o.startsOn <= dateISO && o.expiresOn >= dateISO,
      );
      // Most recently started active override wins.
      active.sort((a, b) => b.startsOn.localeCompare(a.startsOn));
      return active[0] ?? null;
    });
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
    patch: Partial<Pick<Session, "program" | "status">>,
  ): Promise<Session> {
    return mutate((db) => {
      const s = db.sessions.find((x) => x.userId === userId && x.id === id);
      if (!s) throw new Error("Session not found");
      Object.assign(s, patch);
      return s;
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
    input: Omit<LoggedSet, "id" | "userId" | "loggedAt">,
  ): Promise<LoggedSet> {
    return mutate((db) => {
      const row: LoggedSet = {
        id: randomUUID(),
        userId,
        loggedAt: new Date().toISOString(),
        ...input,
      };
      db.loggedSets.push(row);
      return row;
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
}
