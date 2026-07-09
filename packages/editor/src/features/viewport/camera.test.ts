import { test, expect } from "bun:test";
import { clampZoom, centerCamera, zoomActionCamera, wheelZoomCamera } from "./camera";

test("clampZoom bounds to [0.1, 20]", () => {
  expect(clampZoom(0.01)).toBe(0.1);
  expect(clampZoom(999)).toBe(20);
  expect(clampZoom(2)).toBe(2);
});

test("centerCamera fits game bounds into the viewport", () => {
  // 320x180 game in a 320x180 viewport at origin -> zoom 0.92, centered.
  const cam = centerCamera({ left: 0, top: 0, width: 320, height: 180 }, 320, 180);
  expect(cam.zoom).toBeCloseTo(0.92, 5);
  expect(cam.x).toBeCloseTo((320 - 320 * 0.92) / 2, 5);
  expect(cam.y).toBeCloseTo((180 - 180 * 0.92) / 2, 5);
});

test("zoom-100 resets zoom to 1", () => {
  const cam = zoomActionCamera("zoom-100", { x: 5, y: 5, zoom: 3 }, { left: 0, top: 0, width: 100, height: 100 });
  expect(cam.zoom).toBe(1);
});

test("zoom-in multiplies zoom by 1.25 anchored at viewport center", () => {
  const cam = zoomActionCamera("zoom-in", { x: 0, y: 0, zoom: 2 }, { left: 0, top: 0, width: 200, height: 200 });
  expect(cam.zoom).toBe(2.5);
  // world point under the center stays put
  const before = { x: (100 - 0) / 2, y: (100 - 0) / 2 };
  expect((100 - cam.x) / cam.zoom).toBeCloseTo(before.x, 5);
});

test("wheelZoomCamera keeps the cursor's world point fixed", () => {
  const start = { x: 10, y: 20, zoom: 1 };
  const rect = { left: 0, top: 0, width: 100, height: 100 };
  const worldBefore = { x: (50 - start.x) / start.zoom, y: (50 - start.y) / start.zoom };
  const cam = wheelZoomCamera(start, rect, 100, 50, 50, 0, -100, 2.5);
  expect((50 - cam.x) / cam.zoom).toBeCloseTo(worldBefore.x, 5);
  expect((50 - cam.y) / cam.zoom).toBeCloseTo(worldBefore.y, 5);
});
