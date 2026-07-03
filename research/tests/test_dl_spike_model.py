"""Validates the placeholder ONNX model rppg.dl_spike_model builds for the on-device DL-inference
latency spike (apps/web/src/dlInferenceSpike.ts) — structurally via onnx.checker, and functionally
by actually running it through onnxruntime's CPU execution provider. This is what caught the
original transB/Gemm weight-shape bug (fc1_w/fc2_w declared transposed from what transB=1
expects) before it ever reached the browser; it would NOT catch a WebGPU-only issue (the
dilations/strides/kernel_shape attributes this model also needs explicitly — WebGPU's JSEP Conv
kernel doesn't infer them the way the CPU kernel does), which is why the browser-side Playwright
verification in dlInferenceSpike.ts's manual testing notes remains the source of truth for the
WebGPU path specifically.
"""

from __future__ import annotations

import numpy as np
import onnx
import onnxruntime

from rppg.dl_spike_model import INPUT_NAME, INPUT_SHAPE, OUTPUT_NAME, OUTPUT_SHAPE, build_model


class TestBuildModel:
    def test_passes_onnx_checker(self):
        model = build_model()
        onnx.checker.check_model(model)  # raises on structural problems

    def test_declares_the_expected_input(self):
        model = build_model()
        (input_info,) = model.graph.input
        assert input_info.name == INPUT_NAME
        dims = [d.dim_value for d in input_info.type.tensor_type.shape.dim]
        assert dims == INPUT_SHAPE

    def test_declares_the_expected_output(self):
        model = build_model()
        (output_info,) = model.graph.output
        assert output_info.name == OUTPUT_NAME
        dims = [d.dim_value for d in output_info.type.tensor_type.shape.dim]
        assert dims == OUTPUT_SHAPE


class TestActualExecution:
    """Runs the model for real via onnxruntime's CPU provider — the exact class of bug this
    catches (a Gemm weight declared with the wrong transposed shape) passed onnx.checker but
    failed at session-creation time with a shape-inference error."""

    def test_runs_without_error_and_produces_the_expected_shape(self):
        model = build_model()
        session = onnxruntime.InferenceSession(model.SerializeToString())

        zeros = np.zeros(INPUT_SHAPE, dtype=np.float32)
        (output,) = session.run([OUTPUT_NAME], {INPUT_NAME: zeros})

        assert output.shape == tuple(OUTPUT_SHAPE)
        assert np.isfinite(output).all()

    def test_output_is_deterministic_for_the_same_input(self):
        model = build_model()
        session = onnxruntime.InferenceSession(model.SerializeToString())
        rng = np.random.default_rng(seed=0)
        patch = rng.uniform(0, 1, size=INPUT_SHAPE).astype(np.float32)

        (first,) = session.run([OUTPUT_NAME], {INPUT_NAME: patch})
        (second,) = session.run([OUTPUT_NAME], {INPUT_NAME: patch})

        np.testing.assert_array_equal(first, second)

    def test_different_inputs_produce_different_outputs(self):
        # A sanity check that the graph isn't accidentally constant-folding to a fixed output
        # regardless of input (which would silently defeat the point of a latency spike that's
        # supposed to exercise real per-frame compute).
        model = build_model()
        session = onnxruntime.InferenceSession(model.SerializeToString())

        zeros = np.zeros(INPUT_SHAPE, dtype=np.float32)
        ones = np.ones(INPUT_SHAPE, dtype=np.float32)
        (out_zeros,) = session.run([OUTPUT_NAME], {INPUT_NAME: zeros})
        (out_ones,) = session.run([OUTPUT_NAME], {INPUT_NAME: ones})

        assert not np.array_equal(out_zeros, out_ones)
