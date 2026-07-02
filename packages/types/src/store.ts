/**
 * Local storage schema — see ARCHITECTURE.md §6. Zod schemas double as runtime validation for
 * JSON export/import (PLAN.md §7 "user data control"). No field here may ever hold a raw frame,
 * an image, or a face template — that invariant is enforced by review, not just by these types.
 */
import { z } from "zod";

export const captureConditionsSchema = z.object({
  lightingLux: z.number().nonnegative().optional(),
  deviceClass: z.string().optional(),
  /** Monk Skin Tone bin (1-10), when available — see VALIDATION.md §6.4. Never used to identify a person. */
  skinToneBin: z.number().int().min(1).max(10).optional(),
});
export type CaptureConditions = z.infer<typeof captureConditionsSchema>;

export const baselineSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  capturedAt: z.number(),
  version: z.number().int().nonnegative(),
  hrMean: z.number(),
  hrSd: z.number().nonnegative(),
  rmssdMean: z.number(),
  rmssdSd: z.number().nonnegative(),
  sdnnMean: z.number(),
  sdnnSd: z.number().nonnegative(),
  lfhfMean: z.number().nullable(),
  lfhfSd: z.number().nonnegative().nullable(),
  blinkRateMean: z.number(),
  blinkRateSd: z.number().nonnegative(),
  browTensionMean: z.number(),
  browTensionSd: z.number().nonnegative(),
  lidTensionMean: z.number(),
  lidTensionSd: z.number().nonnegative(),
  lipTensionMean: z.number(),
  lipTensionSd: z.number().nonnegative(),
  /** How many valid feature windows the calibration session collected — see PLAN.md §6. */
  windowCount: z.number().int().positive(),
  captureConditions: captureConditionsSchema,
});
export type Baseline = z.infer<typeof baselineSchema>;

export const hrvSummarySchema = z.object({
  rmssd: z.number(),
  sdnn: z.number(),
  lfhf: z.number().nullable(),
});

export const sessionSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  startedAt: z.number(),
  endedAt: z.number(),
  baselineId: z.string(),
  signalLayers: z.array(z.enum(["classical", "dl"])),
  stressIndexMean: z.number().min(0).max(100),
  stressIndexMedian: z.number().min(0).max(100),
  stressIndexPeak: z.number().min(0).max(100),
  hrMean: z.number(),
  hrvSummary: hrvSummarySchema,
  sqiMean: z.number().min(0).max(1),
});
export type Session = z.infer<typeof sessionSchema>;

export const behaviouralFeaturesSchema = z.object({
  blinkDeviation: z.number(),
  browTension: z.number(),
  lidTension: z.number(),
  lipTension: z.number(),
  /**
   * Not yet computed (Phase 1 does not extract head-pose data — ARCHITECTURE.md §3 leaves the
   * transformation matrix off) — omitted, not defaulted to 0, so "not measured" is never
   * confused with "measured, found to be zero."
   */
  headStillnessDeviation: z.number().optional(),
});

export const sampleSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  t: z.number(),
  hr: z.number(),
  rmssd: z.number().optional(),
  sdnn: z.number().optional(),
  lfhf: z.number().optional(),
  behavioural: behaviouralFeaturesSchema,
  sqi: z.number().min(0).max(1),
  stressIndex: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
});
export type Sample = z.infer<typeof sampleSchema>;

export const settingsSchema = z.object({
  id: z.literal("singleton"),
  consentGrantedAt: z.number().optional(),
  retentionDays: z.number().int().positive(),
  sensitivity: z.number().min(0).max(1),
  theme: z.enum(["light", "dark", "system"]),
  featureFlags: z.record(z.string(), z.boolean()),
});
export type Settings = z.infer<typeof settingsSchema>;

export const rollupSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  day: z.string(), // YYYY-MM-DD
  meanStressIndex: z.number().min(0).max(100),
  sampleCount: z.number().int().nonnegative(),
});
export type Rollup = z.infer<typeof rollupSchema>;

/** The full local export bundle produced by Settings > Export (PLAN.md §7). */
export const exportBundleSchema = z.object({
  exportedAt: z.number(),
  schemaVersion: z.literal(1),
  baselines: z.array(baselineSchema),
  sessions: z.array(sessionSchema),
  samples: z.array(sampleSchema),
  settings: settingsSchema,
});
export type ExportBundle = z.infer<typeof exportBundleSchema>;
