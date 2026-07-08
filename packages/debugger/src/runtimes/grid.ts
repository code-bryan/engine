import { Graphics } from "pixi.js";
import { type DebugGridOptions, type DebugState, DEFAULT_GRID_OPTIONS } from "../shared/types";

// Matches the NEXUS design CSS: #222 1px lines on the #141414 renderer background.
// The cell size follows the active grid-snap size from the snap tools.
const GRID_COLOR = 0x222222;
const MIN_CELL_SCREEN_PX = 4; // hide the grid once cells get too dense to read

export function renderWorldGrid(
  overlay: Graphics,
  camera: DebugState["camera"],
  cell: number,
  viewportWidth?: number,
  viewportHeight?: number,
) {
  if (!viewportWidth || !viewportHeight || camera.zoom <= 0 || cell <= 0) return;
  if (cell * camera.zoom < MIN_CELL_SCREEN_PX) return;

  const worldLeft = -camera.x / camera.zoom;
  const worldTop = -camera.y / camera.zoom;
  const worldRight = (viewportWidth - camera.x) / camera.zoom;
  const worldBottom = (viewportHeight - camera.y) / camera.zoom;
  const worldLineWidth = 1 / camera.zoom;

  drawGridLines(overlay, worldLeft, worldTop, worldRight, worldBottom, cell, {
    color: GRID_COLOR,
    alpha: 1,
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

function drawGridLines(
  overlay: Graphics,
  left: number,
  top: number,
  right: number,
  bottom: number,
  step: number,
  stroke: { color: number; alpha: number; width: number },
) {
  if (step <= 0) return;

  const startX = Math.floor(left / step) * step;
  const startY = Math.floor(top / step) * step;

  for (let x = startX; x <= right; x += step) {
    overlay.moveTo(x, top).lineTo(x, bottom).stroke(stroke);
  }

  for (let y = startY; y <= bottom; y += step) {
    overlay.moveTo(left, y).lineTo(right, y).stroke(stroke);
  }
}
