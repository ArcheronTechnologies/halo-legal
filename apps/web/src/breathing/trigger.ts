import type { StressBand } from "../scoring/composite.js";

/** Consecutive elevated/high windows required before offering — a debounce so one noisy window
 * doesn't trigger a suggestion (PLAN.md §8 "optional breathing-exercise interventions"). */
const SUSTAINED_WINDOWS_THRESHOLD = 3;

export interface BreathingTriggerState {
  consecutiveElevated: number;
  /** Offered at most once per session — a repeated nag would cut against the "calm, never
   * pathologizing" tone (PLAN.md §8) more than a missed second offer would help. */
  offeredThisSession: boolean;
}

export function initialBreathingTriggerState(): BreathingTriggerState {
  return { consecutiveElevated: 0, offeredThisSession: false };
}

export interface BreathingTriggerStep {
  state: BreathingTriggerState;
  shouldOffer: boolean;
}

/** Pure state-transition: feed in each new band reading, get back the next state and whether
 * this particular update should newly surface the offer. */
export function stepBreathingTrigger(
  state: BreathingTriggerState,
  band: StressBand,
): BreathingTriggerStep {
  const sustained = band === "elevated" || band === "high";
  const consecutiveElevated = sustained ? state.consecutiveElevated + 1 : 0;
  const shouldOffer =
    !state.offeredThisSession && consecutiveElevated >= SUSTAINED_WINDOWS_THRESHOLD;

  return {
    state: {
      consecutiveElevated,
      offeredThisSession: state.offeredThisSession || shouldOffer,
    },
    shouldOffer,
  };
}
