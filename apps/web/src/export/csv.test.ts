import type { Sample, Session } from "@halo-pulse/types";
import { describe, expect, it } from "vitest";
import { samplesToCsv, sessionsToCsv } from "./csv.js";

describe("sessionsToCsv", () => {
  it("produces the expected header + row for one session (hand-derived)", () => {
    const session: Session = {
      id: "s1,x", // deliberately contains a comma to exercise quoting
      profileId: "local",
      startedAt: 0,
      endedAt: 60,
      baselineId: "b1",
      signalLayers: ["classical", "dl"],
      stressIndexMean: 50.5,
      stressIndexMedian: 50,
      stressIndexPeak: 60,
      hrMean: 70,
      hrvSummary: { rmssd: 40, sdnn: 50, lfhf: null },
      sqiMean: 0.7,
    };

    const csv = sessionsToCsv([session]);
    const expectedHeader =
      "id,startedAt,endedAt,baselineId,signalLayers,stressIndexMean,stressIndexMedian,stressIndexPeak,hrMean,rmssd,sdnn,lfhf,sqiMean";
    const expectedRow = '"s1,x",0,60,b1,classical|dl,50.5,50,60,70,40,50,,0.7';
    expect(csv).toBe(`${expectedHeader}\n${expectedRow}`);
  });

  it("produces just the header for an empty list", () => {
    expect(sessionsToCsv([])).toBe(
      "id,startedAt,endedAt,baselineId,signalLayers,stressIndexMean,stressIndexMedian,stressIndexPeak,hrMean,rmssd,sdnn,lfhf,sqiMean",
    );
  });
});

describe("samplesToCsv", () => {
  it("produces the expected header + row for one sample (hand-derived)", () => {
    const sample: Sample = {
      id: "sm1",
      sessionId: "s1",
      t: 1000,
      hr: 72,
      rmssd: 35,
      sdnn: 45,
      lfhf: 1.2,
      behavioural: { blinkDeviation: -0.05, browTension: 0.3, lidTension: 0.2, lipTension: 0.1 },
      sqi: 0.8,
      stressIndex: 55,
      confidence: 0.9,
    };

    const csv = samplesToCsv([sample]);
    const expectedHeader =
      "id,sessionId,t,hr,rmssd,sdnn,lfhf,browTension,lidTension,lipTension,blinkDeviation,sqi,stressIndex,confidence";
    const expectedRow = "sm1,s1,1000,72,35,45,1.2,0.3,0.2,0.1,-0.05,0.8,55,0.9";
    expect(csv).toBe(`${expectedHeader}\n${expectedRow}`);
  });

  it("renders undefined optional fields (rmssd/sdnn/lfhf) as empty CSV cells", () => {
    const sample: Sample = {
      id: "sm2",
      sessionId: "s1",
      t: 2000,
      hr: 68,
      behavioural: { blinkDeviation: 0, browTension: 0, lidTension: 0, lipTension: 0 },
      sqi: 0.5,
      stressIndex: 40,
      confidence: 0.6,
    };

    const csv = samplesToCsv([sample]);
    const row = csv.split("\n")[1];
    expect(row).toBe("sm2,s1,2000,68,,,,0,0,0,0,0.5,40,0.6");
  });
});
