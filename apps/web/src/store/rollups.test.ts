import "./testSetup.js";
import type { Sample, Session } from "@halo-pulse/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HaloPulseDb } from "./db.js";
import { computeRollups, dayKeyFor, listRollups, recomputeRollups, rollupId } from "./rollups.js";
import { saveSession } from "./sessions.js";

describe("dayKeyFor", () => {
  it("formats a UTC-noon timestamp as YYYY-MM-DD with zero-padding", () => {
    expect(dayKeyFor(Date.UTC(2026, 3, 5, 12, 0, 0))).toBe("2026-04-05");
  });
});

describe("rollupId", () => {
  it("combines profileId and day", () => {
    expect(rollupId("local", "2026-01-01")).toBe("local:2026-01-01");
  });
});

describe("computeRollups", () => {
  const day1 = Date.UTC(2026, 0, 1, 12, 0, 0);
  const day2 = Date.UTC(2026, 0, 2, 12, 0, 0);

  it("groups samples by local day and averages stressIndex within each day", () => {
    // day1: [40, 60] -> mean 50, count 2. day2: [90] -> mean 90, count 1.
    const rollups = computeRollups("local", [
      { t: day1, stressIndex: 40 },
      { t: day1, stressIndex: 60 },
      { t: day2, stressIndex: 90 },
    ]);

    expect(rollups).toHaveLength(2);
    expect(rollups[0]).toMatchObject({ day: "2026-01-01", meanStressIndex: 50, sampleCount: 2 });
    expect(rollups[1]).toMatchObject({ day: "2026-01-02", meanStressIndex: 90, sampleCount: 1 });
  });

  it("sorts output ascending by day regardless of input order", () => {
    const rollups = computeRollups("local", [
      { t: day2, stressIndex: 10 },
      { t: day1, stressIndex: 10 },
    ]);
    expect(rollups.map((r) => r.day)).toEqual(["2026-01-01", "2026-01-02"]);
  });

  it("returns an empty array for no samples", () => {
    expect(computeRollups("local", [])).toEqual([]);
  });

  it("produces ids of the form profileId:day", () => {
    const rollups = computeRollups("local", [{ t: day1, stressIndex: 50 }]);
    expect(rollups[0]?.id).toBe("local:2026-01-01");
  });
});

let db: HaloPulseDb;

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

function makeSample(sessionId: string, t: number, stressIndex: number): Sample {
  return {
    id: `sample-${sessionId}-${t}-${Math.random()}`,
    sessionId,
    t,
    hr: 70,
    behavioural: { blinkDeviation: 0, browTension: 0.1, lidTension: 0.1, lipTension: 0.1 },
    sqi: 0.7,
    stressIndex,
    confidence: 0.7,
  };
}

beforeEach(() => {
  db = new HaloPulseDb(`test-rollups-${Math.random()}`);
});

afterEach(async () => {
  await db.delete();
});

describe("recomputeRollups (store)", () => {
  const day1 = Date.UTC(2026, 0, 1, 12, 0, 0);
  const day2 = Date.UTC(2026, 0, 2, 12, 0, 0);

  it("aggregates samples across multiple sessions into daily rollups", async () => {
    await saveSession(db, makeSession({ id: "s1" }), [
      makeSample("s1", day1, 30),
      makeSample("s1", day1 + 1000, 50),
    ]);
    await saveSession(db, makeSession({ id: "s2" }), [makeSample("s2", day2, 80)]);

    const rollups = await recomputeRollups(db, "local");
    expect(rollups).toHaveLength(2);
    expect(rollups[0]).toMatchObject({ day: "2026-01-01", meanStressIndex: 40, sampleCount: 2 });
    expect(rollups[1]).toMatchObject({ day: "2026-01-02", meanStressIndex: 80, sampleCount: 1 });

    const listed = await listRollups(db, "local");
    expect(listed).toEqual(rollups);
  });

  it("replaces stale rollups on recompute rather than accumulating duplicates", async () => {
    await saveSession(db, makeSession({ id: "s1" }), [makeSample("s1", day1, 50)]);
    await recomputeRollups(db, "local");
    await recomputeRollups(db, "local");

    const listed = await listRollups(db, "local");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.sampleCount).toBe(1);
  });

  it("returns an empty list when the profile has no sessions", async () => {
    const rollups = await recomputeRollups(db, "local");
    expect(rollups).toEqual([]);
  });
});
