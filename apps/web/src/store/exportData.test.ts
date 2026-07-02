import "./testSetup.js";
import type { Baseline, Sample, Session } from "@halo-pulse/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getActiveBaseline } from "./baselines.js";
import { HaloPulseDb } from "./db.js";
import { buildExportBundle, deleteAllData } from "./exportData.js";
import { recomputeRollups } from "./rollups.js";
import { saveSession } from "./sessions.js";
import { grantConsent } from "./settings.js";

let db: HaloPulseDb;

function makeBaseline(overrides: Partial<Baseline>): Baseline {
  return {
    id: `b-${Math.random()}`,
    profileId: "local",
    capturedAt: 0,
    version: 1,
    hrMean: 70,
    hrSd: 5,
    rmssdMean: 40,
    rmssdSd: 8,
    sdnnMean: 50,
    sdnnSd: 10,
    lfhfMean: null,
    lfhfSd: null,
    blinkRateMean: 0.2,
    blinkRateSd: 0.05,
    browTensionMean: 0.1,
    browTensionSd: 0.05,
    lidTensionMean: 0.1,
    lidTensionSd: 0.05,
    lipTensionMean: 0.1,
    lipTensionSd: 0.05,
    windowCount: 10,
    captureConditions: {},
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session>): Session {
  return {
    id: `s-${Math.random()}`,
    profileId: "local",
    startedAt: 0,
    endedAt: 60,
    baselineId: "b1",
    signalLayers: ["classical"],
    stressIndexMean: 50,
    stressIndexMedian: 50,
    stressIndexPeak: 60,
    hrMean: 70,
    hrvSummary: { rmssd: 40, sdnn: 50, lfhf: null },
    sqiMean: 0.7,
    ...overrides,
  };
}

function makeSample(sessionId: string, t: number): Sample {
  return {
    id: `sample-${sessionId}-${t}-${Math.random()}`,
    sessionId,
    t,
    hr: 70,
    behavioural: { blinkDeviation: 0, browTension: 0.1, lidTension: 0.1, lipTension: 0.1 },
    sqi: 0.7,
    stressIndex: 50,
    confidence: 0.7,
  };
}

beforeEach(() => {
  db = new HaloPulseDb(`test-export-${Math.random()}`);
});

afterEach(async () => {
  await db.delete();
});

describe("buildExportBundle", () => {
  it("gathers baselines, sessions, samples, and settings for a profile into a valid bundle", async () => {
    await db.baselines.put(makeBaseline({ id: "b1" }));
    await saveSession(db, makeSession({ id: "s1", baselineId: "b1" }), [
      makeSample("s1", 0),
      makeSample("s1", 30),
    ]);
    await grantConsent(db, 12345);

    const bundle = await buildExportBundle(db, "local", 99999);

    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.exportedAt).toBe(99999);
    expect(bundle.baselines).toHaveLength(1);
    expect(bundle.sessions).toHaveLength(1);
    expect(bundle.samples).toHaveLength(2);
    expect(bundle.settings.consentGrantedAt).toBe(12345);
  });

  it("excludes samples belonging to sessions from a different profile", async () => {
    await saveSession(db, makeSession({ id: "s-a", profileId: "profile-a" }), [
      makeSample("s-a", 0),
    ]);
    await saveSession(db, makeSession({ id: "s-b", profileId: "profile-b" }), [
      makeSample("s-b", 0),
    ]);

    const bundle = await buildExportBundle(db, "profile-a", 0);
    expect(bundle.sessions).toHaveLength(1);
    expect(bundle.samples).toHaveLength(1);
    expect(bundle.samples[0]?.sessionId).toBe("s-a");
  });

  it("produces an empty-but-valid bundle when there is no data yet", async () => {
    const bundle = await buildExportBundle(db, "local", 0);
    expect(bundle.baselines).toEqual([]);
    expect(bundle.sessions).toEqual([]);
    expect(bundle.samples).toEqual([]);
  });
});

describe("deleteAllData", () => {
  it("removes baselines, sessions, samples, and rollups for the profile", async () => {
    await db.baselines.put(makeBaseline({ id: "b1" }));
    await saveSession(db, makeSession({ id: "s1" }), [makeSample("s1", 0)]);
    await recomputeRollups(db, "local");

    expect(await db.rollups.where("profileId").equals("local").count()).toBeGreaterThan(0);

    await deleteAllData(db, "local");

    expect(await getActiveBaseline(db, "local")).toBeUndefined();
    expect(await db.sessions.where("profileId").equals("local").count()).toBe(0);
    expect(await db.samples.count()).toBe(0);
    expect(await db.rollups.where("profileId").equals("local").count()).toBe(0);
  });

  it("does not touch settings/consent", async () => {
    await grantConsent(db, 12345);
    await deleteAllData(db, "local");
    const settings = await db.settings.get("singleton");
    expect(settings?.consentGrantedAt).toBe(12345);
  });

  it("does not delete another profile's data", async () => {
    await saveSession(db, makeSession({ id: "s-a", profileId: "profile-a" }), [
      makeSample("s-a", 0),
    ]);
    await saveSession(db, makeSession({ id: "s-b", profileId: "profile-b" }), [
      makeSample("s-b", 0),
    ]);

    await deleteAllData(db, "profile-a");

    expect(await db.sessions.where("profileId").equals("profile-a").count()).toBe(0);
    expect(await db.sessions.where("profileId").equals("profile-b").count()).toBe(1);
    expect(await db.samples.count()).toBe(1);
  });

  it("handles a profile with no data without error", async () => {
    await expect(deleteAllData(db, "local")).resolves.not.toThrow();
  });
});
