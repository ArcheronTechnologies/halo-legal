import type { Baseline } from "@halo-pulse/types";
import type { HaloPulseDb } from "./db.js";

export async function saveBaseline(db: HaloPulseDb, baseline: Baseline): Promise<void> {
  await db.baselines.put(baseline);
}

/** The most recently captured baseline for a profile is the "active" one — no separate pointer. */
export async function getActiveBaseline(
  db: HaloPulseDb,
  profileId: string,
): Promise<Baseline | undefined> {
  const candidates = await db.baselines.where("profileId").equals(profileId).toArray();
  if (candidates.length === 0) return undefined;
  return candidates.reduce((latest, b) => (b.capturedAt > latest.capturedAt ? b : latest));
}

export async function listBaselines(db: HaloPulseDb, profileId: string): Promise<Baseline[]> {
  return db.baselines.where("profileId").equals(profileId).sortBy("capturedAt");
}
