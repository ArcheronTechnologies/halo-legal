"""Builds an UNTRAINED placeholder ONNX model for the Phase 0 on-device DL-inference latency
spike (PLAN.md §10 Phase 0 "stand up the on-device DL inference path... measure real per-frame
latency/CPU/GPU budget").

This is deliberately NOT a trained rPPG model — training one requires real face-video datasets
with synchronized ground-truth pulse signals (UBFC-rPPG/PURE/VIPL-HR) and GPU training time,
neither available in this environment (see PLAN.md's final-accounting note). What this module
produces is architecturally representative of a compact rPPG CNN (a small stack of 2D convolutions
over a face-patch, similar order of magnitude to EfficientPhys/TS-CAN scaled for on-device use —
RESEARCH.md §2) with fixed placeholder weights, solely so apps/web can measure real
onnxruntime-web/WebGPU inference latency against a shape/complexity that means something. It must
never be used to actually score anything — see the docstring in apps/web/src/dlInferenceSpike.ts.
"""

from __future__ import annotations

import onnx
from onnx import TensorProto, helper

INPUT_NAME = "roi_patch"
OUTPUT_NAME = "pulse_contribution"
# A single 72x72 RGB face-patch (NCHW) — the common input size in the rPPG-CNN literature this
# stands in for (RESEARCH.md §2 — TS-CAN/EfficientPhys use 36-72px patches).
INPUT_SHAPE = [1, 3, 72, 72]
OUTPUT_SHAPE = [1, 1]


def _const_weight(name: str, shape: list[int]) -> onnx.TensorProto:
    size = 1
    for d in shape:
        size *= d
    # Deterministic small values (no numpy/random dependency needed at export time) — the actual
    # values are meaningless since this model is never trained; only the shapes and op graph
    # matter for a latency measurement.
    values = [((i % 7) - 3) * 0.01 for i in range(size)]
    return helper.make_tensor(name, TensorProto.FLOAT, shape, values)


def build_model() -> onnx.ModelProto:
    input_tensor = helper.make_tensor_value_info(INPUT_NAME, TensorProto.FLOAT, INPUT_SHAPE)
    output_tensor = helper.make_tensor_value_info(OUTPUT_NAME, TensorProto.FLOAT, OUTPUT_SHAPE)

    conv1_w = _const_weight("conv1_w", [16, 3, 3, 3])
    conv2_w = _const_weight("conv2_w", [32, 16, 3, 3])
    # Gemm with transB=1 expects weight shape [out_features, in_features] (the PyTorch nn.Linear
    # convention: B is transposed to [in, out] before the matmul).
    fc1_w = _const_weight("fc1_w", [16, 32])
    fc1_b = _const_weight("fc1_b", [16])
    fc2_w = _const_weight("fc2_w", [1, 16])
    fc2_b = _const_weight("fc2_b", [1])

    nodes = [
        # dilations/strides/kernel_shape spelled out explicitly — WebGPU's JSEP Conv kernel
        # (unlike the WASM/CPU kernel) does not infer them from the weight tensor shape alone;
        # omitting them passes onnx.checker.check_model but fails at WebGPU session-creation time.
        helper.make_node(
            "Conv",
            [INPUT_NAME, "conv1_w"],
            ["conv1_out"],
            pads=[1, 1, 1, 1],
            strides=[1, 1],
            dilations=[1, 1],
            kernel_shape=[3, 3],
        ),
        helper.make_node("Relu", ["conv1_out"], ["relu1_out"]),
        helper.make_node(
            "Conv",
            ["relu1_out", "conv2_w"],
            ["conv2_out"],
            pads=[1, 1, 1, 1],
            strides=[1, 1],
            dilations=[1, 1],
            kernel_shape=[3, 3],
        ),
        helper.make_node("Relu", ["conv2_out"], ["relu2_out"]),
        helper.make_node("GlobalAveragePool", ["relu2_out"], ["pooled"]),
        helper.make_node("Flatten", ["pooled"], ["flat"], axis=1),
        helper.make_node("Gemm", ["flat", "fc1_w", "fc1_b"], ["fc1_out"], transB=1),
        helper.make_node("Relu", ["fc1_out"], ["relu3_out"]),
        helper.make_node("Gemm", ["relu3_out", "fc2_w", "fc2_b"], [OUTPUT_NAME], transB=1),
    ]

    graph = helper.make_graph(
        nodes,
        "halo_pulse_dl_rppg_latency_spike",
        [input_tensor],
        [output_tensor],
        initializer=[conv1_w, conv2_w, fc1_w, fc1_b, fc2_w, fc2_b],
    )
    model = helper.make_model(graph, producer_name="halo-pulse-research")
    model.opset_import[0].version = 18
    onnx.checker.check_model(model)
    return model
