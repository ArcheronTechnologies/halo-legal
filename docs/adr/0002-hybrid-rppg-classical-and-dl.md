# ADR-0002: Hybrid rPPG — classical methods AND on-device deep learning, both in the MVP

## Status

Accepted (revised — see "Revision history")

## Context

rPPG can be computed with classical, hand-designed combiners (GREEN, ICA, CHROM, POS, LGI, OMIT) or
with trained deep-learning models (DeepPhys, PhysNet, TS-CAN, EfficientPhys, Contrast-Phys). Research
into both families (`RESEARCH.md` §A) found:

- Classical model-based methods (CHROM, POS, LGI, OMIT) are cheap, need no training data, are fully
  auditable, and are robust to motion/illumination by design.
- Deep models post excellent **in-domain** accuracy (e.g., PhysNet ≈1.78 bpm MAE on UBFC-rPPG) but
  their advantage **shrinks or reverses cross-dataset** — on harder, more realistic benchmarks (MMPD),
  the same model classes degrade to ~9–14 bpm MAE, comparable to or worse than classical methods, and
  reviews note DL "cannot effectively eliminate illumination/motion artifacts" while costing far more
  compute (`VALIDATION.md` §2.3).
- The two richest DL/classical reference toolboxes — rPPG-Toolbox and pyVHR — carry RAIL and GPL-3.0
  licenses respectively, meaning **shipped DL weights must not simply be copied from them** if the
  product is to remain freely distributable (`RESEARCH.md` §F; ADR-0005).

## Decision

**Both layers ship in the MVP.** A classical layer (POS default, OMIT for compression robustness,
CHROM fallback, LGI for high-motion windows) runs as the always-available, auditable baseline. An
on-device deep-learning rPPG model — TS-CAN or EfficientPhys (supervised, edge-optimized) or
Contrast-Phys+ (unsupervised) — runs alongside it via `onnxruntime-web` on WebGPU (WASM fallback),
entirely on-device. The scoring layer selects/blends between the two per window based on SQI and on
whether the DL layer has cleared a **per-condition validation gate** (LOSO + cross-dataset +
Monk-stratified — `VALIDATION.md` §5–§6); where it hasn't, the product runs classical-only rather than
trusting an unvalidated DL output for that condition.

## Revision history

The research phase of this plan initially recommended **deferring deep learning past the MVP**,
specifically because of the cross-dataset generalization gap above. The product owner overrode this
recommendation: **deep learning must ship in the MVP.** This ADR reflects that decision. The
generalization concern was not discarded — it was converted from "a reason to wait" into "a condition
DL must earn per-user-condition before it's trusted," via the validation gate described above and in
`ARCHITECTURE.md` §5.3. This is the substantive compromise: DL ships now, but its influence on the
shown score is bounded by measured evidence, not by elapsed time or roadmap phase.

## Rationale for the hybrid shape specifically (not DL-only)

- **Classical-only fallback preserves the product's core honesty property** even where DL hasn't been
  validated yet (new devices, unusual lighting, skin tones underrepresented in current training data) —
  without it, shipping DL in the MVP would mean either accepting unvalidated output everywhere or
  blocking large swaths of users/conditions entirely.
- **Classical methods remain the auditable reference** the DL layer is checked against, which matters
  both for debugging (a discrepancy between the two layers is itself a signal) and for the product's
  transparency posture (`PLAN.md` §7) — a pure black-box DL pipeline would be harder to explain and
  defend in the "how does this work" sense the privacy-conscious framing requires.
- **Device/perf heterogeneity** — not every device can afford DL inference within the latency budget
  (`ARCHITECTURE.md` §5.1); classical-only is the natural, always-available degrade path rather than a
  separate code path built later under pressure.

## Consequences

- Two rPPG implementations must be built, tested, and maintained instead of one, and their fusion logic
  is itself a nontrivial component (`ARCHITECTURE.md` §5.3).
- The Phase 0 spike (`PLAN.md` §10) must stand up the ONNX/WebGPU inference path and measure real
  on-device cost immediately, rather than treating DL as a later add-on — this pulls model-selection
  work earlier in the roadmap than it would otherwise sit.
- The DL model cannot use rPPG-Toolbox's pretrained weights or GPL-derived code; it must be trained
  from scratch in the harness (Contrast-Phys+'s unsupervised approach is attractive here specifically
  because it avoids needing licensed *labels*) or sourced from cleanly-licensed weights — see
  ADR-0005. This is real, non-optional engineering and/or data-collection work, not a checkbox.
- Every accuracy or capability claim about the DL layer must be qualified by the condition(s) it has
  actually been validated for; marketing or UI copy that implies uniform DL-grade accuracy across all
  users would misrepresent the gated design and must be avoided.
