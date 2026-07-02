import { describe, expect, it } from "vitest";
import type { WindowFeatures } from "../scoring/features.js";
import { CalibrationCollector } from "./collector.js";

function features(hr: number): WindowFeatures {
  return {
    hr,
    rmssd: 40,
    sdnn: 50,
    lfhf: null,
    browTension: 0.1,
    lidTension: 0.1,
    lipTension: 0.1,
    blinkRateHz: 0.2,
    sqi: 0.8,
  };
}

describe("CalibrationCollector", () => {
  it("succeeds once at least minValidWindows windows were collected", () => {
    const collector = new CalibrationCollector(3);
    collector.addWindow(features(70));
    collector.addWindow(features(71));
    collector.addWindow(features(69));

    const result = collector.finish();
    expect(result.success).toBe(true);
    expect(result.features).toHaveLength(3);
    expect(result.reason).toBeUndefined();
  });

  it("fails with a helpful reason when too few windows were collected", () => {
    const collector = new CalibrationCollector(5);
    collector.addWindow(features(70));
    collector.addWindow(features(71));

    const result = collector.finish();
    expect(result.success).toBe(false);
    expect(result.reason).toContain("2");
    expect(result.reason).toContain("5");
    expect(result.features).toHaveLength(2); // still returned, for diagnostics/retry context
  });

  it("fails when zero windows were ever collected (e.g. no face detected)", () => {
    const collector = new CalibrationCollector(3);
    const result = collector.finish();
    expect(result.success).toBe(false);
    expect(result.features).toHaveLength(0);
  });

  it("windowCount tracks additions live, before finish() is called", () => {
    const collector = new CalibrationCollector(3);
    expect(collector.windowCount).toBe(0);
    collector.addWindow(features(70));
    expect(collector.windowCount).toBe(1);
    collector.addWindow(features(71));
    expect(collector.windowCount).toBe(2);
  });
});
