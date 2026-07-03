import type { Sample, SelfReport, Session } from "@halo-pulse/types";
import type { HaloPulseDb } from "./db.js";

/** Persists a completed session and its samples together in one transaction. */
export async function saveSession(
  db: HaloPulseDb,
  session: Session,
  samples: Sample[],
): Promise<void> {
  await db.transaction("rw", db.sessions, db.samples, async () => {
    await db.sessions.put(session);
    if (samples.length > 0) {
      await db.samples.bulkPut(samples);
    }
  });
}

export async function listSessions(db: HaloPulseDb, profileId: string): Promise<Session[]> {
  return db.sessions.where("profileId").equals(profileId).sortBy("startedAt");
}

/** Attaches an opt-in post-session self-report (PLAN.md §10 Phase 3) to an already-saved session. */
export async function addSelfReport(
  db: HaloPulseDb,
  sessionId: string,
  selfReport: SelfReport,
): Promise<void> {
  const updated = await db.sessions.update(sessionId, { selfReport });
  if (updated === 0) {
    throw new Error(`addSelfReport: no session found with id ${sessionId}`);
  }
}

export async function getSamplesForSession(db: HaloPulseDb, sessionId: string): Promise<Sample[]> {
  return db.samples.where("sessionId").equals(sessionId).sortBy("t");
}

/**
 * All samples across every session belonging to a profile. Dexie has no join, so this fetches
 * the profile's session ids first and filters a full table scan in JS — fine at personal-app
 * data volumes (ARCHITECTURE.md §6), and shared by rollups/export/history so the "how do I get a
 * profile's samples" logic exists exactly once.
 */
export async function getAllSamplesForProfile(
  db: HaloPulseDb,
  profileId: string,
): Promise<Sample[]> {
  const sessionIds = new Set(await db.sessions.where("profileId").equals(profileId).primaryKeys());
  if (sessionIds.size === 0) return [];
  const allSamples = await db.samples.toArray();
  return allSamples.filter((s) => sessionIds.has(s.sessionId));
}
