// Rebuild a lift's PR rows by replaying its logged sets chronologically through
// the same beatsPR rule the incremental considerSetForPR path uses.
//
// Needed because PRs are computed incrementally: lowering or deleting the set that
// SET a PR can't be undone by the incremental path, which only ever ratchets
// upward. After any edit or delete, the affected lift's PRs are rebuilt from
// scratch. Beaten PRs are still retained as superseded history, so the result is
// byte-for-byte what incremental logging would have produced.
//
// Shared by both Repository implementations so they can't drift.

import { randomUUID } from "node:crypto";

import { beatsPR, repBucketFor } from "../domain/heuristics";
import type { LoggedSet, PR, RepBucket } from "../domain/types";

export function replayPRs(
  userId: string,
  exerciseId: string,
  setsAscending: LoggedSet[],
): PR[] {
  const out: PR[] = [];
  const current = new Map<RepBucket, PR>();

  for (const set of setsAscending) {
    const bucket = repBucketFor(set.reps);
    const standing = current.get(bucket) ?? null;
    if (!beatsPR({ weight: set.weight, reps: set.reps }, standing)) continue;
    if (standing) standing.superseded = true;
    const pr: PR = {
      id: randomUUID(),
      userId,
      exerciseId,
      exerciseName: set.exerciseName,
      repBucket: bucket,
      weight: set.weight,
      reps: set.reps,
      dateAchieved: set.loggedAt.slice(0, 10),
      superseded: false,
    };
    current.set(bucket, pr);
    out.push(pr);
  }
  return out;
}
