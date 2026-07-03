# Halo Pulse — Validation

This document is the evidence base for [`PLAN.md`](PLAN.md): what the physiological and behavioural
signals can and can't support, the accuracy we can honestly promise, the datasets and protocols used
to validate the product, and the fairness gate that governs release. Primary sources are catalogued in
[`RESEARCH.md`](RESEARCH.md).

---

## 1. HRV → stress: the evidence, and what we lead on

**Direction of effect under acute stress:** HR↑, RMSSD↓, HF↓, SDNN↓ (shorter windows) — sympathetic
activation and parasympathetic (vagal) withdrawal. RMSSD and HF are the parasympathetic indices; they
are the best-grounded and, for RMSSD, the best-measurable from a webcam.

**Strength of evidence:** a systematic review found HRV moved in the predicted, statistically
significant direction under stress in **11 of 17 studies** — real, but moderate and noisy, not
deterministic. This is exactly why the product frames its output as a *relative, within-person trend*
rather than an absolute clinical measurement.

**Why LF/HF is de-emphasized (a deliberate departure from the naive "HRV = LF/HF" framing):**

1. **Physiological ambiguity:** current literature holds that LF/HF does not cleanly index
   sympathovagal balance — the same ratio value can correspond to different underlying autonomic
   states.
2. **Measurement infeasibility at webcam quality:** LF needs ≥~2 minutes and HF ≥~1 minute of *clean*
   inter-beat intervals — often unavailable from a jittery consumer-webcam session — whereas RMSSD is
   valid from ~10–30 second windows (especially when several short windows are averaged), which fits
   the product's 30 s sliding-window design.

**Product consequence:** the composite scorer leads on **HR↑ and RMSSD↓**; LF/HF is computed
opportunistically and shown, if at all, as a hedged, low-weight, tertiary signal — never a headline
number. See `PLAN.md` §2.1 and §6.

---

## 2. Honest accuracy expectations

### 2.1 Heart rate (rPPG)

| Condition | Expected MAE |
| --- | --- |
| Ideal (still, well-lit, <1 m, low compression) | ~1–2 bpm |
| Typical consumer webcam, ordinary use | ~4–5.5 bpm |
| Real-world motion / talking | ~9–14 bpm |

The product's stated target — **MAE < 3–5 bpm in good conditions** — is realistic *only* for the
"ideal" row above and should always be shown alongside the degraded-condition range, not in isolation.
The gap between "ideal" and "real-world motion/talking" is roughly an order of magnitude, which is why
SQI gating and honest in-UI uncertainty matter more than chasing a single headline accuracy number.

### 2.2 Heart-rate variability (rPPG)

HRV is **substantially less accurate than HR** — this needs to be stated plainly, not buried:

- Naturalistic webcam studies (using the *same* sessions that achieved ~1.67 bpm HR MAE) report
  **|ΔRMSSD| ≈ 11.0 ms** and **|ΔSDNN| ≈ 11.5 ms**, with wide Bland–Altman limits of agreement
  (RMSSD roughly −24 to +31 ms; SDNN roughly −27 to +40 ms).
- **Context that matters:** typical resting RMSSD in adults is roughly **19–75 ms**. An ~11 ms error is
  a *large fraction* of that entire physiological range, not a rounding error.
- LF/HF is the least reliable HRV metric of all at webcam signal quality (§1).

**Product consequence:** HR is shown with a tight, defensible confidence interval. HRV/RMSSD is shown
only as a **smoothed, within-person, relative trend** with visibly wider uncertainty — never as a
precise absolute number a user might compare to a clinical reference.

### 2.3 What this means for the deep-learning layer specifically

Deep-learning rPPG models (TS-CAN, EfficientPhys, PhysNet, etc.) post excellent numbers **in-domain**
(e.g., PhysNet ~1.78 bpm MAE on UBFC-rPPG) — but the accuracy that matters for this product is
**cross-dataset / cross-condition**, because a shipped model will constantly face devices, lighting,
and users it never trained on. On harder, more realistic benchmarks (e.g., MMPD, which varies skin
tone and lighting deliberately), the same model classes degrade to **~9–14 bpm MAE**, and the gap
between classical and deep methods largely disappears or reverses — classical POS/CHROM/OMIT often
match or beat deep models once both leave their training distribution. This is the direct justification
for gating the DL layer per-condition (§5) rather than trusting its in-domain numbers as a general
claim, even though it ships in the MVP per product decision.

---

## 3. Signal Quality Index (SQI)

Every rPPG window — classical and DL — is scored for quality before it is allowed to influence the
shown stress index:

- **Skewness** of the windowed pulse signal — found to be an effective single quality index for PPG.
- **In-band vs. out-of-band spectral power** (SNR within the 0.7–4.0 Hz band vs. outside it).
- Optionally, **spectral entropy** and **beat-template correlation** (correlating each detected beat
  against a running template) as complements.

Windows below a quality floor are discarded or curtailed; the UI shows "signal too weak" rather than a
fabricated number. SQI also feeds the classical/DL fusion decision in `ARCHITECTURE.md` §5.3.

---

## 4. Datasets

Two distinct needs, served by different datasets: (A) rPPG accuracy and skin-tone fairness, and
(B) stress-construct validity (does the index actually track induced stress). **All datasets below are
used only in the offline Python research harness** (`ARCHITECTURE.md` §8) — never shipped with the app
— and several carry licenses that restrict commercial use, which must be checked per-dataset before
any derived model or weights are shipped (see [ADR-0005](docs/adr/0005-local-only-and-clean-licensing.md)).

### 4.1 rPPG accuracy / fairness

| Dataset | Size | Content | Ground truth | Use |
| --- | --- | --- | --- | --- |
| **UBFC-rPPG** | 42 videos | Webcam face, math task, 30 fps 640×480 | Contact PPG (CMS50E) | Baseline rPPG development (easy case) |
| **PURE** | 10 subjects, 60 sequences | 6 controlled head-motion scenarios | Contact PPG @60 Hz | Motion robustness |
| **VIPL-HR** | 107 subjects, 2,378 videos | 3 cameras, unstable fps, varied conditions | Contact BVP | Realistic/hard HR case |
| **MMPD** | 33 subjects, ~11 h | Mobile phone capture, **Fitzpatrick III–VI**, 4 lighting × 4 activities | Contact PPG | **Skin-tone / lighting fairness benchmark** |
| **MAHNOB-HCI** | 30 subjects | Face video + ECG + EEG + respiration + gaze | ECG | rPPG-HR and affect, secondary use |

**MMPD is the designated fairness benchmark** — it was purpose-built to vary skin tone and lighting and
is the closest available proxy to the Monk-stratified evaluation this plan requires (§6), pending our
own Monk-annotated data from the study in §5.

### 4.2 Stress-construct validity (face + physiology + induced stress)

| Dataset | N | Modalities | Protocol / labels | Face video? | Use |
| --- | --- | --- | --- | --- | --- |
| **UBFC-Phys** | 56 | Video (1024², 35 Hz) + Empatica E4 (BVP, EDA) | TSST-inspired: rest / speech / arithmetic; self-reported anxiety | Yes | **Primary fit** — face video + physiology + induced stress in one dataset |
| **StressID** | 65 | Face video + audio + ECG + EDA + respiration | Emotional clips, math/comprehension, public speaking; relaxation/stress/arousal/valence ratings; ~39 h | Yes | Multimodal face+physiology stress, larger task variety |
| **WESAD** | 15 | Chest (ECG/EDA/EMG/resp/temp/ACC) + wrist E4 | TSST stress + amusement + baseline; questionnaires | No | Physiology feature modeling and **LOSO methodology** benchmark (no face video) |
| **SWELL-KW** | 25 | Computer logging, camera, Kinect posture, ECG, EDA | Office work under time pressure + email interruption | Partial | Ecological, knowledge-work stress |
| **DAiSEE** | 112 | Webcam video | Engagement/boredom/confusion/frustration, in-the-wild e-learning | Yes | Webcam robustness to pose/lighting (not a stress label) |
| **AffectNet** | ~1M images (~420K labeled) | Static images | 8 expression categories + valence/arousal | Yes (stills) | Expression/AU pretraining only, with caution (imbalanced, in-the-wild noise) |

**Primary pairing: UBFC-Phys + StressID** for face-video stress-construct validity; **WESAD** for the
physiology/LOSO methodology (it has no face video, so it validates the scoring approach, not the rPPG
layer); **MMPD** for fairness (§4.1); UBFC-rPPG/PURE/VIPL-HR for rPPG development and for **training
and evaluating the DL rPPG layer**.

---

## 5. Validation study design

### 5.1 Induction protocol

- **TSST (Trier Social Stress Test)** — the gold standard (meta-analytic **Cohen's d ≈ 0.93** for
  cortisol response), but logistically heavy (requires confederates/an evaluative panel); validated
  remote variants exist if used.
- **MIST (Montreal Imaging Stress Task)** — the recommended default for a practical, desk-based study:
  computerized mental arithmetic with social-evaluative threat and a **failure algorithm** (calibrated
  to ~10% below the participant's own success rate). Reliably induces a cortisol response and is easy
  to run at a desk with a webcam.
- **Stroop color-word interference** (ideally a social-evaluative variant) as a secondary/complementary
  task — trivially computerized, well-validated.
- **Note:** among simple cognitive tasks, only serial subtraction / MIST reliably raise cortisol (HPA
  axis); plain arithmetic may raise HR/EDA (sympathetic) without a cortisol response. This is fine here
  because the primary physiological reference is cardiac/EDA, not cortisol.

### 5.2 Self-report instruments — and a correction to an earlier draft of this plan

| Instrument | Timescale | Use here |
| --- | --- | --- |
| **STAI-State (STAI-S)** | Minutes (state) | **Primary acute pre/post instrument** — the right tool for a ~20-minute session |
| **Stress VAS** (single-item visual analogue scale) | Seconds | Fast per-phase check-in |
| **NASA-TLX** | Post-task | Separates cognitive workload/effort from stress proper |
| **PSS-10** | Last month (trait) | **Not valid for acute pre/post** — it cannot move within a 10-minute session. Reserved for the **longitudinal trend-validity** check: does the app's multi-week trend track a monthly PSS-10 change? |

An earlier draft of this plan proposed PSS-10 for within-session validation; that was a timescale
mismatch and is corrected here. STAI-S + VAS + NASA-TLX are the acute-session instruments; PSS-10
returns for the separate, longer-horizon trend claim in §5.5.

### 5.3 Physiological reference instruments

- **ECG / chest strap (e.g. Polar H10):** gold-standard HR and HRV (RMSSD, SDNN, LF/HF) — the primary
  reference the webcam rPPG output is compared against.
- **EDA (electrodermal activity):** a direct sympathetic-arousal reference (tonic skin-conductance
  level + phasic responses) — arguably the best concurrent physiological reference for an "arousal"
  construct specifically.
- **Salivary cortisol (optional):** the HPA-axis reference; delayed 20–30 minutes post-onset and
  logistically heavier — useful for a fuller validation but not required for the core study.

### 5.4 Study design

- **Design:** within-subject, repeated-measures, **counterbalanced** where task order can vary.
- **Phases:** Rest baseline (5 min) → Stressor block (Stroop + MIST/serial-subtraction, ~10 min) →
  Recovery (5 min); optionally a second stressor block to test repeatability.
- **Concurrent capture:** ECG (Polar H10) + EDA + webcam recording (feeding the app's own pipeline),
  all timestamp-synchronized; self-report (STAI-S + VAS + NASA-TLX) at each phase boundary.
- **Sample:** **≥30–40 participants**, explicitly **stratified/quota-sampled across Monk skin-tone
  bins** (§6), with variation in lighting and device/camera class — the field's chronic weakness is
  small, non-diverse samples, and this study is designed not to repeat it.
- **Primary endpoints:**
  1. rPPG HR agreement vs. ECG (MAE, Bland–Altman).
  2. Does the Stress Index rise from rest → stressor, and by how much (effect size)?
  3. Does the index correlate with STAI-S / VAS / EDA?
  4. Test–retest reliability of the baseline and the index under matched conditions.
- **Analysis:** repeated-measures ANOVA / mixed-effects models with participant as a random effect;
  Cohen's d for rest-vs-stress change; correlations with self-report and EDA; **every metric reported
  stratified by Monk bin**, not just in aggregate.

### 5.5 Longitudinal trend validity (separate, slower-cadence check)

Once users have opted in to weekly self-report, compare the app's week-over-week trend line against a
weekly **PSS-10** — this is the correct home for PSS-10 in this plan, as a trend-level check rather than
an acute-session one.

---

## 6. Metrics and the fairness gate

### 6.1 rPPG HR/HRV agreement

- **HR:** MAE, RMSE, MAPE, Pearson r, and **Bland–Altman** (bias + 95% limits of agreement) — the
  standard consumer-device convention is roughly **MAPE < 10%** or within **±5 bpm/±10%** to count as
  "accurate"; report all of these, not a single cherry-picked number.
- **HRV:** correlation and Bland–Altman for RMSSD/SDNN vs. the ECG reference; **expect and report wide
  limits of agreement** (§2.2) — this is used to justify showing HRV as trend-only in the product, not
  to be minimized in the report.

### 6.2 Stress-index construct validity

- **Sensitivity:** index rises rest→stressor with a reported effect size (Cohen's d).
- **Convergent validity:** correlation with STAI-S/VAS (self-report) and EDA/ECG-HRV (physiology);
  AUC for stress-vs-rest discrimination.
- **Test–retest reliability:** ICC of baseline and index under matched conditions.
- **Longitudinal trend validity:** app trend vs. weekly PSS-10 (§5.5).

### 6.3 Deep-learning-specific evaluation (required before the DL layer can drive the score)

- **Leave-one-subject-out (LOSO)** cross-validation is the minimum bar — window-level random splits
  (which leak adjacent, autocorrelated windows between train/test) are not accepted as evidence of
  real-world accuracy and must not be reported as the headline number.
- **Cross-dataset evaluation** (train on one dataset, test on another) wherever feasible — this is
  where deep models' generalization gap actually shows up; published work shows meaningful accuracy
  drops (e.g., an F1 drop of roughly 14 points for a simpler cross-dataset model) that LOSO-within-
  dataset numbers can mask.
- Both must be **stratified by Monk bin** (§6.4) before the result is used to gate whether the DL layer
  is trusted for a given condition, per `ARCHITECTURE.md` §5.3.

### 6.4 Fairness gate: Monk Skin Tone scale, not Fitzpatrick

**Why Monk over Fitzpatrick:** Fitzpatrick's 6-point scale is poorly predictive of skin *tone*
specifically (it was designed around UV/sunburn response) and under-represents darker skin (only 2 of
its 6 categories cover dark tones). The **Monk Skin Tone (MST) scale** — 10 points, explicitly
decoupled from race/UV response, splitting darker tones into 6 distinct shades — is now the de facto
standard for computer-vision fairness annotation and is used here for all stratified reporting.
**Caveat:** subjective skin-tone rating has moderate-to-low inter-annotator agreement, so tone should
be captured under controlled lighting and/or via multiple raters or a reference chart, not a single
ad hoc judgment.

**Why this is a hard gate, not a footnote:** published rPPG error roughly **triples** from the lightest
to the darkest skin-tone bins (illustrative published figures: MAE rising from roughly 4 bpm at the
lightest bins to roughly 13–14 bpm at the darkest, for both chrominance-based and deep methods — deep
models are **not** immune, degrading from roughly 6 to roughly 9.5 bpm in the same comparisons). The
underlying cause — melanin absorbing the pulsatile green-light signal, compounded by sensor
dynamic-range limits at both extremes — is a property of the *signal*, not a fixable software bug, so
mitigation is about honesty and fallback, not a promise of parity:

- **Release policy:** a cross-skin-tone parity gap in the study (§5.4) is a **release blocker** for any
  general-accuracy claim in product copy or marketing.
- **Per-condition gating:** the DL layer is only trusted to influence the score for Monk bins where it
  has cleared LOSO + cross-dataset validation (§6.3); elsewhere the product runs classical-only.
- **In-product honesty:** where measured confidence is low for a user's detected conditions, the
  product widens its displayed uncertainty or shows "signal too weak" rather than a falsely precise
  number — this is preferred over silently degrading accuracy without telling the user.
- **Mitigation research directions (secondary, not a substitute for the gate above):** diverse training
  data, longer integration windows with more averaging, stricter SQI gating for affected conditions,
  and skin-tone-aware normalization.

---

## 7. Guardrail checklist (privacy/regulatory, cross-referenced from `PLAN.md` §7)

- On-device only; no raw frames/landmarks persisted (memory-only); derived numbers only — including for
  the DL inference path.
- Explicit, revocable consent; visible camera-in-use indicator; easy pause/stop.
- One-tap export + delete-all; configurable retention.
- Non-medical disclaimer; wellness-only claims — no disease-diagnostic language.
- Never surface an emotion label — descriptive, arousal/tension language relative to the user's own
  baseline; uncertainty/SQI always visible.
- Terms restrict the product to personal self-use; explicit ban on third-party/employer/insurer/
  hiring/surveillance use.
- No face-geometry *identification* performed or stored; no face templates.
- A DPIA is advisable; treat stress/arousal inference as GDPR health-adjacent data even where face
  geometry itself is not used to identify anyone.
- Public validation reporting uses the Monk scale (§6.4), not Fitzpatrick.
