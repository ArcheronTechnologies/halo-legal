import type { WindowFeatures } from "../scoring/features.js";

export interface CalibrationResult {
  success: boolean;
  features: WindowFeatures[];
  /** Human-readable reason, present only when `success` is false. */
  reason?: string;
}

/**
 * Collects window-feature snapshots during the guided rest period (PLAN.md §6: 60-120s) and,
 * at the end of that fixed period, decides whether enough valid data came in to compute a
 * trustworthy baseline. Deliberately fails closed: with a face-less or low-quality session (bad
 * lighting, camera blocked, moving around), calibration should be retried, not silently produce
 * a baseline built from too little data.
 */
export class CalibrationCollector {
  private readonly features: WindowFeatures[] = [];

  constructor(private readonly minValidWindows: number) {}

  addWindow(features: WindowFeatures): void {
    this.features.push(features);
  }

  get windowCount(): number {
    return this.features.length;
  }

  finish(): CalibrationResult {
    if (this.features.length < this.minValidWindows) {
      return {
        success: false,
        features: this.features,
        reason: `Only collected ${this.features.length} usable reading(s) — need at least ${this.minValidWindows}. Make sure your face is well-lit and stay still, then try again.`,
      };
    }
    return { success: true, features: this.features };
  }
}
