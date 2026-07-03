export function mean(x: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += x[i]!;
  return x.length === 0 ? 0 : sum / x.length;
}

export function variance(x: ArrayLike<number>, ddof = 0): number {
  const n = x.length;
  if (n - ddof <= 0) return 0;
  const m = mean(x);
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const d = x[i]! - m;
    sumSq += d * d;
  }
  return sumSq / (n - ddof);
}

export function std(x: ArrayLike<number>, ddof = 0): number {
  return Math.sqrt(variance(x, ddof));
}

/** Fisher-Pearson skewness (population, not bias-corrected — fine for a relative quality signal). */
export function skewness(x: ArrayLike<number>): number {
  const n = x.length;
  if (n < 3) return 0;
  const m = mean(x);
  let m2 = 0;
  let m3 = 0;
  for (let i = 0; i < n; i++) {
    const d = x[i]! - m;
    m2 += d * d;
    m3 += d * d * d;
  }
  m2 /= n;
  m3 /= n;
  const sd = Math.sqrt(m2);
  return sd < 1e-12 ? 0 : m3 / sd ** 3;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function clamp01(x: number): number {
  return clamp(x, 0, 1);
}

/** Divides each sample by the series mean; a mean of ~0 falls back to a tiny epsilon to avoid Infinity/NaN. */
export function normalizeByMean(x: ArrayLike<number>): Float64Array {
  const m = mean(x);
  const denom = Math.abs(m) < 1e-12 ? 1e-12 : m;
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i]! / denom;
  return out;
}

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}
