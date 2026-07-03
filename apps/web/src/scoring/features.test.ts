import type { BehaviouralWindowResult, RppgWindowResult } from "@halo-pulse/types";
import { describe, expect, it } from "vitest";
import { buildWindowFeatures } from "./features.js";

const rppg: RppgWindowResult = {
  method: "pos",
  layer: "classical",
  windowStart: 0,
  windowEnd: 12,
  hrBpm: 72,
  hrv: { rmssd: 35, sdnn: 45, lfhf: null, ibiCount: 10 },
  quality: { sqi: 0.7, snrDb: 6, skewness: 0.4 },
};

const behavioural: BehaviouralWindowResult = {
  windowStart: 0,
  windowEnd: 12,
  browTension: 0.2,
  lidTension: 0.15,
  lipTension: 0.05,
  blinkRateHz: 0.25,
  blinkIntervalVariabilityMs: 300,
  sampleCount: 360,
};

describe("buildWindowFeatures", () => {
  it("flattens rPPG + behavioural results into one feature vector", () => {
    const features = buildWindowFeatures(rppg, behavioural);
    expect(features).toEqual({
      hr: 72,
      rmssd: 35,
      sdnn: 45,
      lfhf: null,
      browTension: 0.2,
      lidTension: 0.15,
      lipTension: 0.05,
      blinkRateHz: 0.25,
      sqi: 0.7,
    });
  });

  it("maps a null hrv to null rmssd/sdnn/lfhf rather than throwing", () => {
    const features = buildWindowFeatures({ ...rppg, hrv: null }, behavioural);
    expect(features.rmssd).toBeNull();
    expect(features.sdnn).toBeNull();
    expect(features.lfhf).toBeNull();
  });
});
