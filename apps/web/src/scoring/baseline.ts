import { mean, std } from "@halo-pulse/dsp";
import type { Baseline, CaptureConditions } from "@halo-pulse/types";
import type { WindowFeatures } from "./features.js";

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
    hrSd: std(hrValues, 1),
    rmssdMean: rmssdValues.length > 0 ? mean(rmssdValues) : 0,
    rmssdSd: rmssdValues.length > 0 ? std(rmssdValues, 1) : 0,
    sdnnMean: sdnnValues.length > 0 ? mean(sdnnValues) : 0,
    sdnnSd: sdnnValues.length > 0 ? std(sdnnValues, 1) : 0,
    lfhfMean: lfhfValues.length > 0 ? mean(lfhfValues) : null,
    lfhfSd: lfhfValues.length > 0 ? std(lfhfValues, 1) : null,
    blinkRateMean: mean(blinkValues),
    blinkRateSd: std(blinkValues, 1),
    browTensionMean: mean(browValues),
    browTensionSd: std(browValues, 1),
    lidTensionMean: mean(lidValues),
    lidTensionSd: std(lidValues, 1),
    lipTensionMean: mean(lipValues),
    lipTensionSd: std(lipValues, 1),
    windowCount: features.length,
    captureConditions: meta.captureConditions ?? {},
  };
}
