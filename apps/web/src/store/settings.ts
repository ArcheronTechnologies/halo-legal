import type { Settings } from "@halo-pulse/types";
import type { HaloPulseDb } from "./db.js";

const SETTINGS_ID = "singleton" as const;

function defaultSettings(): Settings {
  return {
    id: SETTINGS_ID,
    retentionDays: 90,
    sensitivity: 0.5,
    theme: "system",
    featureFlags: {},
  };
}

export async function getOrCreateSettings(db: HaloPulseDb): Promise<Settings> {
  const existing = await db.settings.get(SETTINGS_ID);
  if (existing) return existing;
  const created = defaultSettings();
  await db.settings.put(created);
  return created;
}

export async function hasConsent(db: HaloPulseDb): Promise<boolean> {
  const settings = await getOrCreateSettings(db);
  return settings.consentGrantedAt !== undefined;
}

/** Explicit, revocable consent before first capture — PLAN.md §7. `grantedAt` is injectable for tests. */
export async function grantConsent(db: HaloPulseDb, grantedAt: number): Promise<Settings> {
  const settings = await getOrCreateSettings(db);
  const updated: Settings = { ...settings, consentGrantedAt: grantedAt };
  await db.settings.put(updated);
  return updated;
}

export async function revokeConsent(db: HaloPulseDb): Promise<Settings> {
  const settings = await getOrCreateSettings(db);
  const updated: Settings = { ...settings, consentGrantedAt: undefined };
  await db.settings.put(updated);
  return updated;
}
