import { Graphics } from "pixi.js";
import { type DebugGridOptions, type DebugState, DEFAULT_GRID_OPTIONS } from "../shared/types";

export function renderWorldGrid(
  overlay: Graphics,
  camera: DebugState["camera"],
  options: Required<DebugGridOptions>,
  viewportWidth?: number,
  viewportHeight?: number,
) {
  if (!viewportWidth || !viewportHeight || camera.zoom <= 0) return;

  const worldLeft = -camera.x / camera.zoom;
  const worldTop = -camera.y / camera.zoom;
  const worldRight = (viewportWidth - camera.x) / camera.zoom;
  const worldBottom = (viewportHeight - camera.y) / camera.zoom;
  const worldLineWidth = 1 / camera.zoom;
  const minorStep = options.snapSize;
  const majorStep = minorStep * options.majorEvery;
  const minorScreenPx = minorStep * camera.zoom;
  const majorScreenPx = majorStep * camera.zoom;
  const minorAlpha = computeMinorAlpha(minorScreenPx, options);
  const majorAlpha = computeMajorAlpha(majorScreenPx);

  if (minorAlpha > 0) {
    drawGridLines(overlay, worldLeft, worldTop, worldRight, worldBottom, minorStep, {
      color: 0xc9ccd4,
      alpha: minorAlpha,
      width: worldLineWidth,
    }, majorStep);
  }

  drawGridLines(overlay, worldLeft, worldTop, worldRight, worldBottom, majorStep, {
    color: 0xd7dbe4,
    alpha: majorAlpha,
    width: worldLineWidth,
  });
}

export function resolveGridOptions(options?: DebugGridOptions): Required<DebugGridOptions> {
  return {
    snapSize: Math.max(1, Math.round(options?.snapSize ?? DEFAULT_GRID_OPTIONS.snapSize)),
    majorEvery: Math.max(2, Math.round(options?.majorEvery ?? DEFAULT_GRID_OPTIONS.majorEvery)),
    minMinorScreenPx: Math.max(4, options?.minMinorScreenPx ?? DEFAULT_GRID_OPTIONS.minMinorScreenPx),
    maxMinorScreenPx: Math.max(
      options?.minMinorScreenPx ?? DEFAULT_GRID_OPTIONS.minMinorScreenPx,
      options?.maxMinorScreenPx ?? DEFAULT_GRID_OPTIONS.maxMinorScreenPx,
    ),
  };
}

function computeMinorAlpha(screenPx: number, options: Required<DebugGridOptions>) {
  if (screenPx <= options.minMinorScreenPx * 0.7) return 0;
  if (screenPx >= options.maxMinorScreenPx * 1.35) return 0.065;

  const t = clamp01((screenPx - options.minMinorScreenPx * 0.7) / (options.maxMinorScreenPx * 1.35 - options.minMinorScreenPx * 0.7));
  return lerp(0.045, 0.095, t);
}

function computeMajorAlpha(screenPx: number) {
  const t = clamp01((screenPx - 40) / 80);
  return lerp(0.085, 0.13, t);
}

function drawGridLines(
  overlay: Graphics,
  left: number,
  top: number,
  right: number,
  bottom: number,
  step: number,
  stroke: { color: number; alpha: number; width: number },
  skipEvery?: number,
) {
  if (step <= 0) return;

  const startX = Math.floor(left / step) * step;
  const startY = Math.floor(top / step) * step;

  for (let x = startX; x <= right; x += step) {
    if (skipEvery && isGridLineAligned(x, skipEvery)) continue;
    overlay.moveTo(x, top).lineTo(x, bottom).stroke(stroke);
  }

  for (let y = startY; y <= bottom; y += step) {
    if (skipEvery && isGridLineAligned(y, skipEvery)) continue;
    overlay.moveTo(left, y).lineTo(right, y).stroke(stroke);
  }
}

function isGridLineAligned(value: number, step: number) {
  const rounded = Math.round(value / step);
  return Math.abs(value - rounded * step) < 0.0001;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
