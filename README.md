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
   well-established correlate of autonomic (sympathetic/parasympathetic) balance and acute stress.
2. **Behavioural (supporting):** facial-tension cues from landmark/blendshape tracking — brow
   lowering, eyelid tightening, lip pressing, blink rate and its variability, and head stillness.

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
- **Fair across users.** rPPG signal quality varies with skin tone and lighting; we treat
  cross-skin-tone evaluation and bias mitigation as first-class requirements, not an afterthought.

## Repository contents

| File | Purpose |
| --- | --- |
| [`PLAN.md`](PLAN.md) | Master plan: scientific basis, architecture, tech stack, data model, privacy design, ML/calibration approach, validation, phased roadmap, milestones, risks. |
| `README.md` | This overview. |

## How this repo changed

This repository previously held the Halo Safety Intelligence legal documents. Those still live on the
`main` branch. This branch repurposes the repo toward the Halo Pulse plan; nothing here supersedes the
legal documents on `main`.

---

© 2026 Archeron Technologies. Planning document — subject to change.
