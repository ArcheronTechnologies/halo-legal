import { type BreathingCycleConfig, type BreathingTick, computeBreathingTick } from "./cycle.js";

/** requestAnimationFrame driver over computeBreathingTick — same shape as capture.ts's
 * startFrameLoop (elapsed-time-based, not frame-count-based, and returns a stop function). */
export function startBreathingLoop(
  config: BreathingCycleConfig,
  onTick: (tick: BreathingTick) => void,
): () => void {
  let stopped = false;
  const startTime = performance.now();

  const step = () => {
    if (stopped) return;
    const elapsedSec = (performance.now() - startTime) / 1000;
    onTick(computeBreathingTick(elapsedSec, config));
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);

  return () => {
    stopped = true;
  };
}
