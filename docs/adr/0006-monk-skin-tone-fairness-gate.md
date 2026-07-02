# ADR-0006: Monk Skin Tone scale for fairness evaluation; cross-skin-tone parity is a release gate

## Status

Accepted

## Context

rPPG signal quality is not uniform across skin tones: melanin absorbs the pulsatile green-light signal
rPPG depends on, and sensor dynamic range limits accuracy at both extremes of skin tone. Published
evidence (`RESEARCH.md` §E) shows HR MAE roughly tripling from the lightest to the darkest skin-tone
bins for classical chrominance methods, and deep-learning methods are **not immune** — they degrade
too, just somewhat less severely. This is precisely the kind of bias that has drawn regulatory and
public criticism of computer-vision products generally, and it directly threatens the product's core
promise of being a personal, trustworthy self-tracking tool: a systematically less-accurate reading for
some users, presented with the same confidence as for others, would be a real harm, not a cosmetic one.

A separate, prior question is *which* skin-tone scale to evaluate against. The Fitzpatrick scale (6
points) was designed to predict UV/sunburn response, not to describe visual skin tone, and is known to
under-represent darker skin (only 2 of its 6 categories cover dark tones). The Google-developed Monk
Skin Tone (MST) scale (10 points) was designed explicitly for skin-tone description, decoupled from UV
response, and is now the de facto standard for computer-vision fairness annotation.

## Decision

1. All accuracy, agreement, and construct-validity metrics in `VALIDATION.md` are reported **stratified
   by Monk Skin Tone bin**, not Fitzpatrick.
2. A **cross-skin-tone parity gap is a release blocker** for any general-accuracy claim made about the
   product (in-product copy, marketing, or this documentation) — it is not logged as a known issue and
   shipped anyway.
3. Whether the **on-device DL rPPG layer** (ADR-0002) is permitted to influence the shown score for a
   given user is itself gated per Monk bin: the DL layer is only trusted where it has cleared
   LOSO/cross-dataset validation *for that bin specifically*; elsewhere the product runs classical-only.
4. Where measured confidence is low for a user's detected conditions (skin tone included), the product
   **widens its displayed uncertainty or shows "signal too weak"** rather than presenting a falsely
   precise number.

## Rationale

- **Monk over Fitzpatrick is a measurement-validity choice, not a stylistic one** — evaluating fairness
  on a scale that itself under-represents the population most likely to experience degraded accuracy
  would understate the very problem the gate exists to catch.
- **Making parity a release gate, rather than a target, follows from the size of the documented
  effect.** A roughly 3× error swing is large enough that presenting it as uniform accuracy would be
  actively misleading, not just imprecise — this is a correctness bar the product should not ship
  under, mirroring how the plan already treats HR/HRV accuracy honesty (`VALIDATION.md` §2) as
  non-negotiable.
- **Gating the DL layer specifically, in addition to reporting stratified metrics, closes the gap
  between "we measured a problem" and "the product behaves differently because of it."** A metrics
  report that documents bias but ships a product that ignores it would satisfy the letter of "we tested
  for fairness" while missing the point.
- **Degrading to wider uncertainty or "signal too weak," rather than silently serving a worse number,**
  keeps faith with the product's broader honesty commitment (`PLAN.md` §2.3, §6) — an inaccurate-but-
  confident reading is worse than an honestly-uncertain one for a tool users are meant to trust with
  something as personal as their own stress level.

## Consequences

- The validation study (`VALIDATION.md` §5) must recruit a **Monk-stratified, quota-sampled**
  participant pool (≥30–40 participants) rather than a convenience sample — this is a real cost and
  scheduling constraint on the study, not a formality.
- Skin-tone labeling itself has known inter-annotator reliability limits (`RESEARCH.md` §E) — the study
  protocol must capture tone under controlled lighting and/or use multiple raters or a reference chart,
  or the stratification itself becomes a source of noise.
- Product engineering must plumb a per-session "which validated bin, if any, does this look like"
  signal through to the fusion/gating logic (`ARCHITECTURE.md` §5.3) — this is not just a reporting
  requirement, it changes runtime behavior.
- If, after the Phase 4 validation study, parity cannot be achieved for some bins, the honest path is
  publishing that limitation and keeping those users on classical-only with wider uncertainty — not
  quietly relaxing this gate to ship a "good enough" claim.
