import type { Baseline, CaptureConditions } from "@halo-pulse/types";
import type { WindowFeatures } from "./features.js";

function mean(x: number[]): number {
  return x.reduce((a, b) => a + b, 0) / x.length;
}

function sampleStd(x: number[]): number {
  if (x.length < 2) return 0;
  const m = mean(x);
  const sumSq = x.reduce((a, v) => a + (v - m) ** 2, 0);
  return Math.sqrt(sumSq / (x.length - 1));
}

export interface BaselineMeta {
  id: string;
  profileId: string;
  capturedAt: number;
  version?: number;
  captureConditions?: CaptureConditions;
}

/**
 * Aggregates the window-feature snapshots collected during calibration (PLAN.md §6) into a
 * personal baseline: mean + sample stddev per feature, used downstream to z-score every live
 * reading against this specific person's own rest state.
 */
export function computeBaselineFromSamples(
  features: WindowFeatures[],
  meta: BaselineMeta,
): Baseline {
  if (features.length === 0) {
    throw new Error("computeBaselineFromSamples: need at least 1 window");
  }

  const hrValues = features.map((f) => f.hr);
  const rmssdValues = features.map((f) => f.rmssd).filter((v): v is number => v !== null);
  const sdnnValues = features.map((f) => f.sdnn).filter((v): v is number => v !== null);
  const lfhfValues = features.map((f) => f.lfhf).filter((v): v is number => v !== null);
  const blinkValues = features.map((f) => f.blinkRateHz);
  const browValues = features.map((f) => f.browTension);
  const lidValues = features.map((f) => f.lidTension);
  const lipValues = features.map((f) => f.lipTension);

  return {
    id: meta.id,
    profileId: meta.profileId,
    capturedAt: meta.capturedAt,
    version: meta.version ?? 1,
    hrMean: mean(hrValues),
    hrSd: sampleStd(hrValues),
    rmssdMean: rmssdValues.length > 0 ? mean(rmssdValues) : 0,
    rmssdSd: rmssdValues.length > 0 ? sampleStd(rmssdValues) : 0,
    sdnnMean: sdnnValues.length > 0 ? mean(sdnnValues) : 0,
    sdnnSd: sdnnValues.length > 0 ? sampleStd(sdnnValues) : 0,
    lfhfMean: lfhfValues.length > 0 ? mean(lfhfValues) : null,
    lfhfSd: lfhfValues.length > 0 ? sampleStd(lfhfValues) : null,
    blinkRateMean: mean(blinkValues),
    blinkRateSd: sampleStd(blinkValues),
    browTensionMean: mean(browValues),
    browTensionSd: sampleStd(browValues),
    lidTensionMean: mean(lidValues),
    lidTensionSd: sampleStd(lidValues),
    lipTensionMean: mean(lipValues),
    lipTensionSd: sampleStd(lipValues),
    windowCount: features.length,
    captureConditions: meta.captureConditions ?? {},
  };
}
