import { test, expect } from "bun:test";
import { snapToGrid, snapScale, snapRotation } from "./gizmo-drag";

test("snapToGrid rounds to the nearest multiple", () => {
  expect(snapToGrid(10, 16)).toBe(16);
  expect(snapToGrid(5, 16)).toBe(0);
  expect(snapToGrid(40, 16)).toBe(48);
});

test("snapToGrid is a no-op for step <= 1", () => {
  expect(snapToGrid(3.7, 1)).toBe(3.7);
  expect(snapToGrid(3.7, 0)).toBe(3.7);
});

test("snapScale rounds to 1/20 increments", () => {
  expect(snapScale(0.333)).toBeCloseTo(0.35, 10);
  expect(snapScale(1)).toBe(1);
});

test("snapRotation snaps to degree steps", () => {
  const deg15 = (15 * Math.PI) / 180;
  expect(snapRotation(deg15 * 1.4, 15)).toBeCloseTo(deg15, 10);
  expect(snapRotation(0.01, 90)).toBe(0);
});
