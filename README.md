# Halo Pulse — Webcam Facial Stress Sensing

> **Working name:** "Halo Pulse" is a provisional codename for this project and may change.
>
> **Status:** Planning. This repository currently contains a **plan/specification**, not shipping
> software. See [`PLAN.md`](PLAN.md) for the full technical plan and roadmap.

## What we are building

A tool that uses an ordinary **webcam** to estimate a person's **stress level** and track how that
stress **develops over time**. It runs on the user's own device, watches the user's own face (with
explicit consent), and turns two kinds of signal into a personal stress index:

1. **Physiological (primary):** remote photoplethysmography (rPPG) recovers a pulse waveform from
   tiny colour changes in facial skin, yielding heart rate and heart-rate variability (HRV) — a
   well-established, if noisy, correlate of autonomic (sympathetic/parasympathetic) balance and acute
   stress. rPPG is computed by a **hybrid pipeline, in the MVP**: classical, fully-explainable methods
   (POS/OMIT/CHROM) run as an always-available baseline, alongside an **on-device deep-learning model**
   run locally via WebGPU — never uploaded, gated by measured, skin-tone-stratified validation before
   it's trusted to drive the score.
2. **Behavioural (supporting):** facial-tension cues from landmark/blendshape tracking — brow
   lowering, eyelid tightening, lip pressing, blink-rate deviation and its variability, and head
   stillness — always scored as *deviation from the user's own baseline*, never a fixed direction.

These are combined against a **personal calibrated baseline** into a relative stress index, and
recorded over sessions so the app can show **trends** — within a session, across a day, and across
weeks.

## Design principles

- **Local-first & private by default.** All video is processed in memory on-device. Raw frames and
  face images are **never stored or transmitted**; only derived numeric features and scores persist,
  locally. The user can export or delete everything.
- **Honest about the science.** Inferring emotion from facial expressions alone is scientifically
  contested. We anchor primarily on physiology (rPPG/HRV) and report **relative change vs. a personal
  baseline and trends**, not absolute verdicts about a person's inner state.
- **A wellness tool, not a medical device, and not for judging others.** No diagnosis. Not for
  surveillance, hiring, insurance, or use on people who have not consented.
- **Fair across users.** rPPG signal quality varies with skin tone and lighting — published error rates
  roughly triple from the lightest to the darkest skin-tone bins, and deep-learning methods are not
  immune. We evaluate on the **Monk Skin Tone scale** and treat a fairness gap as a release blocker,
  not a footnote — including for whether any learned component is trusted to influence the score.
- **Deep learning, used honestly.** An on-device deep-learning model ships **in the MVP**, not as a
  future upgrade — but only where measured, leave-one-subject-out and cross-dataset validation shows it
  helps for that device/lighting/skin-tone condition. Elsewhere the product falls back to fully
  classical, explainable signal processing rather than presenting an unvalidated number.

## Repository contents

This plan is split into a small doc set so each concern can be read and cited on its own:

| File | Purpose |
| --- | --- |
| [`PLAN.md`](PLAN.md) | **Start here.** Master plan: vision, scientific basis, scoring/calibration, privacy & regulatory framing, phased roadmap, risks, decision summary. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Concrete technical design: capture pipeline, MediaPipe usage, the TypeScript DSP module, the on-device deep-learning runtime, storage schema, visualization, PWA packaging, monorepo layout, build/test tooling. |
| [`VALIDATION.md`](VALIDATION.md) | The evidence base: HRV↔stress research, honest accuracy numbers, datasets, induction protocols, self-report instruments, the validation study design, metrics, and the skin-tone fairness gate. |
| [`RESEARCH.md`](RESEARCH.md) | Annotated bibliography — the ~40 primary sources behind this plan, grouped by theme, each tied to the claim it supports. |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records for the load-bearing, hard-to-reverse choices (e.g. hybrid classical+DL rPPG, local-only privacy model, the fairness gate). |
| `README.md` | This overview. |

## How this repo changed

This repository previously held the Halo Safety Intelligence legal documents. Those still live on the
`main` branch. This branch repurposes the repo toward the Halo Pulse plan; nothing here supersedes the
legal documents on `main`.

---

© 2026 Archeron Technologies. Planning document — subject to change.
