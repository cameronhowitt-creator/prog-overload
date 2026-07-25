// Supabase/Postgres implementation of Repository (PRD §8). Production/multi-user
// backend. Uses the service-role client on the server and scopes EVERY query by
// user_id; RLS additionally protects any client-side (anon) access. Enable with
// DATA_BACKEND=supabase. The local JSON store remains the zero-setup default.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

// ── row <-> domain mappers ────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const toExclusion = (r: any): Exclusion => ({
  id: r.id,
  userId: r.user_id,
  exerciseId: r.exercise_id,
  exerciseName: r.exercise_name,
  reason: r.reason,
  createdAt: r.created_at,
});
const toOverride = (r: any): LocationOverride => ({
  id: r.id,
  userId: r.user_id,
  context: r.context,
  startsOn: r.starts_on,
  expiresOn: r.expires_on,
  createdAt: r.created_at,
});
const toExercise = (r: any): Exercise => ({
  id: r.id,
  name: r.name,
  muscleGroups: r.muscle_groups ?? [],
  category: r.category,
  equipment: r.equipment,
  defaultCues: r.default_cues ?? [],
  isCoreLift: r.is_core_lift ?? undefined,
  correctiveGoal: r.corrective_goal ?? undefined,
});
const toSession = (r: any): Session => ({
  id: r.id,
  userId: r.user_id,
  date: r.date,
  program: r.program,
  status: r.status,
  createdAt: r.created_at,
});
const toLoggedSet = (r: any): LoggedSet => ({
  id: r.id,
  userId: r.user_id,
  sessionId: r.session_id,
  exerciseId: r.exercise_id,
  exerciseName: r.exercise_name,
  setIndex: r.set_index,
  weight: Number(r.weight),
  reps: r.reps,
  loggedAt: r.logged_at,
  source: r.source ?? "app",
});
const toPR = (r: any): PR => ({
  id: r.id,
  userId: r.user_id,
  exerciseId: r.exercise_id,
  exerciseName: r.exercise_name,
  repBucket: r.rep_bucket,
  weight: Number(r.weight),
  reps: r.reps,
  dateAchieved: r.date_achieved,
  superseded: r.superseded,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export class SupabaseStore implements Repository {
  private db: SupabaseClient;

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "SupabaseStore requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      );
    }
    this.db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  // Profile ------------------------------------------------------------------
  // Note: the profiles PK column is `user_id` (from 0001_init). It maps to the
  // domain Profile.id. Active lifts live in their own `user_active_lifts` table.
  private async fetchActiveLifts(userId: string): Promise<string[]> {
    const { data } = await this.db
      .from("user_active_lifts")
      .select("exercise_id")
      .eq("user_id", userId);
    return (data ?? []).map((r) => r.exercise_id);
  }

  private rowToProfile(r: any, activeLifts: string[]): Profile {
    return {
      id: r.user_id,
      name: r.name ?? undefined,
      age: r.age ?? undefined,
      heightCm: r.height_cm != null ? Number(r.height_cm) : undefined,
      weightKg: r.weight_kg != null ? Number(r.weight_kg) : undefined,
      primaryGoal: r.primary_goal ?? undefined,
      experienceLevel: r.experience_level ?? undefined,
      daysPerWeek: r.days_per_week ?? undefined,
      sessionDurationMinutes: r.session_duration_minutes ?? undefined,
      equipmentAccess: r.equipment_access ?? undefined,
      injuryFlags: r.injury_flags ?? [],
      mobilityFlags: r.mobility_flags ?? [],
      medicalClearanceStatus: r.medical_clearance_status ?? undefined,
      pregnancyPostpartumStatus: r.pregnancy_postpartum_status ?? undefined,
      cycleTrackingOptIn: r.cycle_tracking_opt_in ?? false,
      cycleLengthDays: r.cycle_length_days ?? undefined,
      typicalSleepHours: r.typical_sleep_hours != null ? Number(r.typical_sleep_hours) : undefined,
      stressLevel: r.stress_level ?? undefined,
      activityOutsideGym: r.activity_outside_gym ?? undefined,
      creatineStatus: r.creatine_status ?? undefined,
      dislikedExercises: r.disliked_exercises ?? [],
      onboardingCompletedAt: r.onboarding_completed_at ?? null,
      userActiveLifts: activeLifts,
    };
  }

  async getProfile(userId: string): Promise<Profile> {
    const { data } = await this.db
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      return this.rowToProfile(data, await this.fetchActiveLifts(userId));
    }
    // First touch: seed the profile + the single standing exclusion (PRD §6.1).
    await this.db.from("profiles").insert({
      user_id: userId,
      session_duration_minutes: DEFAULT_SESSION_MINUTES,
      equipment_access: "full_gym",
    });
    await this.db.from("exclusions").insert({
      user_id: userId,
      exercise_id: SEED_EXCLUSION.exerciseId,
      exercise_name: SEED_EXCLUSION.exerciseName,
      reason: SEED_EXCLUSION.reason,
    });
    return {
      id: userId,
      sessionDurationMinutes: DEFAULT_SESSION_MINUTES,
      equipmentAccess: "full_gym",
      injuryFlags: [],
      mobilityFlags: [],
      dislikedExercises: [],
      onboardingCompletedAt: null,
      userActiveLifts: [],
    };
  }

  async updateProfile(
    userId: string,
    patch: Partial<Omit<Profile, "id">>,
  ): Promise<Profile> {
    await this.getProfile(userId); // ensure it exists

    // Active lifts live in their own table — sync it separately (PRD §6.6).
    if (patch.userActiveLifts !== undefined) {
      await this.db.from("user_active_lifts").delete().eq("user_id", userId);
      if (patch.userActiveLifts.length > 0) {
        await this.db.from("user_active_lifts").insert(
          patch.userActiveLifts.map((exercise_id) => ({ user_id: userId, exercise_id })),
        );
      }
    }

    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const map: [keyof Omit<Profile, "id">, string][] = [
      ["name", "name"],
      ["age", "age"],
      ["heightCm", "height_cm"],
      ["weightKg", "weight_kg"],
      ["primaryGoal", "primary_goal"],
      ["experienceLevel", "experience_level"],
      ["daysPerWeek", "days_per_week"],
      ["sessionDurationMinutes", "session_duration_minutes"],
      ["equipmentAccess", "equipment_access"],
      ["injuryFlags", "injury_flags"],
      ["mobilityFlags", "mobility_flags"],
      ["medicalClearanceStatus", "medical_clearance_status"],
      ["pregnancyPostpartumStatus", "pregnancy_postpartum_status"],
      ["cycleTrackingOptIn", "cycle_tracking_opt_in"],
      ["cycleLengthDays", "cycle_length_days"],
      ["typicalSleepHours", "typical_sleep_hours"],
      ["stressLevel", "stress_level"],
      ["activityOutsideGym", "activity_outside_gym"],
      ["creatineStatus", "creatine_status"],
      ["dislikedExercises", "disliked_exercises"],
      ["onboardingCompletedAt", "onboarding_completed_at"],
    ];
    for (const [key, col] of map) {
      if (patch[key] !== undefined) row[col] = patch[key];
    }
    await this.db.from("profiles").update(row).eq("user_id", userId);
    return this.getProfile(userId);
  }

  // Exclusions ---------------------------------------------------------------
  async listExclusions(userId: string): Promise<Exclusion[]> {
    await this.getProfile(userId);
    const { data } = await this.db
      .from("exclusions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    return (data ?? []).map(toExclusion);
  }

  async addExclusion(
    userId: string,
    input: { exerciseId: string | null; exerciseName: string; reason: string },
  ): Promise<Exclusion> {
    const existing = await this.listExclusions(userId);
    const dup = existing.find(
      (e) =>
        (input.exerciseId && e.exerciseId === input.exerciseId) ||
        e.exerciseName.toLowerCase() === input.exerciseName.toLowerCase(),
    );
    if (dup) {
      await this.db.from("exclusions").update({ reason: input.reason }).eq("id", dup.id);
      return { ...dup, reason: input.reason };
    }
    const { data } = await this.db
      .from("exclusions")
      .insert({
        user_id: userId,
        exercise_id: input.exerciseId,
        exercise_name: input.exerciseName,
        reason: input.reason,
      })
      .select("*")
      .single();
    return toExclusion(data);
  }

  async removeExclusion(userId: string, id: string): Promise<void> {
    await this.db.from("exclusions").delete().eq("user_id", userId).eq("id", id);
  }

  // Overrides ----------------------------------------------------------------
  async listOverrides(userId: string): Promise<LocationOverride[]> {
    const { data } = await this.db
      .from("location_overrides")
      .select("*")
      .eq("user_id", userId)
      .order("starts_on", { ascending: false });
    return (data ?? []).map(toOverride);
  }

  async getActiveOverride(
    userId: string,
    dateISO: string,
  ): Promise<LocationOverride | null> {
    const { data } = await this.db
      .from("location_overrides")
      .select("*")
      .eq("user_id", userId)
      .lte("starts_on", dateISO)
      .gte("expires_on", dateISO)
      .order("starts_on", { ascending: false })
      .limit(1);
    return data && data[0] ? toOverride(data[0]) : null;
  }

  async addOverride(
    userId: string,
    input: { context: string; startsOn: string; expiresOn: string },
  ): Promise<LocationOverride> {
    const { data } = await this.db
      .from("location_overrides")
      .insert({
        user_id: userId,
        context: input.context,
        starts_on: input.startsOn,
        expires_on: input.expiresOn,
      })
      .select("*")
      .single();
    return toOverride(data);
  }

  async removeOverride(userId: string, id: string): Promise<void> {
    await this.db.from("location_overrides").delete().eq("user_id", userId).eq("id", id);
  }

  // Exercises (global catalog) -----------------------------------------------
  async listExercises(): Promise<Exercise[]> {
    const { data } = await this.db.from("exercises").select("*");
    // Resilience: if the table hasn't been seeded yet, use the code seed so the
    // app still works before setup-supabase runs.
    if (!data || data.length === 0) return SEED_EXERCISES;
    return data.map(toExercise);
  }

  async getExercise(id: string): Promise<Exercise | null> {
    const { data } = await this.db.from("exercises").select("*").eq("id", id).maybeSingle();
    if (data) return toExercise(data);
    return SEED_EXERCISES.find((e) => e.id === id) ?? null;
  }

  // Sessions -----------------------------------------------------------------
  async getSessionForDate(userId: string, dateISO: string): Promise<Session | null> {
    const { data } = await this.db
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("date", dateISO)
      .maybeSingle();
    return data ? toSession(data) : null;
  }

  async getSession(userId: string, id: string): Promise<Session | null> {
    const { data } = await this.db
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    return data ? toSession(data) : null;
  }

  async listRecentSessions(userId: string, limit: number): Promise<Session[]> {
    const { data } = await this.db
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(limit);
    return (data ?? []).map(toSession);
  }

  async saveSession(session: Session): Promise<Session> {
    // Upsert on the (user_id, date) unique constraint — one session per day.
    await this.db.from("sessions").upsert(
      {
        id: session.id,
        user_id: session.userId,
        date: session.date,
        program: session.program,
        status: session.status,
        created_at: session.createdAt,
      },
      { onConflict: "user_id,date" },
    );
    return (await this.getSessionForDate(session.userId, session.date)) ?? session;
  }

  async updateSession(
    userId: string,
    id: string,
    patch: Partial<Pick<Session, "program" | "status">>,
  ): Promise<Session> {
    const row: Record<string, unknown> = {};
    if (patch.program !== undefined) row.program = patch.program;
    if (patch.status !== undefined) row.status = patch.status;
    await this.db.from("sessions").update(row).eq("user_id", userId).eq("id", id);
    const s = await this.getSession(userId, id);
    if (!s) throw new Error("Session not found");
    return s;
  }

  // Logged sets --------------------------------------------------------------
  async listLoggedSets(userId: string, exerciseId?: string): Promise<LoggedSet[]> {
    let q = this.db
      .from("logged_sets")
      .select("*")
      .eq("user_id", userId)
      .order("logged_at", { ascending: true });
    if (exerciseId) q = q.eq("exercise_id", exerciseId);
    const { data } = await q;
    return (data ?? []).map(toLoggedSet);
  }

  async addLoggedSet(
    userId: string,
    input: Omit<LoggedSet, "id" | "userId" | "loggedAt"> & { loggedAt?: string },
  ): Promise<LoggedSet> {
    const { data } = await this.db
      .from("logged_sets")
      .insert({
        id: randomUUID(),
        user_id: userId,
        session_id: input.sessionId,
        exercise_id: input.exerciseId,
        exercise_name: input.exerciseName,
        set_index: input.setIndex,
        weight: input.weight,
        reps: input.reps,
        source: input.source ?? "app",
        ...(input.loggedAt ? { logged_at: input.loggedAt } : {}),
      })
      .select("*")
      .single();
    return toLoggedSet(data);
  }

  async clearOnboardingSets(userId: string): Promise<void> {
    await this.db
      .from("logged_sets")
      .delete()
      .eq("user_id", userId)
      .eq("source", "onboarding");
  }

  async lastTimeFor(userId: string, exerciseId: string): Promise<LastTime | null> {
    const { data } = await this.db
      .from("logged_sets")
      .select("*")
      .eq("user_id", userId)
      .eq("exercise_id", exerciseId)
      .order("logged_at", { ascending: false })
      .limit(20);
    if (!data || data.length === 0) return null;
    const sets = data.map(toLoggedSet);
    const lastDate = sets[0].loggedAt.slice(0, 10);
    const sameDay = sets.filter((s) => s.loggedAt.slice(0, 10) === lastDate);
    const top = sameDay.reduce((a, b) => (b.weight > a.weight ? b : a));
    return { weight: top.weight, reps: top.reps, sets: sameDay.length, date: lastDate };
  }

  // PRs ----------------------------------------------------------------------
  async listPRs(userId: string, opts?: { onlyCurrent?: boolean }): Promise<PR[]> {
    let q = this.db.from("prs").select("*").eq("user_id", userId);
    if (opts?.onlyCurrent) q = q.eq("superseded", false);
    const { data } = await q.order("date_achieved", { ascending: false });
    return (data ?? []).map(toPR);
  }

  async currentPRFor(
    userId: string,
    exerciseId: string,
    bucket: RepBucket,
  ): Promise<PR | null> {
    const { data } = await this.db
      .from("prs")
      .select("*")
      .eq("user_id", userId)
      .eq("exercise_id", exerciseId)
      .eq("rep_bucket", bucket)
      .eq("superseded", false)
      .maybeSingle();
    return data ? toPR(data) : null;
  }

  async considerSetForPR(
    userId: string,
    set: LoggedSet,
  ): Promise<{ pr: PR; isNew: boolean }> {
    const bucket = repBucketFor(set.reps);
    const current = await this.currentPRFor(userId, set.exerciseId, bucket);
    if (!beatsPR({ weight: set.weight, reps: set.reps }, current)) {
      return { pr: current!, isNew: false };
    }
    if (current) {
      await this.db.from("prs").update({ superseded: true }).eq("id", current.id);
    }
    const { data } = await this.db
      .from("prs")
      .insert({
        user_id: userId,
        exercise_id: set.exerciseId,
        exercise_name: set.exerciseName,
        rep_bucket: bucket,
        weight: set.weight,
        reps: set.reps,
        date_achieved: set.loggedAt.slice(0, 10),
        superseded: false,
      })
      .select("*")
      .single();
    return { pr: toPR(data), isNew: true };
  }
}
