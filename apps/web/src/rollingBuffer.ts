import type { RoiSample } from "@halo-pulse/types";

/** Keeps the most recent `maxDurationSec` of samples, evicting older ones as new ones arrive. */
export class RollingRoiBuffer {
  private samples: RoiSample[] = [];

  constructor(private readonly maxDurationSec: number) {}

  push(sample: RoiSample): void {
    this.samples.push(sample);
    const cutoff = sample.t - this.maxDurationSec;
    while (this.samples.length > 0 && this.samples[0]!.t < cutoff) {
      this.samples.shift();
    }
  }

  get durationSec(): number {
    if (this.samples.length < 2) return 0;
    return this.samples[this.samples.length - 1]!.t - this.samples[0]!.t;
  }

  get count(): number {
    return this.samples.length;
  }

  snapshot(): RoiSample[] {
    return [...this.samples];
  }
}
