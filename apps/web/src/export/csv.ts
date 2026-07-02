import type { Sample, Session } from "@halo-pulse/types";

type CsvValue = string | number | boolean | null | undefined;

function csvEscape(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.join(","), ...rows.map((row) => row.map(csvEscape).join(","))];
  return lines.join("\n");
}

const SESSION_HEADERS = [
  "id",
  "startedAt",
  "endedAt",
  "baselineId",
  "signalLayers",
  "stressIndexMean",
  "stressIndexMedian",
  "stressIndexPeak",
  "hrMean",
  "rmssd",
  "sdnn",
  "lfhf",
  "sqiMean",
];

export function sessionsToCsv(sessions: Session[]): string {
  return toCsv(
    SESSION_HEADERS,
    sessions.map((s) => [
      s.id,
      s.startedAt,
      s.endedAt,
      s.baselineId,
      s.signalLayers.join("|"),
      s.stressIndexMean,
      s.stressIndexMedian,
      s.stressIndexPeak,
      s.hrMean,
      s.hrvSummary.rmssd,
      s.hrvSummary.sdnn,
      s.hrvSummary.lfhf,
      s.sqiMean,
    ]),
  );
}

const SAMPLE_HEADERS = [
  "id",
  "sessionId",
  "t",
  "hr",
  "rmssd",
  "sdnn",
  "lfhf",
  "browTension",
  "lidTension",
  "lipTension",
  "blinkDeviation",
  "sqi",
  "stressIndex",
  "confidence",
];

export function samplesToCsv(samples: Sample[]): string {
  return toCsv(
    SAMPLE_HEADERS,
    samples.map((s) => [
      s.id,
      s.sessionId,
      s.t,
      s.hr,
      s.rmssd,
      s.sdnn,
      s.lfhf,
      s.behavioural.browTension,
      s.behavioural.lidTension,
      s.behavioural.lipTension,
      s.behavioural.blinkDeviation,
      s.sqi,
      s.stressIndex,
      s.confidence,
    ]),
  );
}
