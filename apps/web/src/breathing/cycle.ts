export type BreathingPhase = "inhale" | "exhale";

export interface BreathingCycleConfig {
  inhaleSec: number;
  exhaleSec: number;
}

/** Inhale 4s / exhale 6s, no holds — a longer exhale than inhale is the well-known simple pattern
 * for a calming (parasympathetic) effect, and skipping breath-holds keeps it easy to follow for
 * someone who wasn't expecting to be asked to do this mid-task. */
export const DEFAULT_BREATHING_CYCLE: BreathingCycleConfig = { inhaleSec: 4, exhaleSec: 6 };

export interface BreathingTick {
  phase: BreathingPhase;
  /** 0 at the start of the phase, 1 at its end. */
  progress: number;
  /** Seconds left in the current phase, rounded up for a stable countdown display. */
  secondsRemaining: number;
  /** How many full inhale+exhale cycles have completed. */
  cycleCount: number;
}

/** Pure: given elapsed seconds since the exercise started, which phase/progress is that. */
export function computeBreathingTick(
  elapsedSec: number,
  config: BreathingCycleConfig,
): BreathingTick {
  const cycleLength = config.inhaleSec + config.exhaleSec;
  const cycleCount = Math.floor(elapsedSec / cycleLength);
  const t = elapsedSec - cycleCount * cycleLength;

  if (t < config.inhaleSec) {
    return {
      phase: "inhale",
      progress: t / config.inhaleSec,
      secondsRemaining: Math.ceil(config.inhaleSec - t),
      cycleCount,
    };
  }
  const exhaleElapsed = t - config.inhaleSec;
  return {
    phase: "exhale",
    progress: exhaleElapsed / config.exhaleSec,
    secondsRemaining: Math.ceil(config.exhaleSec - exhaleElapsed),
    cycleCount,
  };
}
