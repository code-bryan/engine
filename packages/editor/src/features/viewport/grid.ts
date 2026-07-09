// World grid draw-list builder + grid option resolution. No Pixi.

import type { Camera, DrawCommand } from "../../platform/viewport-renderer/port";
import { type DebugGridOptions, DEFAULT_GRID_OPTIONS } from "../../shared/types";

// Matches the NEXUS design CSS: #222 1px lines on the #141414 renderer background.
// The cell size follows the active grid-snap size from the snap tools.
const GRID_COLOR = 0x222222;
const MIN_CELL_SCREEN_PX = 4; // hide the grid once cells get too dense to read

export function buildWorldGrid(
  camera: Camera,
  cell: number,
  viewportWidth?: number,
  viewportHeight?: number,
): DrawCommand[] {
  if (!viewportWidth || !viewportHeight || camera.zoom <= 0 || cell <= 0) return [];
  if (cell * camera.zoom < MIN_CELL_SCREEN_PX) return [];

  const left = -camera.x / camera.zoom;
  const top = -camera.y / camera.zoom;
  const right = (viewportWidth - camera.x) / camera.zoom;
  const bottom = (viewportHeight - camera.y) / camera.zoom;
  const width = 1 / camera.zoom;
  const stroke = { color: GRID_COLOR, alpha: 1, width };

  const out: DrawCommand[] = [];
  const startX = Math.floor(left / cell) * cell;
  const startY = Math.floor(top / cell) * cell;
  for (let x = startX; x <= right; x += cell) out.push({ kind: "line", x1: x, y1: top, x2: x, y2: bottom, stroke });
  for (let y = startY; y <= bottom; y += cell) out.push({ kind: "line", x1: left, y1: y, x2: right, y2: y, stroke });
  return out;
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
