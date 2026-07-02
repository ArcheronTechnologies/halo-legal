import { BLENDSHAPE_NAMES } from "./landmarks.js";

/** A minimal shape compatible with MediaPipe's `Category` ({ categoryName, score, ... }). */
export interface BlendshapeCategory {
  categoryName: string;
  score: number;
}

export interface TensionFeatures {
  browTension: number;
  lidTension: number;
  lipTension: number;
  blinking: boolean;
}

function scoreOf(categories: BlendshapeCategory[], name: string): number {
  const match = categories.find((c) => c.categoryName === name);
  return match?.score ?? 0;
}

/**
 * Maps MediaPipe's 52 blendshapes to the tension proxies PLAN.md §2.2 scores as deviation-from-
 * baseline features (the deviation-vs-baseline computation itself happens in the scoring layer,
 * not here — this module only extracts the raw per-frame values). `blinking` is exposed
 * separately, both as its own behavioural feature and so callers can gate rPPG ROI frames during
 * a blink (ARCHITECTURE.md §3.1).
 */
export function extractTensionFeatures(
  categories: BlendshapeCategory[],
  blinkThreshold = 0.5,
): TensionFeatures {
  const browTension = Math.max(
    scoreOf(categories, BLENDSHAPE_NAMES.browDownLeft),
    scoreOf(categories, BLENDSHAPE_NAMES.browDownRight),
  );
  const lidTension = Math.max(
    scoreOf(categories, BLENDSHAPE_NAMES.eyeSquintLeft),
    scoreOf(categories, BLENDSHAPE_NAMES.eyeSquintRight),
  );
  const lipTension = Math.max(
    scoreOf(categories, BLENDSHAPE_NAMES.mouthPressLeft),
    scoreOf(categories, BLENDSHAPE_NAMES.mouthPressRight),
  );
  const blinkScore = Math.max(
    scoreOf(categories, BLENDSHAPE_NAMES.eyeBlinkLeft),
    scoreOf(categories, BLENDSHAPE_NAMES.eyeBlinkRight),
  );

  return {
    browTension,
    lidTension,
    lipTension,
    blinking: blinkScore >= blinkThreshold,
  };
}
