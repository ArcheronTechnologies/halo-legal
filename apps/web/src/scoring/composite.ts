import { clamp, clamp01 } from "@halo-pulse/dsp";
import type { Baseline } from "@halo-pulse/types";
import type { WindowFeatures } from "./features.js";

/**
 * v1 transparent composite Stress Index (PLAN.md §6, ADR-0003, ADR-0004): robust z-scores of
 * each feature vs. the personal baseline, combined with fixed, physiology-weighted weights.
 * Weights are only renormalized over *present* features (e.g. when LF/HF is unavailable — the
 * common case, since it needs 60s+ of clean data), so a missing feature never systematically
 * shrinks the index. This is deliberately not a scientifically precise formula — the weights and
 * band cutoffs are a documented starting point to be tuned empirically against the VALIDATION.md
 * §5 study, the same posture as the SQI heuristic in packages/dsp/sqi.ts.
 */

export type StressBand = "calm" | "neutral" | "elevated" | "high";

export interface FeatureContribution {
  name: string;
  /** Clamped to [-Z_CLAMP, Z_CLAMP]. */
  zScore: number;
  /** Renormalized so all present features' weights sum to 1. */
  weight: number;
  /** sign * weight * zScore — this feature's signed share of the raw (pre-squash) score. */
  contribution: number;
}

export interface StressResult {
  stressIndex: number;
  band: StressBand;
  /** Derived from SQI — how much to trust this reading, independent of what it says. */
  confidence: number;
  contributions: FeatureContribution[];
}

const Z_CLAMP = 4;
const MIN_SD = 1e-6;
/** Tuned so a rawScore of +/-2 (roughly two "meaningfully elevated" features) maps to ~85/~15. */
const SIGMOID_K = 0.9;

interface Candidate {
  name: string;
  value: number | null | undefined;
  baselineMean: number | null | undefined;
  baselineSd: number | null | undefined;
  /** Fraction of total weight when all features are present — see the module docstring. */
  weight: number;
  /** +1: higher value -> more stress-like. -1: higher value -> less stress-like (e.g. RMSSD). */
  sign: 1 | -1;
  /**
   * Score the *magnitude* of deviation from baseline, not its direction — required for blink
   * rate specifically, which is bidirectional (suppressed under focus, elevated with anxiety) —
   * see PLAN.md §2.2 and ADR-0003. A fixed "up = stress" sign would be actively wrong here.
   */
  absoluteDeviation?: boolean;
}

function zScore(value: number, baselineMean: number, baselineSd: number): number {
  const safeSd = Math.max(baselineSd, MIN_SD);
  return clamp((value - baselineMean) / safeSd, -Z_CLAMP, Z_CLAMP);
}

export function bandFor(stressIndex: number): StressBand {
  if (stressIndex < 35) return "calm";
  if (stressIndex < 60) return "neutral";
  if (stressIndex < 80) return "elevated";
  return "high";
}

export function computeStressIndex(current: WindowFeatures, baseline: Baseline): StressResult {
  const candidates: Candidate[] = [
    {
      name: "hr",
      value: current.hr,
      baselineMean: baseline.hrMean,
      baselineSd: baseline.hrSd,
      weight: 0.3,
      sign: 1,
    },
    {
      name: "rmssd",
      value: current.rmssd,
      baselineMean: baseline.rmssdMean,
      baselineSd: baseline.rmssdSd,
      weight: 0.3,
      sign: -1,
    },
    {
      name: "lfhf",
      value: current.lfhf,
      baselineMean: baseline.lfhfMean,
      baselineSd: baseline.lfhfSd,
      weight: 0.05,
      sign: 1,
    },
    {
      name: "browTension",
      value: current.browTension,
      baselineMean: baseline.browTensionMean,
      baselineSd: baseline.browTensionSd,
      weight: 0.1,
      sign: 1,
    },
    {
      name: "lidTension",
      value: current.lidTension,
      baselineMean: baseline.lidTensionMean,
      baselineSd: baseline.lidTensionSd,
      weight: 0.1,
      sign: 1,
    },
    {
      name: "lipTension",
      value: current.lipTension,
      baselineMean: baseline.lipTensionMean,
      baselineSd: baseline.lipTensionSd,
      weight: 0.05,
      sign: 1,
    },
    {
      name: "blinkRate",
      value: current.blinkRateHz,
      baselineMean: baseline.blinkRateMean,
      baselineSd: baseline.blinkRateSd,
      weight: 0.1,
      sign: 1,
      absoluteDeviation: true,
    },
  ];

  const present = candidates.filter(
    (c): c is Candidate & { value: number; baselineMean: number; baselineSd: number } =>
      c.value !== null &&
      c.value !== undefined &&
      c.baselineMean !== null &&
      c.baselineMean !== undefined &&
      c.baselineSd !== null &&
      c.baselineSd !== undefined,
  );

  const totalWeight = present.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight <= 0) {
    throw new Error("computeStressIndex: no usable features (baseline may be incomplete)");
  }

  const contributions: FeatureContribution[] = present.map((c) => {
    const weight = c.weight / totalWeight;
    const rawZ = zScore(c.value, c.baselineMean, c.baselineSd);
    const z = c.absoluteDeviation ? Math.abs(rawZ) : rawZ;
    return { name: c.name, zScore: z, weight, contribution: c.sign * weight * z };
  });

  const rawScore = contributions.reduce((sum, c) => sum + c.contribution, 0);
  const stressIndex = 100 / (1 + Math.exp(-SIGMOID_K * rawScore));

  return {
    stressIndex,
    band: bandFor(stressIndex),
    confidence: clamp01(current.sqi),
    contributions,
  };
}
