"""CLI wrapper: writes rppg.dl_spike_model's placeholder ONNX model to research/fixtures/, where
apps/web/scripts/copy-dl-spike-assets.mjs picks it up for the browser-side latency spike.

Usage (from research/): python3 scripts/export_dl_rppg_latency_spike.py
"""

from __future__ import annotations

import pathlib
import sys

import onnx

# research/ (the package root containing rppg/) isn't on sys.path when this file is invoked
# directly as `python3 scripts/foo.py` (only its own directory is) — add it explicitly so this
# works the same whether run directly or via `python3 -m scripts.foo`.
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

from rppg.dl_spike_model import build_model  # noqa: E402

if __name__ == "__main__":
    out_path = pathlib.Path(__file__).parent.parent / "fixtures" / "dl_rppg_latency_spike.onnx"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    onnx.save(build_model(), str(out_path))
    print(f"Wrote {out_path} ({out_path.stat().st_size} bytes)")
