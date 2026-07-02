import { describe, expect, it } from "vitest";
import { pointInPolygon, polygonBoundingBox } from "./geometry.js";

describe("polygonBoundingBox", () => {
  it("computes the correct box for a simple square", () => {
    const square = [
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 4 },
      { x: 1, y: 4 },
    ];
    expect(polygonBoundingBox(square)).toEqual({ minX: 1, minY: 1, maxX: 5, maxY: 4 });
  });

  it("throws on an empty polygon", () => {
    expect(() => polygonBoundingBox([])).toThrow();
  });
});

describe("pointInPolygon", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it("reports points inside a square as inside", () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
  });

  it("reports points outside a square as outside", () => {
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    expect(pointInPolygon({ x: -1, y: 5 }, square)).toBe(false);
    expect(pointInPolygon({ x: 5, y: -1 }, square)).toBe(false);
  });

  it("handles a non-rectangular (triangular) polygon", () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];
    expect(pointInPolygon({ x: 5, y: 2 }, triangle)).toBe(true); // near the wide base, inside
    expect(pointInPolygon({ x: 1, y: 9 }, triangle)).toBe(false); // near the apex but off to the side
  });
});
