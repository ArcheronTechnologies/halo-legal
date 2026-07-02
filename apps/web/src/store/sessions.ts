import type { Sample, Session } from "@halo-pulse/types";
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

export async function getSamplesForSession(db: HaloPulseDb, sessionId: string): Promise<Sample[]> {
  return db.samples.where("sessionId").equals(sessionId).sortBy("t");
}
