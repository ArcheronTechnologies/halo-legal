/**
 * Tarvainen smoothness-priors detrending (Tarvainen, Ranta-Aho & Karjalainen, 2002) — see
 * ARCHITECTURE.md §4.1 and RESEARCH.md §B. The trend is the solution to a Tikhonov-regularized
 * least-squares problem, minimize ||z_trend - z||^2 + lambda^2 ||D2 z_trend||^2, whose closed
 * form is z_trend = (I + lambda^2 D2^T D2)^-1 z; the detrended signal is z - z_trend.
 *
 * Rather than hand-deriving (I + lambda^2 D2^T D2)'s pentadiagonal band coefficients — easy to
 * get subtly wrong at the boundaries — we solve the (symmetric positive-definite) system with
 * Conjugate Gradient, applying D2 and its transpose as simple, easy-to-verify loops. This is
 * mathematically equivalent and just as fast in practice (the operator is well-conditioned for
 * the lambda values this pipeline uses), while being far less error-prone to implement correctly.
 */

/** Second-order difference operator: (D2 z)[i] = z[i] - 2 z[i+1] + z[i+2], for i = 0..n-3. */
function applyD2(z: Float64Array): Float64Array {
  const n = z.length;
  const out = new Float64Array(Math.max(0, n - 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = z[i]! - 2 * z[i + 1]! + z[i + 2]!;
  }
  return out;
}

/** Transpose of applyD2: scatters each row's [1, -2, 1] contribution back into an n-length vector. */
function applyD2Transpose(w: Float64Array, n: number): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < w.length; i++) {
    out[i]! += w[i]!;
    out[i + 1]! += -2 * w[i]!;
    out[i + 2]! += w[i]!;
  }
  return out;
}

function applyOperator(z: Float64Array, lambda2: number): Float64Array {
  const d2z = applyD2(z);
  const d2tD2z = applyD2Transpose(d2z, z.length);
  const out = new Float64Array(z.length);
  for (let i = 0; i < z.length; i++) out[i] = z[i]! + lambda2 * d2tD2z[i]!;
  return out;
}

function dot(a: Float64Array, b: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

/** Solves (I + lambda^2 D2^T D2) x = b for x via Conjugate Gradient (the operator is SPD). */
function solveTrendCG(
  b: Float64Array,
  lambda2: number,
  maxIter: number,
  tol: number,
): Float64Array {
  const n = b.length;
  const x = new Float64Array(n); // x0 = 0
  const r = b.slice(); // r0 = b - A*x0 = b
  const p = r.slice();
  let rsOld = dot(r, r);
  const bNorm = Math.sqrt(dot(b, b)) || 1e-12;

  const iters = Math.min(maxIter, n);
  for (let k = 0; k < iters; k++) {
    const Ap = applyOperator(p, lambda2);
    const denom = dot(p, Ap);
    if (Math.abs(denom) < 1e-15) break;
    const alpha = rsOld / denom;
    for (let i = 0; i < n; i++) {
      x[i]! += alpha * p[i]!;
      r[i]! -= alpha * Ap[i]!;
    }
    const rsNew = dot(r, r);
    if (Math.sqrt(rsNew) / bNorm < tol) break;
    const beta = rsNew / rsOld;
    for (let i = 0; i < n; i++) p[i] = r[i]! + beta * p[i]!;
    rsOld = rsNew;
  }
  return x;
}

export interface DetrendOptions {
  /** Smoothness parameter — larger removes slower trends. ARCHITECTURE.md §4.1 suggests ~100–500. */
  lambda?: number;
  maxIter?: number;
  tol?: number;
}

export function tarvainenDetrend(
  signal: ArrayLike<number>,
  opts: DetrendOptions = {},
): Float64Array {
  const n = signal.length;
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) z[i] = signal[i]!;

  if (n < 5) return z; // too short for the 2nd-difference operator to be meaningful

  const lambda = opts.lambda ?? 300;
  const lambda2 = lambda * lambda;
  const trend = solveTrendCG(z, lambda2, opts.maxIter ?? 200, opts.tol ?? 1e-6);

  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = z[i]! - trend[i]!;
  return out;
}
