import type { Rollup, Session } from "@halo-pulse/types";
import { formatSessionRow, formatTrendSummary } from "./format.js";
import type { HeatmapCell } from "./heatmap.js";
import { renderHeatmap } from "./heatmapView.js";
import type { TrendResult } from "./trend.js";
import { renderTrendChart } from "./trendChart.js";

export interface HistoryScreenElements {
  trendSummary: HTMLElement;
  trendChartContainer: HTMLElement;
  heatmapContainer: HTMLElement;
  sessionList: HTMLElement;
}

export function getHistoryScreenElements(root: ParentNode): HistoryScreenElements {
  const trendSummary = root.querySelector<HTMLElement>("#trendSummary");
  const trendChartContainer = root.querySelector<HTMLElement>("#trendChartContainer");
  const heatmapContainer = root.querySelector<HTMLElement>("#heatmapContainer");
  const sessionList = root.querySelector<HTMLElement>("#sessionList");
  if (!trendSummary || !trendChartContainer || !heatmapContainer || !sessionList) {
    throw new Error(
      "getHistoryScreenElements: history screen markup is missing an expected element",
    );
  }
  return { trendSummary, trendChartContainer, heatmapContainer, sessionList };
}

function buildSessionRow(session: Session): HTMLLIElement {
  const row = formatSessionRow(session);
  const li = document.createElement("li");
  li.className = "session-row";

  const date = document.createElement("span");
  date.className = "session-date";
  date.textContent = row.dateLabel;

  const duration = document.createElement("span");
  duration.className = "session-duration";
  duration.textContent = row.durationLabel;

  const mean = document.createElement("span");
  mean.className = "session-mean";
  mean.textContent = `avg ${row.meanLabel}`;

  const peak = document.createElement("span");
  peak.className = "session-peak";
  peak.textContent = `peak ${row.peakLabel}`;

  li.append(date, duration, mean, peak);
  return li;
}

export interface HistoryScreenData {
  sessions: Session[];
  rollups: Rollup[];
  heatmapCells: HeatmapCell[];
  trend: TrendResult | null;
}

export function renderHistoryScreen(
  elements: HistoryScreenElements,
  data: HistoryScreenData,
): void {
  elements.trendSummary.textContent = formatTrendSummary(data.trend);
  renderTrendChart(elements.trendChartContainer, data.rollups);
  renderHeatmap(elements.heatmapContainer, data.heatmapCells);

  elements.sessionList.innerHTML = "";
  if (data.sessions.length === 0) {
    const empty = document.createElement("li");
    empty.className = "session-empty";
    empty.textContent = "No sessions yet.";
    elements.sessionList.appendChild(empty);
    return;
  }

  const sorted = [...data.sessions].sort((a, b) => b.startedAt - a.startedAt);
  for (const session of sorted) {
    elements.sessionList.appendChild(buildSessionRow(session));
  }
}
