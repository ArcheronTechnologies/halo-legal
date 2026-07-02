# ADR-0004: Transparent composite scorer stays the default; learned layers augment, gated, from the MVP; personalization is prioritized over model sophistication

## Status

Accepted

## Context

Once features are extracted (ADR-0003), they must be turned into a single Stress Index. Options
range from a fully rule-based composite to a fully learned model (classical ML or deep temporal
networks). The ML research (`RESEARCH.md` §J) found:

- Population/generic models generalize poorly across individuals and datasets — cross-dataset F1 drops
  of ~14 points are documented, and naive cross-subject accuracy in related affect-recognition work is
  as low as ~57% before any personalization is applied.
- The single largest lever found in the literature for closing that gap is **per-user calibration and
  personalization**, not model architecture sophistication — transfer learning alone lifted
  cross-subject accuracy from 56.7% to 76.3% in one cited study.
- Classical tree ensembles (Random Forest, XGBoost) on engineered features are the most credible,
  reproducible performers in the stress-detection literature; temporal deep nets (LSTM/TCN/Transformer)
  add value mainly with larger, well-labeled longitudinal data that this product does not have at
  launch.
- Separately, ADR-0002 commits to shipping an on-device **DL rPPG** model in the MVP for the *signal
  extraction* stage (HR/HRV recovery), which is a distinct concern from the *scoring* stage this ADR
  addresses (turning features into a Stress Index).

## Decision

1. **The v1 transparent composite** (robust z-scores vs. personal baseline, fixed physiology-led
   weights per ADR-0003, SQI-gated, smoothed) is the **default and always-present** scoring method. It
   ships in the MVP and remains available indefinitely as the explainable, privacy-friendly fallback.
2. **Learned layers augment the composite from the MVP, not replace it, and only where gated in.**
   Two are in scope for the MVP: the on-device DL rPPG model's HR/HRV (ADR-0002, gated per-condition by
   `VALIDATION.md` §5–§6) feeding the same composite; and, optionally, an XGBoost/LightGBM model over
   engineered features (trained in the harness, exported to ONNX, run via `onnxruntime-web`) as an
   interpretable learned ensemble member. Neither is trusted to independently override the composite.
3. **Personalization work (adaptive per-user baselines and thresholds) is prioritized ahead of adding
   further model complexity.** A compact temporal deep scorer (1D-CNN/TCN) is a candidate for **Phase
   3+ only**, contingent on accumulating enough opted-in labeled sessions, and must clear the same
   LOSO/cross-dataset bar as the DL rPPG layer before it can influence the score.
4. Every learned component is always evaluated **leave-one-subject-out**, and cross-dataset where
   feasible — window-level random splits are not accepted as evidence for shipping.

## Rationale

- **The composite's explainability is a product requirement, not just an engineering nicety** — this is
  a wellness tool asking users to trust a number about their own physiology; being able to say
  concretely "your reading is elevated because your recovered heart rate is X, above your baseline of
  Y" is part of the honesty commitment made throughout `PLAN.md`.
- **Keeping the composite as the always-on floor bounds the damage of any learned-layer failure** —
  since the learned layers are gated by validated conditions, a user in an unvalidated condition simply
  gets the composite, not a broken or misleading learned score.
- **Prioritizing personalization over sophistication follows the evidence directly** — the literature's
  single biggest lever is calibration, and the product already has a personal-baseline mechanism
  (`PLAN.md` §6) that a temporal deep model would need to reproduce the value of before it earns its
  added complexity and reduced explainability.

## Consequences

- Two distinct "deep learning in the MVP" claims exist and must not be conflated: the **rPPG signal
  layer** (ADR-0002, extracting HR/HRV from video) ships gated in the MVP; a **learned scoring layer**
  beyond XGBoost (i.e., a temporal deep net turning features into the index itself) is explicitly
  deferred to Phase 3+. Product communication should be precise about which is which.
- The engineering surface for "is this learned output trusted right now" (SQI + condition gate) is
  shared infrastructure across both the rPPG DL layer and any future learned scoring layer, so it is
  worth building once, generally, rather than bespoke per feature (`ARCHITECTURE.md` §5.3).
- Labeled-session collection (opt-in self-report, `PLAN.md` Phase 3) becomes a roadmap dependency for
  any scoring-layer sophistication beyond the MVP, which argues for instrumenting that collection path
  early even though it isn't consumed until later.
