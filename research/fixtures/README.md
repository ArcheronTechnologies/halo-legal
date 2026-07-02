# Shared fixtures

Placeholder for the golden-vector fixtures described in [`../README.md`](../README.md) — reference
signals plus their expected HR/HRV output, generated here and consumed by both this harness's
pytest suite and `packages/dsp`'s Vitest suite, once that literal cross-language sharing is wired
up (currently the two suites independently implement the same documented scenarios; see
`../README.md` for the distinction).
