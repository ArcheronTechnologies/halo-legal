# Halo Pulse — Master Plan

Provisional working name. This is the master plan for a tool that uses a webcam to measure a user's
stress level and track its development over time. It is a plan, not an implementation.

This document is the entry point into a small doc set — see [`README.md`](README.md) for the map.
Companion documents: [`ARCHITECTURE.md`](ARCHITECTURE.md) (concrete tech design),
[`VALIDATION.md`](VALIDATION.md) (evidence, accuracy targets, study design),
[`RESEARCH.md`](RESEARCH.md) (annotated bibliography), [`docs/adr/`](docs/adr/) (numbered decision
records for the choices below).

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

We fuse two signal families and are deliberately more confident about the first. Full evidence,
citations, and honest accuracy numbers are in [`VALIDATION.md`](VALIDATION.md); this section states
the conclusions and what they mean for the product.

### 2.1 Physiological — rPPG → heart rate & HRV (primary)

Remote photoplethysmography (rPPG) recovers the blood-volume pulse from minute periodic colour changes
in facial skin captured on camera. From the recovered pulse we derive **heart rate (HR)** and
**heart-rate variability (HRV)**: time-domain **RMSSD** (primary) and **SDNN** (secondary).

**We deliberately lead on HR↑ and RMSSD↓, and de-emphasize LF/HF.** Acute stress shifts autonomic
balance toward sympathetic dominance, classically stated as "HR up, RMSSD down, LF/HF up." But LF/HF
has two independent problems for this product: the ratio does not cleanly index sympathovagal balance
even in controlled physiology (see [`RESEARCH.md`](RESEARCH.md) §3), and it needs ≥1–2 minutes of
clean inter-beat intervals to estimate — often infeasible from a jittery webcam session. RMSSD is
valid from much shorter windows (~10–30 s) and is the best-grounded, best-measurable HRV metric
available to us. LF/HF may still be computed and shown, but only as a hedged, low-weight, tertiary
input — never a headline number.

**Extraction pipeline (detailed in [`ARCHITECTURE.md`](ARCHITECTURE.md) §2):**

1. Track the face; select skin **ROIs** (forehead + both cheeks) from landmarks; exclude eyes, mouth,
   hair, glasses, and any occluded region per frame.
2. Compute the spatial mean **RGB** per ROI per frame → three raw time-series.
3. **Resample to a uniform timeline** using true per-frame timestamps (webcam frame rate is uneven;
   see `ARCHITECTURE.md` for the `requestVideoFrameCallback` fix).
4. Detrend (Tarvainen smoothness-priors) and **band-pass** to the plausible pulse band (≈0.7–4.0 Hz).
5. **Recover the pulse two ways, in parallel, in the MVP** (see 2.1.1 below): a classical
   motion/illumination-robust combiner, and an on-device deep-learning model.
6. Estimate HR via spectral peak (Welch) and/or peak detection; derive inter-beat intervals → HRV.
   Track a **signal-quality index (SQI)** and discard/curtail low-quality windows — when quality is
   too low, the product shows "signal too weak," never a fabricated number.

**Capture constraint we add explicitly: minimize video compression.** Browsers deliver compressed
webcam frames by default, and compression destroys exactly the subtle chrominance changes rPPG needs.
The capture layer requests the highest-bitrate / least-compressed stream the platform allows. This is
also why the classical method set below includes OMIT, which was designed to tolerate compression.

#### 2.1.1 Hybrid rPPG: classical + on-device deep learning, both in the MVP

**Decision:** deep learning is not deferred to a later phase — it ships in the MVP, run alongside
classical methods, not instead of them. See [ADR-0002](docs/adr/0002-hybrid-rppg-classical-and-dl.md)
for the full rationale and trade-offs.

- **Classical layer (always on, the auditable baseline):** **POS** (Plane-Orthogonal-to-Skin, Wang et
  al. 2017) as default, **OMIT** (Álvarez-Casado et al. 2023) for its compression robustness, **CHROM**
  (de Haan & Jeanne 2013) as fallback, **LGI** (Pilz et al. 2018) for high-motion windows. These are
  cheap, need no training data, are fully explainable, and — per the research in `RESEARCH.md` — tend
  to *match or beat* deep models once you leave the training distribution.
- **Deep-learning layer (on-device, in the MVP):** a compact rPPG network run locally via
  `onnxruntime-web` on the WebGPU backend (WASM fallback). Candidates, to be settled in the Phase 0
  spike (see §10): **TS-CAN** or **EfficientPhys** (supervised, edge-optimized) or **Contrast-Phys+**
  (unsupervised — trains without ground-truth labels, which also sidesteps a chunk of the
  dataset-licensing problem in §2.1.2). All weight/inference math stays on-device; nothing about the
  privacy model changes.
- **Fusion/selection:** the two layers run per-window; the scorer selects or blends based on **SQI**
  and known operating conditions (device class, lighting, whether the DL model has passed its fairness
  gate for the detected skin tone bin — see §6). Classical output is the always-available fallback;
  DL is preferred where it has been validated to help and degrades gracefully to classical everywhere
  else, including on low-end devices that cannot afford the extra inference cost.
- **Guardrail we keep from the research despite shipping DL in the MVP:** a deep model's in-domain
  accuracy is not evidence it will generalize to a given user's device, lighting, or skin tone.
  Before the DL layer is allowed to influence the shown score for a given operating condition, it must
  clear the **LOSO + cross-dataset + Monk-stratified** validation bar in [`VALIDATION.md`](VALIDATION.md)
  §5. Until then, that condition is served by classical-only. This turns "ship DL in the MVP" into "ship
  DL in the MVP, gated by measured evidence," rather than an unvalidated claim.

#### 2.1.2 Licensing constraint this creates

The two richest rPPG toolboxes are not clean for shipping: **rPPG-Toolbox is RAIL-licensed**
(use-restricted) and **pyVHR is GPL-3.0** (copyleft). Both are excellent as the **Python research
harness's** reference oracle (§9, `ARCHITECTURE.md` §8) but must never enter the shipped app. The
shipped classical methods are a **clean-room TypeScript port**, validated against the harness. The
shipped **DL weights** carry the same constraint one level up: pretrained weights distributed with
rPPG-Toolbox are RAIL, and several source datasets forbid commercial use — so the DL model is either
**trained from scratch** in the harness (unsupervised Contrast-Phys+ is attractive here specifically
because it doesn't need licensed *labels*, only video) or sourced from weights with a clean permissive
license. This is tracked as [ADR-0005](docs/adr/0005-local-only-and-clean-licensing.md).

### 2.2 Behavioural — facial tension cues (supporting, signed against baseline)

From face-landmark and blendshape tracking we derive tension proxies that *modulate* the score but
never dominate it, and are always expressed as **deviation from the user's own baseline**, not a fixed
direction:

- **Brow lowering / furrow** (AU4; `browDown*` blendshapes).
- **Eyelid tightening** (AU7; `eyeSquint*`).
- **Lip pressing** (AU23/24; `mouthPress*`).
- **Blink rate deviation and blink-rate variability** — deliberately *not* signed as "more blinking =
  more stress." The evidence is bidirectional: blinking is *suppressed* during focused cognitive load
  and *elevated* with anxiety and just after a task ends. Feeding raw blink rate with an assumed
  direction would be wrong for a screen-focused user. We feed the deviation and its variability, and
  let the personal baseline and the composite scorer establish the direction empirically per user.
- **Head micro-motion / stillness** and fidget cadence, likewise unsigned/deviation-based.

**Pupil size is excluded from v1.** It's a genuinely strong cognitive-load signal in controlled
settings, but webcam extraction is fragile — highly sensitive to resolution, distance, and ambient
light (which itself drives pupil size) — so we don't trust it at consumer-webcam quality yet. Revisit
only if a future phase can control capture conditions.

### 2.3 Honest limitations (surfaced in-product, not just in this doc)

- **Facial-expression → emotion inference is scientifically contested.** Barrett et al. (2019) found
  the "common view" — that a specific facial configuration reliably signals a specific emotion — fails
  reliability (~15–25% of instances), specificity, and validity criteria in a systematic review of the
  evidence. We therefore never surface an emotion label. The product describes outputs as **facial
  tension / physiological arousal relative to your own baseline**, using descriptive language ("brow
  tension above your baseline"), not inferential language ("you seem angry"). Full discussion in
  [`RESEARCH.md`](RESEARCH.md) §4.
- **rPPG is sensitive to lighting, motion, camera quality, compression, and frame rate**, and **signal
  quality degrades on darker skin** — a fairness risk that is a release gate, not an afterthought
  (§6, `VALIDATION.md` §6).
- **Confounders** (caffeine, exercise, illness, temperature, talking, alcohol) move HR/HRV independent
  of psychological stress. We surface uncertainty and relative trends rather than absolute claims.

---

## 3. System architecture (summary)

Full detail, package layout, and library choices are in [`ARCHITECTURE.md`](ARCHITECTURE.md). In
outline, a layered, local-first pipeline:

```
┌────────────────────────────────────────────────────────────────────────┐
│  Capture:  getUserMedia + requestVideoFrameCallback → timestamped frames  │
│            (in memory only, never persisted)                              │
├────────────────────────────────────────────────────────────────────────┤
│  Vision:   MediaPipe Face Landmarker → 478 landmarks + 52 blendshapes     │
│            + head-pose matrix → skin ROIs                                 │
├────────────────────────────────────────────────────────────────────────┤
│  Signals:  rPPG — classical (POS/OMIT/CHROM/LGI) AND on-device DL         │
│            (onnxruntime-web/WebGPU) → HR, HRV, SQI                        │
│            Behaviour: AUs, blink deviation, head-motion deviation          │
├────────────────────────────────────────────────────────────────────────┤
│  Features: windowed feature vectors (e.g. 30 s sliding windows)           │
├────────────────────────────────────────────────────────────────────────┤
│  Scoring:  baseline deviation + fusion (composite + optional DL/XGBoost   │
│            ensemble) → Stress Index (0–100 / band) + confidence           │
├────────────────────────────────────────────────────────────────────────┤
│  Store:    derived features & session summaries only (IndexedDB/Dexie)    │
├────────────────────────────────────────────────────────────────────────┤
│  UI:       live gauge + quality meter · history/trends · settings         │
└────────────────────────────────────────────────────────────────────────┘
```

The invariant that matters most: everything above the **Features** layer lives only in memory for the
duration of a session. Only derived numbers are ever written to disk.

---

## 4. Technology choices (summary)

**Web-first PWA product + Python research harness**, unchanged from the original direction and
reinforced by the implementation research:

| Concern | Choice | Why (detail in `ARCHITECTURE.md`) |
| --- | --- | --- |
| Product platform | TypeScript + Vite, PWA | Private by construction; zero-install; cross-platform |
| Frame timestamps | `requestVideoFrameCallback` → `mediaTime` | The concrete fix for uneven webcam fps |
| Face landmarks | `@mediapipe/tasks-vision` Face Landmarker, self-hosted | 478 landmarks + 52 blendshapes + head pose; Apache-2.0 |
| Classical rPPG/DSP | Custom TypeScript (POS/OMIT/CHROM/LGI, fili.js, fft.js) | No maintained permissive JS rPPG library exists |
| On-device DL | `onnxruntime-web` on WebGPU (WASM fallback), **in the MVP** | Runs the DL rPPG model locally; self-hosted weights |
| Local storage | Dexie.js over IndexedDB | Typed tables, migrations, live queries; derived data only |
| Charts | uPlot (series) + custom SVG gauge + cal-heatmap (time-of-day) | Performance at scale; calm live animation |
| Research harness | Python 3.12: opencv, mediapipe, numpy/scipy, pandas, NeuroKit2, HeartPy, rPPG-Toolbox, pyVHR, scikit-learn/xgboost | Reference oracle for TS parity tests; **not shipped** |
| Packaging | PWA first; Tauri 2 or Electron later if desktop is needed | Engine consistency matters more than bundle size here |

---

## 5. Data model (all local, summary)

Stored in IndexedDB via Dexie. **No raw frames, no images, no face templates** — only numbers and
metadata:

- **`baseline`** — per-profile calibrated rest statistics: mean/SD of HR, RMSSD, SDNN, LF/HF (hedged),
  blink-rate deviation stats, brow/lid/lip tension stats; capture conditions; timestamp; version.
- **`session`** — one measurement session: id, start/end, duration, device/lighting metadata, which
  rPPG layer(s) contributed (classical/DL/blend), aggregate stress index, mean HR, HRV summary, mean
  SQI, calibration reference.
- **`sample`** — windowed feature vectors within a session (e.g. every 5–30 s): timestamp, HR, HRV
  metrics, behavioural features, per-window SQI, window stress index and confidence.
- **`settings`** — consent state, retention policy, sensitivity, theme, feature toggles.
- **`rollup`** (optional cache) — daily/weekly aggregates for trend views.

Full schema in [`ARCHITECTURE.md`](ARCHITECTURE.md) §5.

---

## 6. Stress scoring, calibration & fairness

**Calibration (one-time, re-runnable):** a short guided **rest** recording (60–120 s, relaxed, still,
good light) establishes the personal baseline distribution of every feature. Everything downstream is
expressed as **deviation from this baseline** — the source of both the product's personalization and
its main defense against the generalization problems documented in `VALIDATION.md`.

**Scoring, phased but with DL present from the start:**

1. **v1 composite (the explainable default, ships in the MVP).** Per window, robust z-scores of each
   feature vs. baseline, combined with fixed, physiology-weighted weights (HR↑, RMSSD↓ dominant;
   LF/HF↑ low-weight/hedged; behavioural cues low-weight and signed per §2.2) into a 0–100 index, then
   mapped to bands (Calm / Neutral / Elevated / High). **Weighted by SQI**; below a quality floor the
   product shows "signal too weak" instead of a number. This is always computable, always explainable,
   and is the fallback whenever the learned layers below are not validated for the current condition.
2. **DL/learned ensemble (also in the MVP, gated).** The on-device DL rPPG model (§2.1.1) feeds HR/HRV
   into the same composite when it has cleared its per-condition validation gate. Additionally, an
   XGBoost/LightGBM model over engineered features (trained in the harness, exported to ONNX, run via
   `onnxruntime-web`) may run alongside the composite as an interpretable learned option. Neither
   learned component ever *replaces* the composite in the MVP — they augment it where validated, and
   the product always shows when it is relying on the composite alone vs. an ensemble.
3. **Personalize before you deepen.** The single largest accuracy lever the research surfaced is
   per-user calibration and thresholding, not model sophistication — so personalization work (adaptive
   baselines, per-user thresholds) is prioritized ahead of adding model complexity beyond what ships in
   the MVP. A compact temporal model (1D-CNN/TCN) is a candidate for later phases, once enough opted-in
   labeled sessions exist, evaluated the same way (LOSO, cross-dataset) before it can drive the score.

**Temporal smoothing:** the shown index is smoothed (moving average / light Kalman filter) so the live
read-out is calm, not jittery, while remaining responsive.

**Fairness gate — non-negotiable release condition:** every accuracy claim, and every decision to let
a learned layer drive the score, is evaluated **stratified by the Monk Skin Tone (10-point) scale**
(chosen over Fitzpatrick — see [ADR-0006](docs/adr/0006-monk-skin-tone-fairness-gate.md)). Published
evidence has rPPG error roughly tripling from the lightest to the darkest skin-tone bins, and DL models
are not immune. A cross-skin-tone parity gap is a **release blocker** for any general-accuracy claim,
not a known-issue footnote. Where a user's condition falls outside validated parity, the product
degrades to classical-only and/or widens its confidence interval rather than presenting a falsely
precise number.

**Trends over time (the "development" requirement):** within-session timeline; daily/weekly
aggregates; time-of-day patterns; moving averages and simple change-point/trend detection ("trending up
over 2 weeks") — always framed as *your* change over time, with visible uncertainty.

---

## 7. Privacy, security, consent & regulatory framing

Biometric-derived and mental-state-adjacent data is sensitive. The architecture minimizes exposure by
design, and the product's language is itself a compliance control, not just a UX choice.

- **On-device only by default.** No backend for the core product; nothing uploaded — this holds for
  the DL inference path too, since weights and frames never leave the device.
- **No raw media persisted.** Frames/landmarks exist only in memory during a session and are discarded;
  only derived numeric features and scores are stored, locally.
- **Explicit, revocable consent** before first capture; a clear camera-in-use indicator; easy
  pause/stop.
- **User data control:** one-tap **export** (JSON/CSV) and **delete-all**; configurable retention.
- **Never "emotion recognition."** Outputs are described as physiological arousal / facial tension
  relative to the user's own baseline — descriptive, not inferential language, per §2.3. This framing,
  combined with strictly personal-use positioning, is the primary control keeping the product clear of:
  - the **EU AI Act**'s emotion-recognition provisions (a hard prohibition in workplace/education
    contexts, in force since Feb 2025; transparency obligations elsewhere);
  - **Illinois BIPA** and similar US biometric statutes, by design — the product performs no
    face-geometry *identification* and stores no face templates, only derived physiological/behavioural
    numbers;
  - the **FDA**'s medical-device line, by making no diagnostic or disease-related claims and staying
    within the general-wellness, low-risk category.
- **Use restrictions in terms:** personal self-use only; explicitly not for use on non-consenting third
  parties, nor for surveillance, employment, or insurance decisions — enforced in practice by the
  local-only architecture (there is no data to subpoena or sell).
- A **DPIA** is advisable given that stress/arousal inference can constitute health-adjacent data under
  GDPR even where face geometry itself is not used to identify anyone.
- If any optional sync/backup is ever added, it must be **opt-in, end-to-end encrypted**, feature-level
  only (never media), with a clear privacy notice — reusing the diligence already reflected in the
  Halo legal docs on `main`.

Full regulatory detail and sources: [`RESEARCH.md`](RESEARCH.md) §6; the guardrail checklist is in
[`VALIDATION.md`](VALIDATION.md) §7.

---

## 8. UX overview

- **Onboarding:** purpose, privacy promise, consent, camera check, calibration.
- **Live session:** video preview with ROI overlay (toggle), a calm animated **stress gauge**, a
  **signal-quality meter**, HR read-out, an indicator of which signal layer(s) are contributing
  (classical / DL-assisted), and a start/stop control.
- **History:** trend charts (session, day, week), time-of-day heatmap, session list with summaries.
- **Insights (later):** plain-language observations and optional breathing-exercise interventions.
- **Settings:** consent/retention, sensitivity, calibration re-run, export/delete, accessibility.
- **Accessibility & tone:** non-alarming, descriptive (never inferential) language; color-blind-safe
  palettes; never pathologizing.

---

## 9. Validation & evaluation (summary)

Full study design, datasets, instruments, and metrics: [`VALIDATION.md`](VALIDATION.md). Headlines:

- **rPPG HR accuracy:** target MAE **<3–5 bpm in good conditions**; realistic range is ~1–2 bpm ideal
  to ~10+ bpm under motion/talking — report both, not just the best case.
- **HRV agreement:** correlation and Bland–Altman vs. an ECG/chest-strap reference; expect materially
  wider error than HR (webcam RMSSD error is a large fraction of the human resting range) — this is why
  HRV is reported as trend, not absolute value.
- **Stress-index construct validity:** a within-subject induced-stress protocol (Stroop / MIST /
  serial-subtraction) should raise the index, correlating with **STAI-State** (acute) and, separately,
  with **PSS-10** as a *longitudinal* trend check — not as the acute-session instrument, which was a
  mismatch in the original draft of this plan.
- **DL-specific evaluation:** the deep-learning rPPG layer is evaluated with **leave-one-subject-out**
  and, where possible, **cross-dataset** splits — never window-level random splits, which inflate
  apparent accuracy and hide the generalization failures the research repeatedly found.
- **Fairness:** every metric above stratified by **Monk skin-tone bin**, lighting, and device class;
  parity gaps block general-accuracy claims and gate whether the DL layer is allowed to drive the score
  for that bin.
- **Reliability:** test–retest stability (ICC) of baseline and index under matched conditions.

---

## 10. Phased roadmap & milestones

Each phase has a demoable outcome and acceptance criteria. Deep learning is present starting **Phase
0**, not deferred to a later phase, per the product decision in §2.1.1.

### Phase 0 — Spike (feasibility, including the DL path)
- Webcam capture with `requestVideoFrameCallback` timestamps; face landmarks; forehead ROI; naïve
  band-pass HR estimate — live HR number.
- **Also in this phase:** stand up the on-device DL inference path — load a candidate rPPG model
  (TS-CAN / EfficientPhys / Contrast-Phys+) via `onnxruntime-web` on WebGPU, measure real per-frame
  latency/CPU/GPU budget on representative hardware, and confirm the WASM fallback works. Pick the
  primary DL candidate based on this spike, weighing the licensing consideration in §2.1.2.
- **Done when:** live HR tracks a reference within a plausible range in good light, *and* the DL
  inference path runs on-device within a defined latency budget with a working fallback.

### Phase 1 — MVP: reliable single-session stress read-out, hybrid rPPG
- Classical layer: POS + OMIT (+ CHROM fallback), multi-ROI, timestamp resampling, SQI.
- DL layer: the Phase 0 model integrated behind the SQI/condition-gated fusion described in §2.1.1,
  shipping classical-only wherever the DL layer hasn't cleared validation for that condition.
- Calibration flow + personal baseline.
- v1 transparent composite **Stress Index** with quality-gating, plus the DL/XGBoost ensemble where
  gated in.
- Live gauge + quality meter (+ signal-layer indicator); local persistence of session summaries.
- **Done when:** calibration + a live, smoothed, quality-gated index work reliably; the app is honest
  in the UI about which signal layer(s) are active; nothing is uploaded; raw frames are provably never
  persisted.

### Phase 2 — Trends over time
- Session history; daily/weekly aggregates; time-of-day heatmap; trend/change-point detection.
- Data **export** and **delete-all**; retention settings.
- **Done when:** a user can see week-over-week and time-of-day patterns and fully control their data.

### Phase 3 — Personalization & accuracy
- Labelled-session capture (opt-in self-report); per-user adaptive baseline/thresholds (the biggest
  lever per §6); expanded XGBoost/temporal-DL options; A/B vs. the Phase 1 composite+DL baseline.
- Confounder handling and better motion robustness.
- **Done when:** any additional learned layer beats the Phase 1 baseline on the `VALIDATION.md` §6
  metrics for opted-in users, without regressing Monk-stratified fairness.

### Phase 4 — Validation, fairness & polish
- Run the full `VALIDATION.md` study, **including cross-skin-tone fairness and DL LOSO/cross-dataset
  evaluation**; publish an honest results summary.
- PWA/offline polish (including precached DL weights); accessibility pass; optional breathing-exercise
  interventions.
- **Done when:** the validation report meets targets (or limits are documented) and the app is
  installable, accessible, calm, and works offline including the DL inference path.

### Later / optional
- Desktop packaging (Tauri/Electron); reminders/nudges; opt-in E2E-encrypted backup; possible
  integration with the Halo app family.

---

## 11. Risks & open questions

| Risk / question | Mitigation |
| --- | --- |
| rPPG unreliable in poor light / motion / low-quality cams | SQI gating; POS+OMIT+CHROM+LGI; capture guidance; "signal too weak" state instead of a bad number |
| **Signal quality varies by skin tone → bias, in both classical and DL layers** | Monk-stratified evaluation as a release gate (§6, `VALIDATION.md` §6); DL layer only trusted where validated per bin; classical fallback elsewhere |
| **DL model doesn't generalize to a given user's device/lighting/skin tone** | LOSO + cross-dataset validation required before the DL layer influences the score for a condition; classical-only fallback is always available |
| **Shipped DL weights carry restrictive licensing (RAIL/dataset terms)** | Train in-harness (favoring unsupervised Contrast-Phys+) or source cleanly-licensed weights; never ship RAIL/GPL code or weights in the app ([ADR-0005](docs/adr/0005-local-only-and-clean-licensing.md)) |
| Facial-expression→emotion validity is contested | Physiology-primary scoring; relative-to-baseline framing; behavioural cues weighted low, signed, and never surfaced as emotion labels |
| Uneven webcam frame rate corrupts spectral estimates | `requestVideoFrameCallback`/`mediaTime` timestamp resampling to a uniform grid before DSP |
| Video compression destroys the rPPG signal | Request least-compressed stream available; OMIT is compression-robust by design |
| Confounders (caffeine, exercise, illness, talking) | Surface uncertainty; optional context tags; avoid absolute claims |
| CPU/GPU/battery cost of real-time vision + DL inference | Downscale ROIs, throttle landmark rate, Web Worker off-main-thread, WebGPU with WASM fallback, per-frame inference budget with graceful degradation to classical-only |
| Privacy/regulatory exposure of biometric/mental-state data | Local-only, no-media-persistence design; explicit consent; export/delete; DPIA; "arousal not emotion" framing (§7) |
| Over-trust / anxiety from a "stress number" | Calm UX, ranges not verdicts, visible confidence/SQI, non-medical disclaimer |
| **Open:** primary DL rPPG model choice (TS-CAN/EfficientPhys vs. Contrast-Phys+) | Settle empirically in the Phase 0 spike, weighing latency, accuracy, and licensing/training-data feasibility |
| **Open:** best default calibration length & re-cal cadence | Determine empirically in Phases 1–3 |
| **Open:** per-user vs. population learned layers long-term | Decide from Phase 3 data |

---

## 12. Repository structure (once building starts)

See [`ARCHITECTURE.md`](ARCHITECTURE.md) §9 for the full monorepo layout (pnpm workspaces: `apps/web`,
`packages/{dsp,vision,ml,types}`, `research/`, `docs/`) and build/test tooling.

---

## 13. Summary of key decisions

1. **Hybrid rPPG in the MVP:** classical (POS/OMIT/CHROM/LGI) as the always-available, auditable
   baseline, **plus on-device deep learning** (TS-CAN/EfficientPhys/Contrast-Phys+ via
   `onnxruntime-web`/WebGPU), gated per-condition by LOSO/cross-dataset/Monk-stratified validation.
2. **Physiology-primary**, leading on HR↑ and RMSSD↓; LF/HF de-emphasized as contested and unreliable
   at webcam signal quality. Behavioural cues are weak, signed-against-baseline supporting signals —
   never emotion labels.
3. **Relative-to-personal-baseline** scoring and **trend** reporting — not absolute emotion verdicts.
4. **Local-first, no-media-persistence** privacy model, including for the DL inference path; framing as
   "physiological arousal," never "emotion recognition," as both an ethical and regulatory control.
5. **Web-first PWA** product + **Python research harness** (the harness, not the app, is where
   RAIL/GPL reference tools like rPPG-Toolbox and pyVHR are used).
6. **v1 transparent composite always present**, augmented — not replaced — by gated learned layers from
   day one; **personalization prioritized over model sophistication**.
7. **Fairness across skin tones (Monk scale)** is a release-gating requirement for every accuracy claim
   and for whether any learned layer is trusted for a given user.
8. Positioned strictly as a **personal wellness tool** — not medical, not for use on others.

*This is a living plan and will evolve as Phase 0/1 findings come in — especially the DL model choice
and its measured on-device performance.*
