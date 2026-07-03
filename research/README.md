# Halo Pulse — Research Harness

The offline Python harness described in [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §8. **Never
shipped with the product** — this is where algorithms are developed, cross-checked against the
TypeScript implementation in `packages/dsp`, and where the [`../VALIDATION.md`](../VALIDATION.md)
study will eventually be analyzed.

## Setup

Requires Python 3.12 (pinned — `mediapipe` for Python does not yet support 3.13) and
[`uv`](https://docs.astral.sh/uv/):

```sh
cd research
uv sync
uv run pytest -v
```

## What's here today

- **`rppg/`** — Python reference implementations of the classical rPPG combiners (POS, CHROM,
  OMIT) and Welch-based HR estimation, deliberately mirroring `packages/dsp/src/combiners.ts` and
  `welch.ts`. These are the "reference oracle" ARCHITECTURE.md §8 describes.
- **`tests/`** — pytest suite that independently re-derives the same result the TypeScript test
  suite (`packages/dsp/src/combiners.test.ts`) checks: that POS and OMIT exactly reject a
  common-mode interferer five times larger than the true pulse signal, and that CHROM recovers the
  true pulse under realistic illumination drift. Two independent implementations, in two different
  languages, agreeing is meaningful cross-validation of the algorithms themselves.

## What's intentionally not here yet

- **`opencv-python` / `mediapipe` (Python)** — not added as dependencies until real capture or
  dataset video is actually being processed (heavy, platform-specific wheels); see the comment in
  `pyproject.toml`.
- **`rPPG-Toolbox` / `pyVHR`** — used as external benchmark/reference tools (clone separately when
  running the VALIDATION.md §9-equivalent benchmarks), not pip dependencies of this project. Both
  carry licenses (RAIL, GPL-3.0) that must never end up in anything shipped from `apps/web` or
  `packages/*` — see [ADR-0005](../docs/adr/0005-local-only-and-clean-licensing.md).
- **Literal golden-vector fixtures shared with the TypeScript test suite.** Today the two suites
  independently implement the same documented scenarios; the natural next step is for `rppg/` to
  export shared JSON fixtures (synthetic signal in, expected HR/HRV out) that
  `packages/dsp`'s Vitest suite reads directly, turning "these two implementations happen to
  agree" into "this implementation is asserted to match the reference oracle."
- **`validation/`, `notebooks/`, `fixtures/`** — directory placeholders for the VALIDATION.md §5
  study analysis, exploratory notebooks, and shared fixtures respectively. Populated once real
  (consented) capture or dataset data exists to analyze.
