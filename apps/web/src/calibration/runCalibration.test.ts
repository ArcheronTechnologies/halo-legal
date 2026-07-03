import "../store/testSetup.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getActiveBaseline } from "../store/baselines.js";
import { HaloPulseDb } from "../store/db.js";
import type { CalibrationResult } from "./collector.js";
import { finalizeCalibration } from "./runCalibration.js";

let db: HaloPulseDb;

beforeEach(() => {
  db = new HaloPulseDb(`test-calibration-${Math.random()}`);
});

afterEach(async () => {
  await db.delete();
});

describe("finalizeCalibration", () => {
  it("computes and persists a baseline from a successful collection", async () => {
    const result: CalibrationResult = {
      success: true,
      features: [
        {
          hr: 68,
          rmssd: 38,
          sdnn: 48,
          lfhf: null,
          browTension: 0.1,
          lidTension: 0.1,
          lipTension: 0.1,
          blinkRateHz: 0.2,
          sqi: 0.8,
        },
        {
          hr: 72,
          rmssd: 42,
          sdnn: 52,
          lfhf: null,
          browTension: 0.12,
          lidTension: 0.09,
          lipTension: 0.11,
          blinkRateHz: 0.22,
          sqi: 0.75,
        },
        {
          hr: 70,
          rmssd: 40,
          sdnn: 50,
          lfhf: null,
          browTension: 0.11,
          lidTension: 0.1,
          lipTension: 0.1,
          blinkRateHz: 0.21,
          sqi: 0.82,
        },
      ],
    };

    const outcome = await finalizeCalibration(result, {
      db,
      profileId: "local",
      capturedAt: 1000,
      idGenerator: () => "fixed-id",
    });

    expect(outcome.success).toBe(true);
    expect(outcome.baseline?.id).toBe("fixed-id");
    expect(outcome.baseline?.hrMean).toBeCloseTo(70, 6);
    expect(outcome.baseline?.windowCount).toBe(3);

    const active = await getActiveBaseline(db, "local");
    expect(active?.id).toBe("fixed-id");
  });

  it("does not touch the database when the collection failed", async () => {
    const result: CalibrationResult = { success: false, features: [], reason: "not enough data" };

    const outcome = await finalizeCalibration(result, { db, profileId: "local", capturedAt: 1000 });

    expect(outcome.success).toBe(false);
    expect(outcome.reason).toBe("not enough data");
    expect(await getActiveBaseline(db, "local")).toBeUndefined();
  });

  it("generates a random id when no idGenerator is supplied", async () => {
    const result: CalibrationResult = {
      success: true,
      features: [
        {
          hr: 70,
          rmssd: 40,
          sdnn: 50,
          lfhf: null,
          browTension: 0.1,
          lidTension: 0.1,
          lipTension: 0.1,
          blinkRateHz: 0.2,
          sqi: 0.8,
        },
      ],
    };
    const outcome = await finalizeCalibration(result, { db, profileId: "local", capturedAt: 1000 });
    expect(outcome.baseline?.id).toBeTruthy();
    expect(typeof outcome.baseline?.id).toBe("string");
  });
});
