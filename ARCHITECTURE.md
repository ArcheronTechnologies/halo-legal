# Halo Pulse — Architecture

Concrete technical design for the plan described in [`PLAN.md`](PLAN.md). This document names actual
packages, APIs, and parameters so the plan is buildable, not just directional. Evidence for the
choices below is in [`RESEARCH.md`](RESEARCH.md); decision rationale for the load-bearing ones is in
[`docs/adr/`](docs/adr/).

---

## 1. Layered pipeline

```
Capture (Web Worker boundary below "Vision")
  │  getUserMedia → <video> → requestVideoFrameCallback(mediaTime) → tiny-canvas ROI readback
  ▼
Vision
  │  @mediapipe/tasks-vision Face Landmarker → 478 landmarks, 52 blendshapes, head-pose matrix
  ▼
Signals
  │  rPPG: classical (POS/OMIT/CHROM/LGI) AND on-device DL (onnxruntime-web/WebGPU) → HR, HRV, SQI
  │  Behaviour: AU proxies, blink deviation, head-motion deviation
  ▼
Features
  │  windowed feature vectors (e.g. 30 s sliding windows)
  ▼
Scoring
  │  baseline z-scores + fusion (composite + gated DL/XGBoost ensemble) → Stress Index + confidence
  ▼
Store (Dexie/IndexedDB — derived numbers only)
  ▼
UI (live gauge, quality meter, trends, settings)
```

Threading: capture happens on the main thread (it must, to own the `<video>` element and user
gesture), then frames are handed to a **Web Worker** as `ImageBitmap`s for everything from Vision
through Scoring, so the UI thread never blocks on landmark detection or model inference.

---

## 2. Capture pipeline

### 2.1 Requesting the stream

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 30, min: 24 },
    // Request the least-compressed stream the platform allows; browsers do not expose a
    // direct bitrate/quality constraint, so this is enforced by resolution/frameRate choice
    // and by preferring higher-fidelity facingMode/deviceId candidates where available.
  },
});
```

The browser *tries* to honor constraints but may silently crop, downscale, or drop fps if the hardware
can't match them — **always read back the truth** via `track.getSettings()` after starting, and probe
`track.getCapabilities()` before requesting. Frame rate is also **light-dependent**: webcams lengthen
exposure time (lowering effective fps) in dim rooms, which is a signal-quality issue for rPPG, not
just a cosmetic one — feed the actual achieved fps into the SQI.

Manual exposure/gain/white-balance are generally **not controllable** from the browser on desktop UVC
webcams. Design capture guidance (and the SQI) to tolerate auto-exposure hunting rather than assume
control over it.

### 2.2 Per-frame timestamps: `requestVideoFrameCallback`

This is the concrete fix for the "uneven webcam frame rate" problem flagged throughout the plan.

```ts
function onFrame(now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) {
  const tSeconds = metadata.mediaTime;           // true presentation timestamp of THIS frame
  // ... draw video into the ROI canvas, extract RGB means, push { t: tSeconds, r, g, b } ...
  video.requestVideoFrameCallback(onFrame);
}
video.requestVideoFrameCallback(onFrame);
```

`requestVideoFrameCallback` (rVFC) fires once per actually-presented video frame (rate = min of camera
rate and browser rate), unlike `requestAnimationFrame` which fires at display refresh regardless of
whether a new frame arrived. `metadata.mediaTime` is the per-frame timestamp attached to every RGB
sample; the DSP layer (§4) resamples this irregular series onto a uniform grid before any spectral
work. Feature-detect (`'requestVideoFrameCallback' in HTMLVideoElement.prototype`) and fall back to
`requestAnimationFrame` + `video.currentTime` on browsers without it.

### 2.3 Cheap ROI pixel readback

`getImageData()` on a full frame is a GPU→CPU readback and the single most expensive operation in the
loop — never call it on the whole frame every tick. Instead:

1. `drawImage()` the ROI rectangle (forehead, each cheek) from the source frame into a **tiny
   destination canvas** (a handful of pixels), letting the GPU do bilinear-downscale averaging.
2. `getImageData()` only that tiny canvas to get the spatial mean RGB essentially for free.

This collapses per-frame readback cost by orders of magnitude versus reading the full frame. A WebGL
shader + mipmap reduction is the higher-fidelity option if/when true per-pixel skin masking is added;
not required for the MVP.

**Performance budget:** sample RGB means on **every presented frame** (cheap), but throttle the
landmark model itself to ~10–15 fps and reuse the last known ROI polygon between detections — faces
move slowly relative to frame rate, and the landmark model, not the DSP, is the CPU cost that matters.

---

## 3. Vision: face landmarks & blendshapes

**`@mediapipe/tasks-vision`, Face Landmarker task.** Apache-2.0 (code, docs, and model bundle).

```ts
const vision = await FilesetResolver.forVisionTasks(SELF_HOSTED_WASM_DIR); // not a CDN — see below
const landmarker = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: SELF_HOSTED_MODEL_URL, delegate: "GPU" }, // WebGL; "CPU" = WASM fallback
  runningMode: "VIDEO",
  numFaces: 1,
  outputFaceBlendshapes: true,
  outputFacialTransformationMatrixes: true,
});
const result = landmarker.detectForVideo(imageBitmap, timestampMs); // timestampMs from mediaTime
```

Output: **478 3D landmarks** (468 face mesh + 10 iris — no separate iris model needed), **52
ARKit-style blendshapes**, and a **4×4 head-pose transformation matrix**.

**Self-host the WASM runtime and the `.task` model file** rather than loading from
`cdn.jsdelivr.net` as most tutorials do — a third-party network call on every load is inconsistent
with "nothing leaves the device" and breaks offline PWA use. Vendor a pinned version into the app
bundle; the float16 model is a few MB.

### 3.1 ROI definition from landmarks

Define forehead and cheek ROIs as **polygons** over the canonical landmark indices (anchors: forehead
center ≈ index 10; right/left cheek boundaries ≈ indices 234/454; malar regions near 205/50 and
425/280), not single points — treat published index maps as a starting point and validate visually
with the ROI overlay during development. Per frame: exclude the eye rings, brows, mouth, and any
region MediaPipe or a simple heuristic flags as occluded (glasses reflections, hair); **gate out
blink frames** using the `eyeBlink*` blendshapes so closed-eye frames don't corrupt the ROI mean.

### 3.2 Blendshapes → behavioural features

| Blendshape(s) | Feature | Notes |
| --- | --- | --- |
| `browDownLeft/Right` | Brow-lower (AU4 proxy) | Furrow/tension |
| `eyeSquintLeft/Right` | Lid-tighten (AU7 proxy) | |
| `mouthPressLeft/Right`, `mouthPucker` | Lip-press (AU23/24 proxy) | |
| `eyeBlinkLeft/Right` | Blink detection | Used both for the behavioural blink-rate feature and to gate rPPG ROI frames |
| head-pose matrix (per-frame delta) | Head micro-motion / stillness | |

All of these feed the composite scorer as **deviation from the user's personal baseline** (§6 of
`PLAN.md`), never as an absolute, signed-direction input — see `PLAN.md` §2.2 for why (blink direction
in particular is confound-prone).

---

## 4. Signals: rPPG — classical layer

No maintained, permissively-licensed browser rPPG library exists (the one demo, `heartbeat-js`, is
GPL-3.0 and effectively unmaintained) — this layer is a small, auditable, custom TypeScript module,
validated against the Python harness (§8).

### 4.1 Pipeline

1. **Input:** three per-frame RGB-mean series per ROI (from §2.3), each timestamped via `mediaTime`.
2. **Resample** onto a uniform grid (30–60 Hz) — cubic-spline or linear interpolation; Lomb–Scargle is
   an alternative that avoids interpolation entirely by estimating the spectrum directly from unevenly
   sampled data.
3. **Detrend:** Tarvainen smoothness-priors detrending (the HRV-standard method), λ ≈ 100–500.
4. **Normalize:** per-window zero-mean/unit-variance.
5. **Band-pass:** 0.7–4.0 Hz (≈42–240 bpm); may narrow to ~0.7–3.5 Hz for a resting/desk-use context.
6. **Combine channels** with a motion/illumination-robust method:
   - **POS** (Wang et al. 2017) — default. Projects RGB onto a plane orthogonal to the skin-tone
     vector; operates on 1.6 s windows with overlap-add.
   - **OMIT** (Álvarez-Casado et al. 2023) — QR/Householder orthogonalization; notably **more robust
     to video compression** than POS/GREEN, which matters because browsers always deliver compressed
     frames (§2.1).
   - **CHROM** (de Haan & Jeanne 2013) — chrominance-based fallback/comparison.
   - **LGI** (Pilz et al. 2018) — local-group-invariance; used preferentially in detected high-motion
     windows.
7. **HR:** Welch power-spectral-density peak (robust to noise) as primary; time-domain peak detection
   reserved for deriving inter-beat intervals.
8. **HRV from IBIs:** **RMSSD** (primary — valid from ~10–30 s windows, average several), **SDNN**
   (secondary, needs ~30–60 s+). **LF/HF** may be computed opportunistically when ≥1–2 minutes of clean
   IBIs are available, but is a low-weight, hedged tertiary output per `PLAN.md` §2.1 — not a headline
   metric.
9. **Signal Quality Index (SQI):** computed per window from **skewness** (found to be an effective
   single PPG quality index), in-band vs. out-of-band spectral power (SNR), and optionally spectral
   entropy / beat-template correlation. Below a quality floor, the window is discarded or the UI shows
   "signal too weak" rather than a number.

### 4.2 DSP building blocks (JS libraries, not written from scratch)

- **`fili.js`** (MIT) — configurable-order Butterworth IIR biquad filters for the band-pass stage.
- **`fft.js`** (indutny, MIT) — radix-2/4 FFT for the Welch PSD estimate; wrap with windowing +
  segment averaging. (`webfft` is a drop-in alternative that auto-selects the fastest backend if that
  becomes worth the extra dependency.)
- POS/OMIT/CHROM/LGI themselves are ~tens of lines of linear algebra each — written directly in
  TypeScript, not pulled from a library.

At the window sizes involved (a few hundred samples at ~30–60 Hz), this DSP is computationally
negligible — **no WASM is required for the classical layer in the MVP.** It runs comfortably inside
the same Web Worker as Vision.

---

## 5. Signals: rPPG — on-device deep-learning layer (MVP)

Per [ADR-0002](docs/adr/0002-hybrid-rppg-classical-and-dl.md), a deep-learning rPPG model ships in the
MVP, not a later phase, run entirely on-device.

### 5.1 Runtime

- **`onnxruntime-web`**, **WebGPU** backend as primary (shipped in all major browsers by 2026; roughly
  3–10× WebGL for models of this size), **WASM** backend as automatic fallback on devices/browsers
  without WebGPU. No cross-origin isolation (COOP/COEP) is required for this path, which keeps PWA
  hosting simple.
- **Self-host** the exported model weights (as with the MediaPipe assets) and add them to the PWA
  precache list (§7) so the DL path works offline after first load.
- Enforce a **per-frame/per-window inference time budget**; if a device can't meet it, the fusion layer
  (§6 below, and `PLAN.md` §2.1.1/§6) falls back to classical-only rather than degrading frame rate or
  janking the UI.

### 5.2 Model candidates (decided empirically in the Phase 0 spike)

| Candidate | Type | Why it's a candidate |
| --- | --- | --- |
| **TS-CAN** | Supervised, temporal-shift 2D-CNN | Edge-optimized, established rPPG-Toolbox baseline |
| **EfficientPhys** | Supervised, depthwise-separable + NAS | Explicitly mobile/edge-optimized |
| **Contrast-Phys+** | Unsupervised (spatiotemporal contrastive) | Trains without ground-truth pulse labels — reduces both the labeled-data burden and the licensing exposure described in `PLAN.md` §2.1.2, since it can train on video alone |

The Phase 0 spike measures real on-device latency/CPU/GPU cost for each candidate on representative
hardware and picks the primary model; the others remain documented fallbacks. Whichever is chosen is
either **trained from scratch in the Python harness** or sourced with a license clean enough to ship —
see [ADR-0005](docs/adr/0005-local-only-and-clean-licensing.md). Training/export pipeline: PyTorch (or
equivalent) in `research/` → ONNX export → validated for parity against the harness's own inference →
copied into `apps/web` as a versioned, self-hosted asset.

### 5.3 Fusion with the classical layer

The classical layer (§4) and the DL layer both produce an HR/HRV estimate (and, for the DL layer,
optionally a learned per-window quality signal) each window. The scoring layer (`PLAN.md` §6) selects
or blends between them based on:

- **SQI** of each layer's output for the current window;
- whether the **DL layer has cleared its validation gate** (LOSO + cross-dataset + Monk-stratified,
  per [`VALIDATION.md`](VALIDATION.md) §5) for the user's detected skin-tone bin, lighting condition,
  and device class;
- the measured **on-device inference budget** (§5.1) — if unmet, DL is skipped for that session.

Classical output is always computed and is the guaranteed fallback; DL is additive where validated.
The UI surfaces which layer(s) contributed to the current reading (`PLAN.md` §8), so the product is
never silently more or less confident than its evidence supports.

---

## 6. Storage schema (Dexie / IndexedDB)

**Dexie.js** (Apache-2.0) is used over a bare `idb` wrapper because the schema below has multiple
related tables, versioned migrations, and range queries (e.g. "all samples in the last 7 days") —
exactly where Dexie's typed tables and declarative versioning pay for themselves; `dexie-react-hooks`
(if the UI layer is React) gives live-updating history views for free.

```ts
interface Baseline {
  id: string; profileId: string; capturedAt: number; version: number;
  hrMean: number; hrSd: number;
  rmssdMean: number; rmssdSd: number;
  sdnnMean: number; sdnnSd: number;
  lfhfMean?: number; lfhfSd?: number;         // optional/hedged, per PLAN.md §2.1
  blinkRateMean: number; blinkRateSd: number;
  browTensionMean: number; lidTensionMean: number; lipTensionMean: number;
  captureConditions: { lightingLux?: number; deviceClass?: string; skinToneBin?: number };
}

interface Session {
  id: string; profileId: string; startedAt: number; endedAt: number;
  baselineId: string;
  signalLayers: ("classical" | "dl")[];        // which layer(s) contributed
  stressIndexMean: number; stressIndexMedian: number; stressIndexPeak: number;
  hrMean: number; hrvSummary: { rmssd: number; sdnn: number; lfhf?: number };
  sqiMean: number;
}

interface Sample {
  id: string; sessionId: string; t: number;      // window timestamp
  hr: number; rmssd?: number; sdnn?: number; lfhf?: number;
  behavioural: { blinkDeviation: number; browTension: number; lidTension: number; lipTension: number; headStillnessDeviation: number };
  sqi: number; stressIndex: number; confidence: number;
}

interface Settings {
  id: "singleton"; consentGrantedAt?: number; retentionDays: number;
  sensitivity: number; theme: "light" | "dark" | "system";
  featureFlags: Record<string, boolean>;
}

// Optional cache, computed from Session/Sample:
interface Rollup { id: string; profileId: string; day: string; meanStressIndex: number; sampleCount: number; }
```

**No table ever stores a frame, an image, or a face template** — the type system enforces the
architecture's core privacy invariant as much as review does.

- **Export:** JSON directly from Dexie tables; CSV for `Session`/`Sample`.
- **Delete-all:** clear all tables, or `indexedDB.deleteDatabase()`.
- **Persistence:** call `navigator.storage.persist()` so the (tiny) dataset survives Safari's ~7-day
  eviction policy for non-persistent origins; surface usage via `navigator.storage.estimate()`.
- **Optional at-rest encryption:** `dexie-encrypted` (uses `tweetnacl.js`, not Web Crypto, because Web
  Crypto's async API doesn't fit IndexedDB's synchronous transactions and can't encrypt indexed keys)
  or app-layer Web Crypto AES-GCM over serialized blobs. Nice-to-have given the already-sandboxed,
  local-only, numbers-only data; not required for MVP.

---

## 7. Visualization

- **Historical trends & within-session timeline:** **uPlot** (MIT, ~50 KB, Canvas2D) — handles weeks of
  `Sample`/`Rollup` data at 60 fps with a fraction of the CPU/memory of SVG-based alternatives.
- **Live stress gauge:** a **custom SVG/Canvas arc component**, not a charting library — it's a single
  animated value and a charting library is both overkill and a worse fit for the "calm, non-jittery"
  animation the product wants.
- **Time-of-day heatmap:** **cal-heatmap** (MIT, D3-based) or a small custom 7×24 SVG grid
  (weekday × hour) to avoid an extra dependency.
- Avoid Recharts/Chart.js on the hot paths (live gauge, long history) — fine only for small static
  summaries, if used at all.

---

## 8. Python research harness (offline — never shipped)

Purpose: fast algorithm iteration, the **reference oracle** the TypeScript DSP is validated against,
model training/export for the DL layer, and the `VALIDATION.md` study analysis.

- **Python 3.12**, pinned — `mediapipe` (Python) does not yet support 3.13.
- **rPPG reference/benchmark:** `rPPG-Toolbox` (classical **and** deep methods: GREEN/ICA/CHROM/LGI/
  PBV/POS/OMIT plus DeepPhys/PhysNet/TS-CAN/EfficientPhys/Contrast-Phys) and `pyVHR` (method + dataset
  comparison). **RAIL and GPL-3.0 respectively — harness-only**, never imported into `apps/web` (see
  [ADR-0005](docs/adr/0005-local-only-and-clean-licensing.md)).
- **HRV:** `NeuroKit2` (MIT) as the primary HRV computation oracle (RMSSD/SDNN/LF-HF/etc.);
  `HeartPy` (MIT) as a cross-check on noisy-PPG peak detection.
- **DSP/ML:** `numpy`, `scipy.signal` (mirror `butter`/`filtfilt`/`welch`/`detrend`/`find_peaks`
  parameters exactly in the TypeScript module so numbers match); `pandas`; `scikit-learn` + `xgboost`
  for the v1.5/v2 learned layers (exported to ONNX); `matplotlib`/`seaborn` for the validation report.
- **DL training/export:** train or fine-tune the chosen rPPG model (§5.2) here; export to ONNX; verify
  the ONNX export reproduces the Python-side inference before it's copied into the app.
- **Env tooling:** `uv` (or Poetry) with the Python version pinned in a lockfile for reproducibility.

**Golden-vector parity testing:** the harness generates reference feature/HR/HRV vectors from known
inputs (synthetic pulse signals, and real clips from the datasets in `VALIDATION.md` §4); these become
fixtures that a Vitest suite in `packages/dsp` asserts the TypeScript implementation reproduces within
a defined tolerance. This is what makes "validated against the Python harness" a real, automated check
rather than a one-time manual comparison.

---

## 9. Repository / monorepo structure

```
halo-pulse/                        # pnpm workspaces
├── pnpm-workspace.yaml            # packages: ['apps/*', 'packages/*']
├── tsconfig.base.json             # strict; TS project references
├── apps/
│   └── web/                       # Vite + TS PWA (vite-plugin-pwa)
│       ├── public/
│       │   └── models/            # self-hosted MediaPipe wasm + .task, and DL rPPG ONNX weights
│       └── src/
│           ├── capture/           # getUserMedia, rVFC, ROI canvas readback
│           ├── vision/            # MediaPipe wrapper, ROI polygons, blendshape mapping
│           ├── signals/           # classical rPPG (POS/OMIT/CHROM/LGI), SQI, HRV
│           ├── ml/                # onnxruntime-web wrapper, DL rPPG inference, fusion logic
│           ├── behaviour/         # AU proxies, blink deviation, head-motion deviation
│           ├── scoring/           # baseline, composite z-score fusion, DL/XGBoost ensemble
│           ├── store/             # Dexie schema + queries (derived data only)
│           └── ui/                # live gauge, quality meter, trends, settings
├── packages/
│   ├── dsp/                       # pure TS signal-processing (POS/OMIT/CHROM/HRV), heavily unit-tested
│   ├── vision/                    # framework-agnostic MediaPipe/ROI wrapper, shared by app + harness tooling
│   └── types/                     # shared schemas (zod) for Baseline/Session/Sample/Settings, export/import
├── research/                      # Python 3.12 harness — NOT shipped
│   ├── rppg/                      # classical + DL method dev, ONNX export
│   ├── validation/                # VALIDATION.md study analysis, fairness reports
│   ├── notebooks/
│   └── fixtures/                  # golden vectors consumed by packages/dsp tests
└── docs/
    └── adr/                       # numbered Architecture Decision Records
```

- **Package manager:** **pnpm workspaces** (`workspace:*` linking, fast, content-addressable store).
- **Build:** **Vite** for `apps/web`; library mode for `packages/*`.
- **Unit tests:** **Vitest** — including the golden-vector parity tests described in §8.
- **E2E tests:** **Playwright** with Chromium's fake-camera flags
  (`--use-fake-device-for-media-stream --use-file-for-fake-video-capture=<known.y4m>`) for
  deterministic rPPG output end-to-end, and an explicit assertion that inspects IndexedDB in-test to
  confirm the **"no frames persisted"** invariant holds.
- **Lint/format:** ESLint + Prettier, or Biome as a single faster tool.

---

## 10. PWA & offline packaging

- **`vite-plugin-pwa`** (Workbox) for the service worker. Two things the defaults get wrong for this
  app and must be overridden: (1) `workbox.globPatterns` must explicitly include the MediaPipe
  `*.wasm`/`.task` files **and** the DL model's ONNX weights; (2) `maximumFileSizeToCacheInBytes` must
  be raised past its ~2 MB default, since those assets exceed it. Use a `CacheFirst` strategy for the
  versioned, immutable model/weight URLs so the app is fully usable offline, including the DL path.
- **Stay single-threaded** (no SharedArrayBuffer/threaded-WASM) to avoid needing COOP/COEP headers,
  which are painful on static hosting. Neither the MediaPipe GPU delegate nor the WebGPU ONNX Runtime
  backend requires cross-origin isolation, so this constraint costs nothing for the MVP.
- **Desktop packaging (later, if needed):** ship the PWA first. If a desktop build becomes necessary,
  prototype on **Tauri 2** (small installers, but each OS's system WebView — WebKitGTK on Linux, WKWebView
  on macOS — may behave differently for `getUserMedia`/WebGL/WebCodecs, so validate camera + inference
  on every target OS) and fall back to **Electron** (bundles one Chromium everywhere, guaranteeing
  identical camera/WebGL/WebGPU behavior at the cost of a larger install). For this specific app,
  engine consistency — not bundle size — should decide between them.

---

## 11. Performance pitfalls → mitigations

| Pitfall | Mitigation |
| --- | --- |
| Full-frame `getImageData()` every frame | Tiny-canvas GPU-averaged readback of ROI rectangles only (§2.3) |
| Treating frames as evenly spaced | Attach `requestVideoFrameCallback`'s `mediaTime`; resample to a uniform grid before any DSP (§2.2, §4.1) |
| Landmark model on the main thread | Vision + Signals + Scoring run in a Web Worker; throttle landmark rate to ~10–15 fps |
| Loading MediaPipe wasm/model (or DL weights) from a CDN | Self-host and version-pin everything (privacy, offline, avoids upstream publish-lag surprises) |
| Safari evicting IndexedDB after ~7 idle days | `navigator.storage.persist()` |
| Accidentally requiring COOP/COEP | Stay single-threaded WASM/WebGPU for the MVP (§10) |
| PWA silently failing to cache the model/weights (Workbox's 2 MB default cap) | Explicit `globPatterns` + raised `maximumFileSizeToCacheInBytes` |
| SVG charts choking on long history (e.g. Recharts) | uPlot (Canvas) for series; custom SVG reserved for the gauge/heatmap |
| DL inference janking the UI or draining battery on weak devices | Per-frame inference budget; automatic fallback to classical-only when unmet (§5.1, §5.3) |

---

## 12. Reuse vs. build, summarized

**Reuse (ship in the app):** `@mediapipe/tasks-vision` (vision), `fili.js` + `fft.js` (DSP primitives),
`onnxruntime-web` (DL runtime), Dexie (storage), uPlot + cal-heatmap (viz), `vite-plugin-pwa` (offline).

**Reuse (harness only, never shipped):** `rPPG-Toolbox`, `pyVHR`, `NeuroKit2`, `HeartPy` — as the
validation oracle and, for the first two, the reference implementations the clean-room TS port is
checked against.

**Build:** the POS/OMIT/CHROM/LGI combiners, the detrend/Welch wrapper, peak-detection → HRV, the SQI,
ROI polygon selection and per-frame masking, the DL-rPPG training/export pipeline and its in-app
inference wrapper, the classical/DL fusion logic, the calibration/z-score composite scorer, the SVG
gauge, and the export/delete-all + golden-vector parity fixtures. All are small and auditable, which
suits the privacy/transparency posture the product is making claims about.
