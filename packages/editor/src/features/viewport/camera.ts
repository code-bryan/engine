// Pure camera math. Each function takes the current camera + the relevant rects
// and returns the next camera; the platform layer owns the actual rects/DOM.
// Formulas are preserved verbatim from the original attach loop.

import type { Camera } from "../../platform/viewport-renderer/port";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 20;

export function clampZoom(zoom: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

export type Rect = { left: number; top: number; width: number; height: number };

// Fit the game bounds inside the viewport (zoom-fit / reset / initial center).
export function centerCamera(rect: Rect, gameW: number, gameH: number): Camera {
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  const zoom = Math.min(w / gameW, h / gameH) * 0.92;
  return { zoom, x: rect.left + (w - gameW * zoom) / 2, y: rect.top + (h - gameH * zoom) / 2 };
}

// Zoom toolbar actions, anchored at the viewport center.
export function zoomActionCamera(
  action: "zoom-in" | "zoom-out" | "zoom-100",
  camera: Camera,
  rect: Rect,
): Camera {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const wx = (cx - camera.x) / camera.zoom;
  const wy = (cy - camera.y) / camera.zoom;
  const factor = action === "zoom-in" ? 1.25 : action === "zoom-out" ? 1 / 1.25 : null;
  const zoom = factor !== null ? clampZoom(camera.zoom * factor) : 1;
  return { zoom, x: cx - wx * zoom, y: cy - wy * zoom };
}

// Wheel zoom, anchored at the cursor, in canvas-pixel space.
export function wheelZoomCamera(
  camera: Camera,
  canvasRect: Rect,
  canvasWidth: number,
  clientX: number,
  clientY: number,
  deltaY: number,
  deltaMode: number,
  sensitivity: number,
): Camera {
  const cssScale = canvasRect.width / canvasWidth;
  const cx = (clientX - canvasRect.left) / cssScale;
  const cy = (clientY - canvasRect.top) / cssScale;
  const wx = (cx - camera.x) / camera.zoom;
  const wy = (cy - camera.y) / camera.zoom;
  // 1 = DOM_DELTA_LINE, 2 = DOM_DELTA_PAGE
  const delta = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 240 : 1);
  const speed = Math.pow(sensitivity, 1.35);
  const factor = Math.exp(-delta * 0.0015 * speed);
  const zoom = clampZoom(camera.zoom * factor);
  return { zoom, x: cx - wx * zoom, y: cy - wy * zoom };
}
