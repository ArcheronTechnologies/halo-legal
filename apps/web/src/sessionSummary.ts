import { mean } from "@halo-pulse/dsp";
import type { Sample, Session, SignalLayer } from "@halo-pulse/types";

function median(x: number[]): number {
  const sorted = [...x].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export interface SessionSummaryMeta {
  id: string;
  profileId: string;
  baselineId: string;
  startedAt: number;
  endedAt: number;
  signalLayers: SignalLayer[];
}

/** Aggregates a completed live session's samples into the summary record persisted to Dexie. */
export function buildSessionSummary(samples: Sample[], meta: SessionSummaryMeta): Session {
  if (samples.length === 0) {
    throw new Error("buildSessionSummary: need at least 1 sample");
  }

  const stressIndices = samples.map((s) => s.stressIndex);
  const rmssdValues = samples.map((s) => s.rmssd).filter((v): v is number => v !== undefined);
  const sdnnValues = samples.map((s) => s.sdnn).filter((v): v is number => v !== undefined);
  const lfhfValues = samples.map((s) => s.lfhf).filter((v): v is number => v !== undefined);

  return {
    id: meta.id,
    profileId: meta.profileId,
    startedAt: meta.startedAt,
    endedAt: meta.endedAt,
    baselineId: meta.baselineId,
    signalLayers: meta.signalLayers,
    stressIndexMean: mean(stressIndices),
    stressIndexMedian: median(stressIndices),
    stressIndexPeak: Math.max(...stressIndices),
    hrMean: mean(samples.map((s) => s.hr)),
    hrvSummary: {
      rmssd: rmssdValues.length > 0 ? mean(rmssdValues) : 0,
      sdnn: sdnnValues.length > 0 ? mean(sdnnValues) : 0,
      lfhf: lfhfValues.length > 0 ? mean(lfhfValues) : null,
    },
    sqiMean: mean(samples.map((s) => s.sqi)),
  };
}
