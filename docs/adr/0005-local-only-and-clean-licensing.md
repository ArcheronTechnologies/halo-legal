# ADR-0005: Local-only, no-media-persistence privacy model; "arousal not emotion" framing; clean-room implementation and cleanly-licensed DL weights

## Status

Accepted

## Context

The product infers physiological arousal and facial tension from a webcam feed pointed at a person's
own face — data that is sensitive by nature (GDPR special-category-adjacent, per `RESEARCH.md` §M) and
that the commercial "emotion AI" industry has a poor track record of handling responsibly (HireVue's
removal of facial-expression analysis after regulatory pressure is a direct cautionary precedent).
Separately, the best available reference implementations for both classical rPPG (rPPG-Toolbox, RAIL;
pyVHR, GPL-3.0) and, by extension, pretrained DL rPPG weights derived from them, carry licenses
incompatible with shipping in a freely-distributed product (`RESEARCH.md` §A, §F). Regulation is also
directly on point: the EU AI Act prohibits emotion-recognition AI in workplace/education contexts and
imposes transparency obligations elsewhere; Illinois BIPA and similar US statutes regulate
face-geometry *identification* specifically; the FDA draws a line between low-risk general-wellness
tools and regulated medical devices based on the claims made.

## Decision

1. **On-device only, no raw media persistence.** Frames and landmarks exist only in memory for the
   duration of a session; only derived numeric features and scores are ever written to disk, and only
   locally (`ARCHITECTURE.md` §6). This holds for the DL inference path as much as the classical one —
   weights run locally, frames are never uploaded for inference or otherwise.
2. **Product language describes outputs as physiological arousal / facial tension relative to the
   user's own baseline — never as an inferred emotion.** This is enforced as a **compliance control**,
   not just a UX tone choice: it is the primary reason the product sits outside the EU AI Act's
   emotion-recognition prohibition and keeps its regulatory posture in the FDA's general-wellness
   category (no diagnostic or disease claims).
3. **No face-geometry identification is performed or stored; no face templates exist.** This is the
   direct mitigation for BIPA-style biometric-identifier statutes, whose recent case law (`RESEARCH.md`
   §M) turns on whether a system is used to *identify* a person — this one structurally is not.
4. **Shipped code and shipped model weights must carry clean, permissive licenses.** RAIL-licensed
   (rPPG-Toolbox) and GPL-3.0-licensed (pyVHR) code is used only inside the non-shipped Python research
   harness as a reference oracle (ADR-0001). The shipped classical rPPG combiners are a **clean-room
   TypeScript port**, validated against that oracle via golden-vector tests rather than derived from
   its source. Shipped DL rPPG weights are either **trained from scratch** in the harness (favoring
   Contrast-Phys+'s unsupervised approach, which needs no licensed *labels*, only video) or sourced
   from weights under a license that is actually compatible with shipping.

## Rationale

- **A local-only architecture makes several regulatory risks structurally smaller rather than merely
  policy-managed** — there is no server-side data to breach, subpoena, or repurpose, and no
  identification capability to misuse, which is a stronger position than "we promise not to."
- **The framing decision is doing real regulatory work, not just brand-safety work** — the EU AI Act's
  prohibition is specifically about systems that *infer emotions*; a system that reports physiological
  deviation from a personal baseline, described in those terms consistently across product surface,
  code, and this documentation, is a materially different (and better-supported, per Barrett et al. —
  ADR-0003) claim.
- **Licensing hygiene protects the product's ability to exist as a freely-distributed piece of
  software** — shipping GPL-3.0 code inside a proprietary/commercial app creates copyleft obligations
  the team may not intend to accept, and RAIL's use restrictions could conflict with commercial
  distribution outright; discovering this after building on top of those libraries would be far more
  costly than designing around it from the start.

## Consequences

- The clean-room TypeScript port is real, non-trivial engineering work (not a thin wrapper), and its
  correctness depends on the golden-vector parity-testing infrastructure in `ARCHITECTURE.md` §8 —
  this is a load-bearing test suite, not optional polish.
- Training a DL rPPG model from scratch (rather than fine-tuning available pretrained weights) is
  slower and more expensive than the alternative the field usually takes, and is a direct, accepted
  cost of the licensing decision above; Contrast-Phys+'s unsupervised design was specifically chosen as
  a candidate to reduce this cost (ADR-0002).
- Every future feature (sync/backup, sharing, integrations) must be evaluated against the "on-device
  only, no raw media persistence" invariant before being added — this ADR should be a required checkpoint
  in that review, not just background context.
- Product/marketing copy is constrained by decision #2 above; any language implying emotion detection,
  mood reading, or similar must be treated as a compliance defect, not a copywriting preference.
