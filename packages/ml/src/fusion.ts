import type { RppgWindowResult, SignalLayer } from "@halo-pulse/types";
import type { DlRppgPrediction } from "./dlRppgModel.js";

export interface FusionCondition {
  /** Monk Skin Tone bin (1-10) — VALIDATION.md §6.4 is the fairness gate this condition feeds. */
  skinToneBin?: number;
  deviceClass?: string;
  lightingLux?: number;
}

export interface ValidationGateResult {
  dlTrusted: boolean;
  reason: string;
}

/**
 * The single place that decides whether the DL layer is trusted for a given operating
 * condition (ARCHITECTURE.md §5.3, ADR-0002, ADR-0006). It always returns `false` today because
 * the VALIDATION.md §5 study — leave-one-subject-out + cross-dataset, stratified by Monk bin —
 * has not been run yet (PLAN.md §10, Phase 4). This is the honest state of the project, not a
 * placeholder to silently change later without evidence: update this function's logic only when
 * backed by an actual validation result for the condition being gated.
 */
export function isDlValidatedForCondition(_condition: FusionCondition): ValidationGateResult {
  return {
    dlTrusted: false,
    reason:
      "no VALIDATION.md §5 study has been run yet for any condition — see PLAN.md §10 Phase 4",
  };
}

export interface FusionInput {
  classical: RppgWindowResult;
  dl: DlRppgPrediction | null;
  condition: FusionCondition;
}

export interface FusedRppgEstimate {
  result: RppgWindowResult;
  usedLayers: SignalLayer[];
  gate: ValidationGateResult;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Classical is always the guaranteed fallback (ADR-0002): the DL prediction only influences the
 * output once `isDlValidatedForCondition` says so for the caller's condition. When it does, this
 * blends `hrBpm` by the DL model's own reported confidence — HRV and signal quality still come
 * from the classical computation, since the DL layer here only predicts HR (see dlRppgModel.ts).
 */
export function fuseRppgEstimate(input: FusionInput): FusedRppgEstimate {
  const gate = isDlValidatedForCondition(input.condition);

  if (!input.dl || !gate.dlTrusted) {
    return { result: input.classical, usedLayers: ["classical"], gate };
  }

  const weight = clamp01(input.dl.confidence);
  const blendedHr = input.classical.hrBpm * (1 - weight) + input.dl.hrBpm * weight;

  return {
    result: { ...input.classical, hrBpm: blendedHr },
    usedLayers: ["classical", "dl"],
    gate,
  };
}
