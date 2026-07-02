import type { StressBand } from "./scoring/composite.js";

const BAND_LABELS: Record<StressBand, string> = {
  calm: "Calm",
  neutral: "Neutral",
  elevated: "Elevated",
  high: "High",
};

export interface StressGaugeElements {
  fillPath: SVGPathElement;
  valueText: SVGTextElement;
  bandText: SVGTextElement;
}

export function getGaugeElements(root: ParentNode): StressGaugeElements {
  const fillPath = root.querySelector<SVGPathElement>("#gaugeFill");
  const valueText = root.querySelector<SVGTextElement>("#gaugeValue");
  const bandText = root.querySelector<SVGTextElement>("#gaugeBand");
  if (!fillPath || !valueText || !bandText) {
    throw new Error("getGaugeElements: gauge SVG markup is missing an expected element");
  }
  return { fillPath, valueText, bandText };
}

/**
 * Updates the meter (dataviz skill: "Meter — same-ramp track", not a multi-hue/status ramp — see
 * PLAN.md §8's "never pathologizing" tone requirement, which is why bands are plain text, not
 * status-red-coded). `fillPath` has `pathLength="100"`; dashoffset = 100 - value reveals that
 * percentage of the arc from its start, and the CSS `transition` on stroke-dashoffset (see
 * style.css) is what makes this a calm animated change rather than a jump.
 */
export function updateStressGauge(
  elements: StressGaugeElements,
  value: number,
  band: StressBand,
): void {
  const clamped = Math.min(100, Math.max(0, value));
  elements.fillPath.style.strokeDashoffset = String(100 - clamped);
  elements.valueText.textContent = clamped.toFixed(0);
  elements.bandText.textContent = BAND_LABELS[band];
}

/** Resets the gauge to empty with a caller-supplied label — "Not calibrated" vs. "Session stopped"
 * mean different things and shouldn't share one message. */
export function resetStressGauge(elements: StressGaugeElements, label: string): void {
  elements.fillPath.style.strokeDashoffset = "100";
  elements.valueText.textContent = "--";
  elements.bandText.textContent = label;
}
