import "./testSetup.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HaloPulseDb } from "./db.js";
import { getOrCreateSettings, grantConsent, hasConsent, revokeConsent } from "./settings.js";

let db: HaloPulseDb;

beforeEach(() => {
  db = new HaloPulseDb(`test-settings-${Math.random()}`);
});

afterEach(async () => {
  await db.delete();
});

describe("settings", () => {
  it("creates default settings on first access", async () => {
    const settings = await getOrCreateSettings(db);
    expect(settings.id).toBe("singleton");
    expect(settings.consentGrantedAt).toBeUndefined();
    expect(settings.retentionDays).toBeGreaterThan(0);
  });

  it("returns the same settings record on subsequent calls (not a new default each time)", async () => {
    const first = await getOrCreateSettings(db);
    await grantConsent(db, 1000);
    const second = await getOrCreateSettings(db);
    expect(second.consentGrantedAt).toBe(1000);
    expect(second.id).toBe(first.id);
  });

  it("hasConsent is false until grantConsent is called, then true", async () => {
    expect(await hasConsent(db)).toBe(false);
    await grantConsent(db, 12345);
    expect(await hasConsent(db)).toBe(true);
  });

  it("revokeConsent clears consentGrantedAt", async () => {
    await grantConsent(db, 12345);
    expect(await hasConsent(db)).toBe(true);
    await revokeConsent(db);
    expect(await hasConsent(db)).toBe(false);
  });
});
