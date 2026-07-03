import { type ExportBundle, exportBundleSchema } from "@halo-pulse/types";
import type { HaloPulseDb } from "./db.js";
import { getAllSamplesForProfile } from "./sessions.js";
import { getOrCreateSettings } from "./settings.js";

/**
 * Gathers everything for a profile into the export bundle (PLAN.md §7 "one-tap export"),
 * validated against exportBundleSchema so a malformed export is a loud error, never a silent
 * bad file.
 */
export async function buildExportBundle(
  db: HaloPulseDb,
  profileId: string,
  exportedAt: number,
): Promise<ExportBundle> {
  const baselines = await db.baselines.where("profileId").equals(profileId).sortBy("capturedAt");
  const sessions = await db.sessions.where("profileId").equals(profileId).sortBy("startedAt");
  const settings = await getOrCreateSettings(db);
  const samples = await getAllSamplesForProfile(db, profileId);

  return exportBundleSchema.parse({
    exportedAt,
    schemaVersion: 1,
    baselines,
    sessions,
    samples,
    settings,
  });
}

/**
 * Deletes every baseline/session/sample for a profile — the "delete everything" half of PLAN.md
 * §7's data-control promise. Deliberately does not touch `settings`/consent: consent is a
 * permission, not data, and is revoked separately via `revokeConsent` so the two actions stay
 * single-purpose and neither silently does the other's job.
 */
export async function deleteAllData(db: HaloPulseDb, profileId: string): Promise<void> {
  await db.transaction("rw", db.baselines, db.sessions, db.samples, async () => {
    const sessionIds = await db.sessions.where("profileId").equals(profileId).primaryKeys();
    if (sessionIds.length > 0) {
      await db.samples.where("sessionId").anyOf(sessionIds).delete();
    }
    await db.sessions.where("profileId").equals(profileId).delete();
    await db.baselines.where("profileId").equals(profileId).delete();
  });
}
