import { clamp } from "@halo-pulse/dsp";
import type { HeatmapCell } from "./heatmap.js";

/**
 * Sequential single-hue (blue) ramp, light->dark, 13 steps — dataviz skill palette.md's
 * reference sequential range (100..700), which the doc prescribes exactly for this use case:
 * "the full 100->700 range is for sequential encoding (continuous magnitude — heatmaps,
 * choropleths) where the lightest step means near zero."
 */
const SEQUENTIAL_BLUE_RAMP = [
  "#cde2fb",
  "#b7d3f6",
  "#9ec5f4",
  "#86b6ef",
  "#6da7ec",
  "#5598e7",
  "#3987e5",
  "#2a78d6",
  "#256abf",
  "#1c5cab",
  "#184f95",
  "#104281",
  "#0d366b",
];

function colorForValue(value: number): string {
  const clamped = clamp(value, 0, 100);
  const index = Math.round((clamped / 100) * (SEQUENTIAL_BLUE_RAMP.length - 1));
  return SEQUENTIAL_BLUE_RAMP[index] ?? SEQUENTIAL_BLUE_RAMP[0] ?? "#cde2fb";
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * 7 (day-of-week) x 24 (hour) grid (PLAN.md §6 "time-of-day patterns"). Cells with no data are
 * rendered as a distinct neutral swatch, never a fabricated "0/calm" color — the dataviz skill's
 * rule against implying precision the data doesn't have.
 */
export function renderHeatmap(container: HTMLElement, cells: HeatmapCell[]): void {
  container.innerHTML = "";

  const byKey = new Map(cells.map((c) => [`${c.dayOfWeek}-${c.hour}`, c]));

  const grid = document.createElement("div");
  grid.className = "heatmap-grid";
  grid.setAttribute("role", "img");
  grid.setAttribute("aria-label", "Stress index by day of week and hour");

  // Corner spacer + 24 hour labels (every 4th hour, to stay legible) across the header row.
  grid.appendChild(document.createElement("div")).className = "heatmap-corner";
  for (let hour = 0; hour < 24; hour++) {
    const label = document.createElement("div");
    label.className = "heatmap-hour-label";
    label.textContent = hour % 4 === 0 ? String(hour) : "";
    grid.appendChild(label);
  }

  for (let dow = 0; dow < 7; dow++) {
    const rowLabel = document.createElement("div");
    rowLabel.className = "heatmap-day-label";
    rowLabel.textContent = DAY_LABELS[dow] ?? "";
    grid.appendChild(rowLabel);

    for (let hour = 0; hour < 24; hour++) {
      const cell = byKey.get(`${dow}-${hour}`);
      const cellEl = document.createElement("div");
      cellEl.className = cell ? "heatmap-cell" : "heatmap-cell heatmap-cell--empty";
      if (cell) {
        cellEl.style.backgroundColor = colorForValue(cell.meanStressIndex);
        cellEl.title = `${DAY_LABELS[dow]} ${hour}:00 — ${cell.meanStressIndex.toFixed(0)} (${cell.sampleCount} reading${cell.sampleCount === 1 ? "" : "s"})`;
      } else {
        cellEl.title = `${DAY_LABELS[dow]} ${hour}:00 — no data`;
      }
      grid.appendChild(cellEl);
    }
  }

  container.appendChild(grid);

  if (cells.length === 0) {
    const empty = document.createElement("p");
    empty.className = "chart-empty";
    empty.textContent =
      "No sessions yet — your time-of-day pattern will appear here after a few sessions.";
    container.appendChild(empty);
  }
}
