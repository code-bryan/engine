import { test, expect } from "bun:test";
import { snapToGrid, snapSize, snapRotation } from "./gizmo-drag";

test("snapToGrid snaps to the nearest cell center (n·step + step/2)", () => {
  expect(snapToGrid(10, 16)).toBe(8);   // cell center 8
  expect(snapToGrid(5, 16)).toBe(8);
  expect(snapToGrid(20, 16)).toBe(24);  // cell center 24
  expect(snapToGrid(40, 16)).toBe(40);  // 2·16 + 8
});

test("snapToGrid is a no-op for step <= 1", () => {
  expect(snapToGrid(3.7, 1)).toBe(3.7);
  expect(snapToGrid(3.7, 0)).toBe(3.7);
});

test("snapSize rounds to whole pixels", () => {
  expect(snapSize(16.4)).toBe(16);
  expect(snapSize(15.6)).toBe(16);
  expect(snapSize(100)).toBe(100);
});

test("snapRotation snaps to degree steps", () => {
  const deg15 = (15 * Math.PI) / 180;
  expect(snapRotation(deg15 * 1.4, 15)).toBeCloseTo(deg15, 10);
  expect(snapRotation(0.01, 90)).toBe(0);
});
