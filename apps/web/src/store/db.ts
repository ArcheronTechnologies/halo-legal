import type { Baseline, Sample, Session, Settings } from "@halo-pulse/types";
import Dexie, { type Table } from "dexie";

/** Single-profile local app for now — no multi-profile UI exists yet. */
export const LOCAL_PROFILE_ID = "local";

/**
 * The local IndexedDB store (ARCHITECTURE.md §6). Every table holds *derived numbers only* —
 * no raw frame, image, or face template is ever written here. That invariant is enforced by
 * review and by packages/types' schemas not having a field for it, not by this file alone.
 */
export class HaloPulseDb extends Dexie {
  baselines!: Table<Baseline, string>;
  sessions!: Table<Session, string>;
  samples!: Table<Sample, string>;
  settings!: Table<Settings, string>;

  constructor(name = "halo-pulse") {
    super(name);
    this.version(1).stores({
      baselines: "id, profileId, capturedAt",
      sessions: "id, profileId, startedAt",
      samples: "id, sessionId, t",
      settings: "id",
    });
  }
}

export const db = new HaloPulseDb();
