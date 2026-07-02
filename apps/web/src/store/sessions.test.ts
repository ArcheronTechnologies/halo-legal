import "./testSetup.js";
import type { Sample, Session } from "@halo-pulse/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HaloPulseDb } from "./db.js";
import { getSamplesForSession, listSessions, saveSession } from "./sessions.js";

let db: HaloPulseDb;

function makeSession(overrides: Partial<Session>): Session {
  return {
    id: `s-${Math.random()}`,
    profileId: "local",
    startedAt: 0,
    endedAt: 60,
    baselineId: "b1",
    signalLayers: ["classical"],
    stressIndexMean: 50,
    stressIndexMedian: 50,
    stressIndexPeak: 60,
    hrMean: 70,
    hrvSummary: { rmssd: 40, sdnn: 50, lfhf: null },
    sqiMean: 0.7,
    ...overrides,
  };
}

function makeSample(sessionId: string, t: number): Sample {
  return {
    id: `sample-${sessionId}-${t}-${Math.random()}`,
    sessionId,
    t,
    hr: 70,
    behavioural: { blinkDeviation: 0, browTension: 0.1, lidTension: 0.1, lipTension: 0.1 },
    sqi: 0.7,
    stressIndex: 50,
    confidence: 0.7,
  };
}

beforeEach(() => {
  db = new HaloPulseDb(`test-sessions-${Math.random()}`);
});

afterEach(async () => {
  await db.delete();
});

describe("sessions store", () => {
  it("saves a session and its samples together", async () => {
    const session = makeSession({ id: "s1" });
    const samples = [makeSample("s1", 0), makeSample("s1", 2), makeSample("s1", 4)];

    await saveSession(db, session, samples);

    const sessions = await listSessions(db, "local");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.id).toBe("s1");

    const storedSamples = await getSamplesForSession(db, "s1");
    expect(storedSamples).toHaveLength(3);
    expect(storedSamples.map((s) => s.t)).toEqual([0, 2, 4]); // sorted by t
  });

  it("handles a session with zero samples without error", async () => {
    const session = makeSession({ id: "s-empty" });
    await saveSession(db, session, []);
    const storedSamples = await getSamplesForSession(db, "s-empty");
    expect(storedSamples).toEqual([]);
  });

  it("does not mix samples across sessions", async () => {
    await saveSession(db, makeSession({ id: "s1" }), [makeSample("s1", 0)]);
    await saveSession(db, makeSession({ id: "s2" }), [makeSample("s2", 0), makeSample("s2", 2)]);

    expect(await getSamplesForSession(db, "s1")).toHaveLength(1);
    expect(await getSamplesForSession(db, "s2")).toHaveLength(2);
  });

  it("listSessions sorts by startedAt", async () => {
    await saveSession(db, makeSession({ id: "s-late", startedAt: 200 }), []);
    await saveSession(db, makeSession({ id: "s-early", startedAt: 50 }), []);

    const sessions = await listSessions(db, "local");
    expect(sessions.map((s) => s.id)).toEqual(["s-early", "s-late"]);
  });
});
