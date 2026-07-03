import type { BreathingTick } from "./cycle.js";

export interface BreathingExerciseElements {
  circle: SVGCircleElement;
  phaseText: HTMLElement;
  cycleCountText: HTMLElement;
}

export function getBreathingExerciseElements(root: ParentNode): BreathingExerciseElements {
  const circle = root.querySelector<SVGCircleElement>("#breathingCircle");
  const phaseText = root.querySelector<HTMLElement>("#breathingPhaseText");
  const cycleCountText = root.querySelector<HTMLElement>("#breathingCycleCount");
  if (!circle || !phaseText || !cycleCountText) {
    throw new Error(
      "getBreathingExerciseElements: breathing exercise markup is missing an expected element",
    );
  }
  return { circle, phaseText, cycleCountText };
}

const MIN_RADIUS = 30;
const MAX_RADIUS = 70;

/** Grows the circle through inhale, shrinks it through exhale — the pacing IS the instruction, so
 * text is a caption for it, not the primary cue (calmer to follow than a countdown alone). */
export function renderBreathingTick(
  elements: BreathingExerciseElements,
  tick: BreathingTick,
): void {
  const growing = tick.phase === "inhale";
  const t = growing ? tick.progress : 1 - tick.progress;
  const radius = MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);

  elements.circle.setAttribute("r", radius.toFixed(1));
  elements.phaseText.textContent = growing
    ? `Breathe in (${tick.secondsRemaining})`
    : `Breathe out (${tick.secondsRemaining})`;
  elements.cycleCountText.textContent = `${tick.cycleCount} cycle${tick.cycleCount === 1 ? "" : "s"} completed`;
}
