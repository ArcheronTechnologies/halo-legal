# ADR-0003: Physiology-primary scoring; de-emphasize LF/HF; behavioural cues low-weight and signed

## Status

Accepted

## Context

The product fuses two signal families: rPPG-derived HR/HRV, and facial-behavioural tension cues
(brow, eyelids, lips, blink, head motion). Both need weights in the composite scorer, and both carry
known reliability problems documented in `VALIDATION.md` and `RESEARCH.md`:

- Within HRV, **LF/HF** is simultaneously the metric most textbooks reach for as "the" stress ratio,
  and the metric with the weakest physiological grounding (it does not cleanly index sympathovagal
  balance — `RESEARCH.md` §C) *and* the hardest to measure reliably from a short, jittery webcam
  session (needs ≥1–2 minutes of clean inter-beat intervals). RMSSD, by contrast, is well-grounded and
  valid from ~10–30 s windows.
- Facial behavioural cues are real but weak and non-specific (Barrett et al. 2019 — `RESEARCH.md` §I),
  and at least one commonly-assumed cue, blink rate, is **bidirectional**: suppressed under focused
  cognitive load, elevated with anxiety and post-task (`RESEARCH.md` §H). A fixed-direction weighting
  would actively mislead a screen-focused user.

## Decision

1. The composite scorer leads on **HR↑ and RMSSD↓**. LF/HF is computed opportunistically when enough
   clean data exists, but is included, if at all, as a **low-weight, explicitly hedged tertiary
   feature** — never a headline number in scoring or UI.
2. Behavioural cues (brow, lid, lip tension, blink-rate deviation + variability, head-motion deviation)
   are **low-weight modulators**, always expressed as **deviation from the user's own calibrated
   baseline**, never as a fixed-direction signal and never surfaced as an emotion label.

## Rationale

- **Grounding the score in the better-evidenced signal family first** is the most direct way to keep
  the product's claims honest — physiology has a real, if noisy, causal story connecting it to
  autonomic arousal; single-frame facial expression does not have an equivalently strong story
  connecting it to *internal state* specifically (only to visible tension, which is a legitimate but
  much narrower claim).
- **Fixing the LF/HF weighting is a correction, not a stylistic choice** — shipping a scorer that
  treats LF/HF as a primary input would be asking a metric to carry weight the underlying physiology
  research doesn't support, on top of a metric the webcam signal chain often can't measure reliably in
  the first place. Both problems point the same direction: down-weight it.
- **Signing behavioural cues to the user's own baseline, rather than a fixed direction, is required by
  the blink-rate evidence specifically** — any static "more blinking = more stress" rule is
  demonstrably wrong for at least the common case of focused screen work, where blink suppression is
  the expected stress-adjacent response.

## Consequences

- The composite scorer's feature weights are not symmetric across "physiological" and "behavioural" —
  this must be documented in-product (or in developer-facing scoring docs) so it isn't mistaken for an
  oversight later.
- LF/HF remains available in the data model (`ARCHITECTURE.md` §6) for users/researchers who want it,
  but product UI and default scoring must not present it as equivalent in reliability to HR/RMSSD.
- Pupil size is excluded from v1 entirely (not merely down-weighted) given how condition-dependent
  webcam pupillometry is (`RESEARCH.md` §H) — a stricter cut than the "low-weight" treatment given to
  the other behavioural cues, because the extraction step itself, not just the interpretation, is
  unreliable at consumer-webcam quality.
