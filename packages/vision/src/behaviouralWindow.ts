import type { BehaviouralSample, BehaviouralWindowResult } from "@halo-pulse/types";

function mean(x: number[]): number {
  return x.reduce((a, b) => a + b, 0) / x.length;
}

function sampleStd(x: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const m = mean(x);
  const sumSq = x.reduce((a, v) => a + (v - m) ** 2, 0);
  return Math.sqrt(sumSq / (n - 1));
}

/**
 * Aggregates per-frame blendshape samples over a window into the tension means and blink
 * rate/variability PLAN.md §2.2 scores. Blink *events* are counted as rising edges of the
 * per-frame `blinking` flag (a blink spanning several consecutive frames counts once), not raw
 * blinking-frame counts, which would overcount long blinks.
 */
export function computeBehaviouralWindow(samples: BehaviouralSample[]): BehaviouralWindowResult {
  if (samples.length === 0) {
    throw new Error("computeBehaviouralWindow: need at least 1 sample");
  }
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const n = sorted.length;

  const blinkTimes: number[] = [];
  if (sorted[0]!.blinking) blinkTimes.push(sorted[0]!.t);
  for (let i = 1; i < n; i++) {
    if (sorted[i]!.blinking && !sorted[i - 1]!.blinking) {
      blinkTimes.push(sorted[i]!.t);
    }
  }

  const windowStart = sorted[0]!.t;
  const windowEnd = sorted[n - 1]!.t;
  const windowDurationSec = windowEnd - windowStart;
  const blinkRateHz = windowDurationSec > 0 ? blinkTimes.length / windowDurationSec : 0;

  let blinkIntervalVariabilityMs: number | null = null;
  if (blinkTimes.length >= 3) {
    const intervalsMs: number[] = [];
    for (let i = 1; i < blinkTimes.length; i++) {
      intervalsMs.push((blinkTimes[i]! - blinkTimes[i - 1]!) * 1000);
    }
    blinkIntervalVariabilityMs = sampleStd(intervalsMs);
  }

  return {
    windowStart,
    windowEnd,
    browTension: mean(sorted.map((s) => s.browTension)),
    lidTension: mean(sorted.map((s) => s.lidTension)),
    lipTension: mean(sorted.map((s) => s.lipTension)),
    blinkRateHz,
    blinkIntervalVariabilityMs,
    sampleCount: n,
  };
}
