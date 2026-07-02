# Halo Pulse — Technical Plan

Provisional working name. This document is the master plan for building a tool that uses a webcam to
measure a user's stress level and track its development over time. It is a plan, not an
implementation.

---

## 1. Product vision

A person opens the app, allows camera access, and after a short one-time **calibration** the app shows
a live, gentle read-out of their current stress relative to their own baseline. Nothing is uploaded.
Over days and weeks it builds a private picture of **when** they tend to be stressed (time of day,
patterns, trend direction) so they can act on it — take a break, breathe, notice a rough week.

It is explicitly a **self-tracking wellness instrument**: it estimates likely physiological arousal
and facial tension and reports *change relative to the individual's own baseline*. It does not
diagnose, does not claim to read emotions or thoughts, and is not for use on other people.

### Primary user stories

- *Live check-in:* "Show me how stressed I seem right now vs. my normal."
- *Trends:* "Am I more stressed this week than last? What time of day is worst?"
- *Nudge (later):* "When arousal stays high for a while, offer a short breathing exercise."

### Non-goals

- Clinical diagnosis or medical measurement.
- Lie detection, emotion classification as ground truth, or judging other people.
- Any workplace/insurance/hiring surveillance use. This is a personal tool.

---

## 2. Scientific basis (and its limits)

We fuse two signal families. We are deliberately more confident about the first.

### 2.1 Physiological — rPPG → heart rate & HRV (primary)

Remote photoplethysmography recovers the blood-volume pulse from minute periodic colour changes in
facial skin captured on camera. From the recovered pulse we derive:

- **Heart rate (HR).**
- **Heart-rate variability (HRV):** time-domain **RMSSD** and **SDNN**, and frequency-domain **LF/HF**
  ratio from inter-beat intervals.

HRV is a well-supported, if noisy, correlate of autonomic nervous-system balance. Acute stress
typically shifts balance toward sympathetic dominance: **HR up, RMSSD down**, LF/HF up. Webcam-derived
HRV is noisier than a chest strap or ECG, so we use it for **relative, within-person** changes and
short-window trends, never as a clinical measurement.

**Recommended extraction pipeline:**

1. Track the face; select skin **ROIs** (forehead + both cheeks) from landmarks; exclude eyes, mouth,
   hair, glasses, and any occluded region per frame.
2. Compute the spatial mean **RGB** per ROI per frame → three raw time-series.
3. **Resample to a uniform timeline** using frame timestamps (webcam frame rate is uneven).
4. Detrend and **band-pass** to the plausible pulse band (≈0.7–4.0 Hz, ~42–240 bpm).
5. Combine channels with a motion/illumination-robust method — **POS** (Plane-Orthogonal-to-Skin, Wang
   et al. 2017) as default, with **CHROM** (de Haan & Jeanne 2013) as a fallback/comparison.
6. Estimate HR via spectral peak (Welch) and/or peak-to-peak detection; derive inter-beat intervals →
   HRV metrics. Track a **signal-quality index (SQI)** and discard/curtail low-quality windows.

### 2.2 Behavioural — facial tension cues (supporting)

From face-landmark and blendshape tracking we derive tension proxies that *modulate* the score but do
not dominate it:

- **Brow lowering / furrow** (corrugator activity; `browDown*` blendshapes).
- **Eyelid tightening** and squint.
- **Lip pressing / jaw tension** proxies.
- **Blink rate** and **blink-rate variability** (both shift under cognitive load/stress).
- **Head micro-motion / stillness** and fidget cadence.

### 2.3 Honest limitations (must be surfaced in-product)

- **Facial-expression → emotion inference is contested** (cf. Barrett et al., 2019). We therefore lean
  on physiology and on *relative change vs. the user's own baseline*, and we label behavioural cues as
  weak, supporting signals.
- **rPPG is sensitive to lighting, motion, camera quality, and frame rate**, and **signal quality
  varies with skin tone** — a fairness risk we test for explicitly (§9, §11).
- Confounders (caffeine, exercise, illness, temperature, talking, alcohol) affect HR/HRV independent of
  psychological stress. We surface uncertainty rather than overclaiming.

---

## 3. System architecture

A layered, local-first pipeline. Everything from capture to scoring runs on-device.

```
┌────────────────────────────────────────────────────────────────────┐
│  Capture:  getUserMedia → frames (in memory only, never persisted)   │
├────────────────────────────────────────────────────────────────────┤
│  Vision:   face detect → 468 landmarks + blendshapes → skin ROIs     │
├────────────────────────────────────────────────────────────────────┤
│  Signals:  rPPG (POS/CHROM) → HR, HRV        Behaviour: AUs, blink,   │
│            + signal-quality index (SQI)      head-motion features     │
├────────────────────────────────────────────────────────────────────┤
│  Features: windowed feature vectors (e.g. 30 s sliding windows)      │
├────────────────────────────────────────────────────────────────────┤
│  Scoring:  baseline deviation + fusion → Stress Index (0–100 / band) │
├────────────────────────────────────────────────────────────────────┤
│  Store:    derived features & session summaries only (IndexedDB)     │
├────────────────────────────────────────────────────────────────────┤
│  UI:       live gauge + quality meter · history/trends · settings    │
└────────────────────────────────────────────────────────────────────┘
```

Key property: the two boxes at the top (raw frames, landmarks) live only in memory for the duration of
a session. Only the **Features** layer and below are ever written to disk, and only as numbers.

---

## 4. Technology choices

### 4.1 Recommendation: web-first MVP + Python research harness

Ship the product as a **local browser web app**, and maintain a separate **Python harness** for offline
algorithm development and validation.

**Why web-first for the product:**

- **Private by construction** — data need never leave the device; no server to secure or trust.
- **Zero install, cross-platform** (desktop + mobile), installable as a **PWA** for offline use.
- `getUserMedia` + WebGL/WASM give enough performance for real-time rPPG and landmark tracking.

**Why a Python harness alongside it:**

- Fast iteration on rPPG/HRV DSP with `numpy`/`scipy`; batch evaluation over recorded datasets;
  training/validating any ML model; generating the metrics in §9. Not shipped to users.

### 4.2 Proposed stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Language / build | **TypeScript + Vite** | Type safety; fast dev + PWA build. |
| Face landmarks | **MediaPipe Tasks — Face Landmarker** | 468 landmarks + blendshapes (AU-like); WASM/GPU. |
| rPPG / DSP | Custom TS module (POS, CHROM, band-pass, Welch) | Small, auditable; validated against the Python harness. |
| Charts | **uPlot** (perf) or **Recharts** (ergonomics) | Real-time gauge + historical trends. |
| Local storage | **IndexedDB** via a thin wrapper (e.g. `idb`) | Derived data only. |
| State/UI | Lightweight (Preact/Svelte, or React if preferred) | Keep the render loop cheap. |
| Research harness | **Python** (`opencv`, `mediapipe`, `numpy`, `scipy`, `pandas`) | Offline only; algorithm dev + validation. |
| Optional packaging | **PWA** first; **Electron/Tauri** later if a desktop app is wanted | — |

### 4.3 Rejected/deferred

- **Cloud inference:** rejected for MVP — conflicts with the privacy model.
- **Native mobile (Swift/Kotlin):** deferred — a PWA covers early mobile needs; revisit if camera/perf
  access demands it (and note synergy with the existing Halo mobile app).

---

## 5. Data model (all local)

Stored in IndexedDB. **No raw frames, no images**, only numbers and metadata.

- **`baseline`** — per-profile calibrated rest statistics: mean/SD of HR, RMSSD, SDNN, LF/HF, blink
  rate, brow/lip tension; capture conditions; timestamp; version.
- **`session`** — one measurement session: `id`, start/end, duration, device/lighting metadata,
  aggregate stress index (mean/median/peak), mean HR, HRV summary, mean SQI, calibration ref.
- **`sample`** — windowed feature vectors within a session (e.g. every 5–30 s): timestamp, HR, HRV
  metrics, behavioural features, per-window SQI, window stress index.
- **`settings`** — consent state, retention policy, sensitivity, theme, feature toggles.

Derived daily/weekly aggregates for trends can be computed on read or cached in a small `rollup` store.

---

## 6. Stress scoring & calibration

**Calibration (one-time, re-runnable):** a short guided **rest** recording (e.g. 60–120 s, relaxed,
still, good light) establishes the personal baseline distribution of every feature. Everything
downstream is expressed as **deviation from this baseline**, which is what makes the score personal and
defensible.

**Scoring — phased, from transparent to learned:**

1. **v1 — transparent composite (ship first).** Per window, compute robust z-scores of features vs.
   baseline (HR↑, RMSSD↓, LF/HF↑, brow/lip tension↑, blink-rate deviation, reduced stillness), combine
   with fixed, physiology-weighted weights into a 0–100 index, then map to bands (Calm / Neutral /
   Elevated / High). **Weight by SQI**; when quality is poor, widen the confidence interval or show
   "signal too weak" instead of a number. Explainable and debuggable — the right default.
2. **v2 — personalized ML (later, opt-in).** With user-labelled sessions (self-report) and/or an
   induced-stress protocol, train a small model (e.g. gradient-boosted trees or a compact temporal
   model) per user or population, still on-device. Only pursued once v1 is validated and enough labels
   exist.

**Temporal smoothing:** report a smoothed index (moving average / light Kalman filter) so the live
read-out is calm, not jittery, while retaining responsiveness.

**Trends over time (the "development" requirement):**

- Within-session timeline of the index.
- Daily and weekly aggregates; **time-of-day** patterns (heatmap/calendar).
- Moving averages and simple **change-point/trend** detection ("trending up over 2 weeks").
- Always framed as *your* change over time, with visible uncertainty.

---

## 7. Privacy, security & consent (first-class)

Biometric-derived data is sensitive (GDPR special category). The architecture minimizes exposure by
design.

- **On-device only by default.** No backend for the core product; nothing uploaded.
- **No raw media persisted.** Frames/landmarks exist only in memory during a session and are discarded;
  we store only derived numeric features and scores.
- **Explicit, revocable consent** before first capture; clear camera-in-use indicator; easy pause/stop.
- **User data control:** one-tap **export** (JSON/CSV) and **delete-all**; configurable retention.
- **Transparency:** in-product explanation of what is measured, how, and its limitations; prominent
  non-medical disclaimer.
- **Use restrictions in terms:** personal self-use only; not for use on non-consenting third parties,
  nor for surveillance/employment/insurance decisions.
- If any optional sync/backup is ever added, it must be **opt-in, end-to-end encrypted**, feature-level
  only (never media), with a clear privacy notice — reusing the diligence already reflected in the
  Halo legal docs on `main`.

---

## 8. UX overview

- **Onboarding:** purpose, privacy promise, consent, camera check, calibration.
- **Live session:** video preview with ROI overlay (toggle), a calm animated **stress gauge**, a
  **signal-quality meter**, HR read-out, and a start/stop control.
- **History:** trend charts (session, day, week), time-of-day heatmap, session list with summaries.
- **Insights (later):** plain-language observations and optional breathing-exercise interventions.
- **Settings:** consent/retention, sensitivity, calibration re-run, export/delete, accessibility.
- **Accessibility & tone:** non-alarming language, color-blind-safe palettes, never pathologizing.

---

## 9. Validation & evaluation

We hold ourselves to measured accuracy, reported honestly.

- **rPPG HR accuracy:** vs. a reference pulse oximeter / chest strap — target **MAE < ~3–5 bpm** in
  good conditions; report degradation by lighting/motion.
- **HRV agreement:** correlation of RMSSD vs. reference; report bias and limits (Bland–Altman).
- **Stress-index validity:** within-subject **induced-stress protocol** (e.g. paced arithmetic / Stroop
  vs. rest) should raise the index; correlate against a validated self-report (**PSS-10**, or **STAI**
  short form). Report effect sizes, not just "it works."
- **Fairness:** stratify **all** metrics by **skin tone** (e.g. Fitzpatrick/Monk scale), lighting, and
  device class; set and track parity targets; treat a gap as a release blocker for claims of general
  accuracy.
- **Reliability:** test–retest stability of the baseline and index under matched conditions.

The Python harness (§4) runs these evaluations over recorded, consented datasets and produces a
reproducible report each release.

---

## 10. Phased roadmap & milestones

Each phase has a demoable outcome and acceptance criteria.

### Phase 0 — Spike (feasibility)
Prove the pipeline end-to-end, roughly.
- Webcam capture, face landmarks, forehead ROI, naïve band-pass HR estimate; live HR number.
- **Done when:** live HR tracks a reference within a plausible range in good light.

### Phase 1 — MVP: reliable single-session stress read-out
- Robust rPPG (POS) + SQI; multi-ROI; timestamp resampling.
- Calibration flow + personal baseline.
- v1 transparent composite **Stress Index** with quality-gating.
- Live gauge + quality meter; local persistence of session summaries.
- **Done when:** calibration + a live, smoothed, quality-gated index work reliably; nothing is uploaded;
  raw frames are provably never persisted.

### Phase 2 — Trends over time
- Session history; daily/weekly aggregates; time-of-day heatmap; trend/change-point detection.
- Data **export** and **delete-all**; retention settings.
- **Done when:** a user can see week-over-week and time-of-day patterns and fully control their data.

### Phase 3 — Personalization & accuracy
- Labelled-session capture (opt-in self-report); on-device v2 model; A/B vs. v1.
- Confounder handling and better motion robustness.
- **Done when:** v2 beats v1 on the §9 metrics for opted-in users without regressing fairness.

### Phase 4 — Validation, fairness & polish
- Run the full §9 validation, **including cross-skin-tone fairness**; publish an honest results summary.
- PWA/offline polish; accessibility pass; optional breathing-exercise interventions.
- **Done when:** validation report meets targets (or limits are documented) and the app is
  installable, accessible, and calm.

### Later / optional
- Desktop packaging (Tauri/Electron); reminders/nudges; opt-in E2E-encrypted backup; possible
  integration with the Halo app family.

---

## 11. Risks & open questions

| Risk / question | Mitigation |
| --- | --- |
| rPPG unreliable in poor light / motion / low-quality cams | SQI gating; POS+CHROM; guidance during capture; "signal too weak" state instead of a bad number. |
| **Signal quality varies by skin tone → bias** | Explicit cross-skin-tone evaluation (§9); diverse test data; parity targets as release gates. |
| Facial-expression→emotion validity is contested | Physiology-primary scoring; relative-to-baseline framing; behavioural cues weighted low and labelled weak. |
| Uneven webcam frame rate corrupts spectral estimates | Timestamp-based resampling to a uniform grid before DSP. |
| Confounders (caffeine, exercise, illness, talking) | Surface uncertainty; optional context tags; avoid absolute claims. |
| CPU/battery cost of real-time vision | Downscale ROIs, throttle landmark rate, WASM/GPU, adaptive quality. |
| Privacy/regulatory exposure of biometric data | Local-only, no-media-persistence design; consent; export/delete; restrictive terms. |
| Over-trust / anxiety from a "stress number" | Calm UX, ranges not verdicts, visible confidence, non-medical disclaimer. |
| **Open:** best default calibration length & re-cal cadence? | Determine empirically in Phases 1–3. |
| **Open:** per-user vs. population v2 model? | Decide from Phase 3 data. |

---

## 12. Proposed repository structure (once building starts)

```
halo-pulse/
├── apps/
│   └── web/                # TypeScript + Vite PWA (product)
│       ├── src/
│       │   ├── capture/    # getUserMedia, frame loop, timestamps
│       │   ├── vision/     # MediaPipe landmarks/blendshapes, ROI selection
│       │   ├── signals/    # rPPG (POS/CHROM), band-pass, HRV, SQI
│       │   ├── behaviour/  # AUs, blink, head-motion features
│       │   ├── scoring/    # baseline, fusion, stress index (v1 → v2)
│       │   ├── store/      # IndexedDB (derived data only)
│       │   └── ui/         # live gauge, trends, settings
│       └── ...
├── packages/
│   ├── dsp/                # shared signal-processing utilities
│   └── types/              # shared feature/session schemas
├── research/               # Python harness: algorithm dev + §9 validation (not shipped)
│   ├── rppg/
│   ├── validation/
│   └── notebooks/
└── docs/                   # architecture notes, validation reports, privacy notes
```

---

## 13. Summary of key decisions

1. **Physiology-primary** (rPPG/HRV) with behavioural cues as weak supporting signals.
2. **Relative-to-personal-baseline** scoring and **trend** reporting — not absolute emotion verdicts.
3. **Local-first, no-media-persistence** privacy model; derived numbers only.
4. **Web-first PWA** product + **Python research harness** for validation.
5. **v1 transparent composite** score before any ML; ML only after v1 is validated.
6. **Fairness across skin tones** treated as a release-gating requirement, not an afterthought.
7. Positioned strictly as a **personal wellness tool** — not medical, not for use on others.

*This is a living plan and will evolve as Phase 0/1 findings come in.*
