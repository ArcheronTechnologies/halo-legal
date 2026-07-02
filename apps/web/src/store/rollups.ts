import type { Rollup, Sample } from "@halo-pulse/types";
import type { HaloPulseDb } from "./db.js";
import { getAllSamplesForProfile } from "./sessions.js";

/**
 * Local-calendar-day key (YYYY-MM-DD) for a sample timestamp. Deliberately the *browser's* local
 * day, not UTC — this feeds a "which days were rough / what time of day" view of the user's own
 * life (PLAN.md §6 "the development requirement"), so it should match how the user experiences
 * their day, not an arbitrary UTC cutover at whatever their local afternoon/evening is.
 */
export function dayKeyFor(timestampMs: number): string {
  const d = new Date(timestampMs);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function rollupId(profileId: string, day: string): string {
  return `${profileId}:${day}`;
}

/** Pure aggregation: samples -> one Rollup per local calendar day, sorted ascending by day. */
export function computeRollups(
  profileId: string,
  samples: Pick<Sample, "t" | "stressIndex">[],
): Rollup[] {
  const byDay = new Map<string, { sum: number; count: number }>();
  for (const sample of samples) {
    const day = dayKeyFor(sample.t);
    const bucket = byDay.get(day) ?? { sum: 0, count: 0 };
    bucket.sum += sample.stressIndex;
    bucket.count += 1;
    byDay.set(day, bucket);
  }

  return Array.from(byDay.entries())
    .map(([day, { sum, count }]) => ({
      id: rollupId(profileId, day),
      profileId,
      day,
      meanStressIndex: sum / count,
      sampleCount: count,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Recomputes every rollup for a profile from scratch and replaces what's stored. Simple and
 * always-correct rather than incremental — personal local data volumes (a wellness app, one
 * device) stay small enough that a full recompute on every session save is cheap, and it avoids
 * an entire class of drift bugs that incremental delta-merging across edits/deletes would risk.
 */
export async function recomputeRollups(db: HaloPulseDb, profileId: string): Promise<Rollup[]> {
  const samples = await getAllSamplesForProfile(db, profileId);
  const rollups = computeRollups(profileId, samples);

  await db.transaction("rw", db.rollups, async () => {
    const existingKeys = await db.rollups.where("profileId").equals(profileId).primaryKeys();
    await db.rollups.bulkDelete(existingKeys);
    if (rollups.length > 0) {
      await db.rollups.bulkAdd(rollups);
    }
  });

  return rollups;
}

export async function listRollups(db: HaloPulseDb, profileId: string): Promise<Rollup[]> {
  return db.rollups.where("profileId").equals(profileId).sortBy("day");
}
