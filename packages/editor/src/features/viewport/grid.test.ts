import { test, expect } from "bun:test";
import { buildWorldGrid, resolveGridOptions } from "./grid";

test("buildWorldGrid returns nothing when the viewport is unknown", () => {
  expect(buildWorldGrid({ x: 0, y: 0, zoom: 1 }, 16)).toEqual([]);
});

test("buildWorldGrid hides the grid when cells get too small on screen", () => {
  // cell * zoom = 16 * 0.1 = 1.6 < 4px minimum -> hidden
  expect(buildWorldGrid({ x: 0, y: 0, zoom: 0.1 }, 16, 800, 600)).toEqual([]);
});

test("buildWorldGrid emits vertical + horizontal lines", () => {
  const lines = buildWorldGrid({ x: 0, y: 0, zoom: 1 }, 100, 300, 200);
  expect(lines.length).toBeGreaterThan(0);
  expect(lines.every((cmd) => cmd.kind === "line")).toBe(true);
});

test("resolveGridOptions applies defaults and floors", () => {
  const opts = resolveGridOptions({ snapSize: 33.6 });
  expect(opts.snapSize).toBe(34);
  expect(opts.majorEvery).toBeGreaterThanOrEqual(2);
});
