import type { BehaviouralWindowResult, RppgWindowResult } from "@halo-pulse/types";

/** The flat, scorable feature vector for one window — combines the rPPG and behavioural results. */
export interface WindowFeatures {
  hr: number;
  rmssd: number | null;
  sdnn: number | null;
  lfhf: number | null;
  browTension: number;
  lidTension: number;
  lipTension: number;
  blinkRateHz: number;
  sqi: number;
}

export function buildWindowFeatures(
  rppg: RppgWindowResult,
  behavioural: BehaviouralWindowResult,
): WindowFeatures {
  return {
    hr: rppg.hrBpm,
    rmssd: rppg.hrv?.rmssd ?? null,
    sdnn: rppg.hrv?.sdnn ?? null,
    lfhf: rppg.hrv?.lfhf ?? null,
    browTension: behavioural.browTension,
    lidTension: behavioural.lidTension,
    lipTension: behavioural.lipTension,
    blinkRateHz: behavioural.blinkRateHz,
    sqi: rppg.quality.sqi,
  };
}
