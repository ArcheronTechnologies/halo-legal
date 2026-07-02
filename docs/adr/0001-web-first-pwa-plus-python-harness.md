# ADR-0001: Web-first PWA product, with a separate Python research harness

## Status

Accepted

## Context

The product needs to run real-time computer vision (face landmarks) and signal processing (rPPG) on a
user's own device, with a strict local-first privacy model (`PLAN.md` §7): raw frames must never leave
the device, ideally never even touch disk. Separately, developing and validating the underlying
algorithms (rPPG method comparison, HRV computation, dataset benchmarking, the study in
`VALIDATION.md`) benefits from a fast, batch-oriented, numerically-rich environment with access to the
existing rPPG/HRV research ecosystem — which is overwhelmingly Python.

Candidate product platforms considered: a browser web app (PWA), native mobile (Swift/Kotlin), and a
cloud-inference service with a thin client.

## Decision

Ship the product as a **local browser web app**, packaged as a **PWA** for installability and offline
use, built with TypeScript + Vite. Maintain a **separate, non-shipped Python research harness**
(`ARCHITECTURE.md` §8) for algorithm development, cross-checking the TypeScript implementation, model
training, and running the `VALIDATION.md` study.

## Rationale

- **Privacy is structural, not policy, with a browser app.** If there is no backend for the core
  product, there is no server to secure, no data-in-transit to encrypt, and no operator who could be
  compelled or breached — the strongest available version of "local-first."
- **Reach without install friction.** `getUserMedia` + WebGL/WASM (and now WebGPU) provide enough
  real-time performance for landmark tracking, classical rPPG, and on-device DL inference (see
  ADR-0002) without asking users to install a native app first.
- **Cloud inference was rejected outright** — routing webcam frames or derived biometric features to a
  server for inference directly contradicts the privacy model in `PLAN.md` §7 and would trigger far
  heavier regulatory exposure (GDPR data-in-transit/at-rest obligations, a real breach surface) for no
  offsetting benefit, since on-device compute is sufficient.
- **Native mobile was deferred, not rejected.** A PWA covers early mobile needs adequately; native
  would only be justified by a camera-access or performance ceiling the PWA actually hits, which is
  unproven at this stage. Revisit if Phase 1/2 usage data shows a real gap.
- **Python for the harness, not the product**, because that is where the rPPG/HRV research ecosystem
  actually lives (`rPPG-Toolbox`, `pyVHR`, `NeuroKit2`, `HeartPy` — see `ARCHITECTURE.md` §8 and
  `RESEARCH.md` §A/§F) and because several of those tools carry licenses (RAIL, GPL-3.0) that make them
  unsuitable to ship inside the product regardless of platform (see ADR-0005). Keeping algorithm
  research in Python and only porting validated, license-clean logic into TypeScript cleanly separates
  "what we use to figure out the right answer" from "what we ship."

## Consequences

- The TypeScript DSP/vision/ML code is the single source of truth for the shipped product's behavior;
  the Python harness's outputs are treated as a **reference oracle**, not a runtime dependency — this
  requires an explicit parity-testing step (golden-vector tests, `ARCHITECTURE.md` §8) to keep the two
  in sync, which is ongoing engineering overhead the team must maintain.
- Desktop packaging (Tauri/Electron) is deferred; if pursued later, it wraps the same web app rather
  than requiring a rewrite.
- Real-time performance work (Web Workers, WebGPU, careful frame readback — `ARCHITECTURE.md` §2–§5)
  is a first-class engineering concern from day one, since the browser is a harder real-time
  environment than a native app would be.
