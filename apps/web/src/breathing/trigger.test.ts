import { describe, expect, it } from "vitest";
import type { StressBand } from "../scoring/composite.js";
import {
  type BreathingTriggerState,
  initialBreathingTriggerState,
  stepBreathingTrigger,
} from "./trigger.js";

function run(bands: StressBand[]): { state: BreathingTriggerState; offers: boolean[] } {
  let state = initialBreathingTriggerState();
  const offers: boolean[] = [];
  for (const band of bands) {
    const step = stepBreathingTrigger(state, band);
    state = step.state;
    offers.push(step.shouldOffer);
  }
  return { state, offers };
}

describe("stepBreathingTrigger", () => {
  it("offers exactly on the 3rd consecutive elevated reading (hand-derived)", () => {
    const { offers } = run(["neutral", "elevated", "elevated", "elevated"]);
    expect(offers).toEqual([false, false, false, true]);
  });

  it("resets the streak when the band drops back to calm/neutral", () => {
    const { offers } = run([
      "elevated",
      "elevated",
      "neutral", // resets
      "elevated",
      "elevated",
      "elevated", // 3rd since reset -> offers
    ]);
    expect(offers).toEqual([false, false, false, false, false, true]);
  });

  it("treats 'high' as sustained too, and mixed elevated/high counts continuously", () => {
    const { offers } = run(["elevated", "high", "elevated"]);
    expect(offers).toEqual([false, false, true]);
  });

  it("never offers a second time in the same session", () => {
    const { offers } = run([
      "elevated",
      "elevated",
      "elevated", // offers here
      "neutral",
      "elevated",
      "elevated",
      "elevated", // would hit the threshold again, but must not re-offer
    ]);
    expect(offers).toEqual([false, false, true, false, false, false, false]);
  });

  it("does not offer for calm/neutral-only sequences", () => {
    const { offers } = run(["calm", "neutral", "calm", "neutral"]);
    expect(offers.every((o) => o === false)).toBe(true);
  });

  it("starts from a fresh state with no streak and not yet offered", () => {
    expect(initialBreathingTriggerState()).toEqual({
      consecutiveElevated: 0,
      offeredThisSession: false,
    });
  });
});
