import "./testSetup.js";
import type { Baseline } from "@halo-pulse/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getActiveBaseline, listBaselines, saveBaseline } from "./baselines.js";
import { HaloPulseDb } from "./db.js";

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

beforeEach(() => {
  db = new HaloPulseDb(`test-baselines-${Math.random()}`);
});

afterEach(async () => {
  await db.delete();
});

describe("baselines store", () => {
  it("returns undefined when no baseline exists yet", async () => {
    expect(await getActiveBaseline(db, "local")).toBeUndefined();
  });

  it("round-trips a saved baseline", async () => {
    const baseline = makeBaseline({ id: "b1", capturedAt: 100 });
    await saveBaseline(db, baseline);
    const active = await getActiveBaseline(db, "local");
    expect(active).toEqual(baseline);
  });

  it("the most recently captured baseline is the active one", async () => {
    await saveBaseline(db, makeBaseline({ id: "old", capturedAt: 100, hrMean: 60 }));
    await saveBaseline(db, makeBaseline({ id: "new", capturedAt: 500, hrMean: 80 }));
    await saveBaseline(db, makeBaseline({ id: "middle", capturedAt: 300, hrMean: 70 }));

    const active = await getActiveBaseline(db, "local");
    expect(active?.id).toBe("new");
    expect(active?.hrMean).toBe(80);
  });

  it("does not mix up baselines across profiles", async () => {
    await saveBaseline(db, makeBaseline({ id: "a", profileId: "profile-a", capturedAt: 100 }));
    await saveBaseline(db, makeBaseline({ id: "b", profileId: "profile-b", capturedAt: 200 }));

    const activeForA = await getActiveBaseline(db, "profile-a");
    expect(activeForA?.id).toBe("a");
  });

  it("listBaselines returns all baselines for a profile, oldest first", async () => {
    await saveBaseline(db, makeBaseline({ id: "b1", capturedAt: 300 }));
    await saveBaseline(db, makeBaseline({ id: "b2", capturedAt: 100 }));
    await saveBaseline(db, makeBaseline({ id: "b3", capturedAt: 200 }));

    const all = await listBaselines(db, "local");
    expect(all.map((b) => b.id)).toEqual(["b2", "b3", "b1"]);
  });
});
