import type { Rollup } from "@halo-pulse/types";
import { dayOrdinal } from "./trend.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 600;
const HEIGHT = 220;
const PAD_LEFT = 36;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;
const GRID_VALUES = [0, 25, 50, 75, 100];

function xScale(ordinal: number, minOrdinal: number, maxOrdinal: number): number {
  if (maxOrdinal === minOrdinal) return (PAD_LEFT + (WIDTH - PAD_RIGHT)) / 2;
  const t = (ordinal - minOrdinal) / (maxOrdinal - minOrdinal);
  return PAD_LEFT + t * (WIDTH - PAD_LEFT - PAD_RIGHT);
}

function yScale(value: number): number {
  const t = value / 100;
  return HEIGHT - PAD_BOTTOM - t * (HEIGHT - PAD_TOP - PAD_BOTTOM);
}

/**
 * Hand-rolled SVG line chart (dataviz skill: thin 2px line, recessive gridlines, a hover
 * crosshair+tooltip on the line form) — no charting library, matching the rest of this app's
 * hand-rolled SVG gauge. Full teardown-and-rebuild on every render: this only re-renders on
 * screen entry / after a session ends, never on a hot path, so simplicity wins over diffing.
 */
export function renderTrendChart(container: HTMLElement, rollups: Rollup[]): void {
  container.innerHTML = "";

  if (rollups.length === 0) {
    const empty = document.createElement("p");
    empty.className = "chart-empty";
    empty.textContent = "No sessions yet — your trend will appear here after a few sessions.";
    container.appendChild(empty);
    return;
  }

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);
  svg.setAttribute("class", "trend-chart");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Stress index trend over time");

  const ordinals = rollups.map((r) => dayOrdinal(r.day));
  const minOrdinal = Math.min(...ordinals);
  const maxOrdinal = Math.max(...ordinals);

  for (const gridValue of GRID_VALUES) {
    const y = yScale(gridValue);
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", String(PAD_LEFT));
    line.setAttribute("x2", String(WIDTH - PAD_RIGHT));
    line.setAttribute("y1", String(y));
    line.setAttribute("y2", String(y));
    line.setAttribute("class", "chart-gridline");
    svg.appendChild(line);

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", String(PAD_LEFT - 6));
    label.setAttribute("y", String(y + 3));
    label.setAttribute("text-anchor", "end");
    label.setAttribute("class", "chart-axis-label");
    label.textContent = String(gridValue);
    svg.appendChild(label);
  }

  const points = rollups.map((r, i) => ({
    x: xScale(ordinals[i] ?? 0, minOrdinal, maxOrdinal),
    y: yScale(r.meanStressIndex),
    rollup: r,
  }));

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  path.setAttribute("class", "chart-line");
  svg.appendChild(path);

  const pointsGroup = document.createElementNS(SVG_NS, "g");
  for (const p of points) {
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", String(p.x));
    circle.setAttribute("cy", String(p.y));
    circle.setAttribute("r", "4");
    circle.setAttribute("class", "chart-point");
    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = `${p.rollup.day}: ${p.rollup.meanStressIndex.toFixed(0)} (${p.rollup.sampleCount} reading${p.rollup.sampleCount === 1 ? "" : "s"})`;
    circle.appendChild(title);
    pointsGroup.appendChild(circle);
  }
  svg.appendChild(pointsGroup);

  const labelIndices = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]);
  for (const i of labelIndices) {
    const r = rollups[i];
    const p = points[i];
    if (!r || !p) continue;
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", String(p.x));
    label.setAttribute("y", String(HEIGHT - 6));
    label.setAttribute(
      "text-anchor",
      i === 0 ? "start" : i === points.length - 1 ? "end" : "middle",
    );
    label.setAttribute("class", "chart-axis-label");
    label.textContent = r.day.slice(5); // MM-DD
    svg.appendChild(label);
  }

  const crosshair = document.createElementNS(SVG_NS, "line");
  crosshair.setAttribute("y1", String(PAD_TOP));
  crosshair.setAttribute("y2", String(HEIGHT - PAD_BOTTOM));
  crosshair.setAttribute("class", "chart-crosshair");
  crosshair.setAttribute("visibility", "hidden");
  svg.appendChild(crosshair);

  container.appendChild(svg);

  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.hidden = true;
  container.appendChild(tooltip);

  const hitArea = document.createElementNS(SVG_NS, "rect");
  hitArea.setAttribute("x", String(PAD_LEFT));
  hitArea.setAttribute("y", String(PAD_TOP));
  hitArea.setAttribute("width", String(WIDTH - PAD_LEFT - PAD_RIGHT));
  hitArea.setAttribute("height", String(HEIGHT - PAD_TOP - PAD_BOTTOM));
  hitArea.setAttribute("class", "chart-hit-area");
  hitArea.addEventListener("mousemove", (ev: MouseEvent) => {
    const rect = svg.getBoundingClientRect();
    const svgX = ((ev.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = points[0];
    let nearestDist = Number.POSITIVE_INFINITY;
    for (const p of points) {
      const dist = Math.abs(p.x - svgX);
      if (dist < nearestDist) {
        nearest = p;
        nearestDist = dist;
      }
    }
    if (!nearest) return;
    crosshair.setAttribute("x1", String(nearest.x));
    crosshair.setAttribute("x2", String(nearest.x));
    crosshair.setAttribute("visibility", "visible");
    tooltip.hidden = false;
    tooltip.textContent = `${nearest.rollup.day}: ${nearest.rollup.meanStressIndex.toFixed(0)}`;
    tooltip.style.left = `${(nearest.x / WIDTH) * 100}%`;
  });
  hitArea.addEventListener("mouseleave", () => {
    crosshair.setAttribute("visibility", "hidden");
    tooltip.hidden = true;
  });
  svg.appendChild(hitArea);
}
