import type { Baseline } from "@halo-pulse/types";
import { computeBaselineFromSamples } from "../scoring/baseline.js";
import { saveBaseline } from "../store/baselines.js";
import type { HaloPulseDb } from "../store/db.js";
import type { CalibrationResult } from "./collector.js";

export interface FinalizeCalibrationOptions {
  db: HaloPulseDb;
  profileId: string;
  capturedAt: number;
  idGenerator?: () => string;
}

export interface FinalizeCalibrationOutcome {
  success: boolean;
  reason?: string;
  baseline?: Baseline;
}

function defaultId(): string {
  return crypto.randomUUID();
}

/** Turns a finished calibration collection into a saved, active Baseline — or a failure reason. */
export async function finalizeCalibration(
  result: CalibrationResult,
  opts: FinalizeCalibrationOptions,
): Promise<FinalizeCalibrationOutcome> {
  if (!result.success) {
    return { success: false, reason: result.reason };
  }

  const baseline = computeBaselineFromSamples(result.features, {
    id: (opts.idGenerator ?? defaultId)(),
    profileId: opts.profileId,
    capturedAt: opts.capturedAt,
  });
  await saveBaseline(opts.db, baseline);

  return { success: true, baseline };
}
