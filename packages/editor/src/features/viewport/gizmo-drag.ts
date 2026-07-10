// Applies an in-progress gizmo drag to an entity's transform + physics body,
// with grid / rotation / scale snapping. Mutates the live transform and resets
// the physics body, matching the original inline drag logic.

import { transforms, type Transform } from "@engine/renderer";
import type { DebuggerWorld } from "../../shared/types";
import { getEntityEditorBounds, type EditorBounds } from "./bounds";
import type { GizmoHit } from "./gizmo";

export type GizmoDrag = {
  hit: GizmoHit;
  startWorld: { x: number; y: number };
  startPosition: { x: number; y: number };
  startRotation: number;
  startSize: { x: number; y: number };
};

export type SnapSettings = { grid: boolean; gridSize: number; rotate: boolean; rotateDeg: number };

// Snap an entity's center to the nearest grid CELL CENTER (n·step + step/2), so a
// grid-sized entity fills a cell instead of straddling the grid lines. (position is
// the entity center.)
export function snapToGrid(value: number, step: number) {
  if (step <= 1) return value;
  return Math.round((value - step / 2) / step) * step + step / 2;
}

export function snapSize(value: number) {
  return Math.round(value);
}

export function snapRotation(angle: number, degrees: number) {
  const step = (Math.max(1, degrees) * Math.PI) / 180;
  return Math.round(angle / step) * step;
}

export function applyGizmoDrag<TWorld extends DebuggerWorld>(
  world: TWorld,
  drag: GizmoDrag,
  worldPt: { x: number; y: number },
  snap: SnapSettings,
) {
  const transform = transforms.get(drag.hit.entity);
  if (!transform) return;

  if (drag.hit.kind === "move") {
    const rawX = drag.startPosition.x + (worldPt.x - drag.startWorld.x);
    const rawY = drag.startPosition.y + (worldPt.y - drag.startWorld.y);
    const nextX = snap.grid ? snapToGrid(rawX, snap.gridSize) : rawX;
    const nextY = snap.grid ? snapToGrid(rawY, snap.gridSize) : rawY;
    transform.position.x = nextX;
    transform.position.y = nextY;
    world.physics.reset(drag.hit.entity, { x: nextX, y: nextY }, { x: 0, y: 0 });
    return;
  }

  if (drag.hit.kind === "rotate") {
    const bounds = getEntityEditorBounds(world, drag.hit.entity);
    if (!bounds) return;
    const startAngle = Math.atan2(drag.startWorld.y - bounds.pivotY, drag.startWorld.x - bounds.pivotX);
    const nextAngle = Math.atan2(worldPt.y - bounds.pivotY, worldPt.x - bounds.pivotX);
    const rawRotation = drag.startRotation + (nextAngle - startAngle);
    const rotation = snap.rotate ? snapRotation(rawRotation, snap.rotateDeg) : rawRotation;
    transform.rotation = rotation;
    world.physics.setAngle(drag.hit.entity, rotation);
    return;
  }

  applyScaleDrag(drag, worldPt, transform);
}

function applyScaleDrag(
  drag: GizmoDrag,
  worldPt: { x: number; y: number },
  transform: Transform,
) {
  if (drag.hit.kind !== "scale") return;
  const bounds: EditorBounds = drag.hit.bounds;
  const px = bounds.pivotX;
  const py = bounds.pivotY;
  const startDx = drag.startWorld.x - px;
  const startDy = drag.startWorld.y - py;
  const nextDx = worldPt.x - px;
  const nextDy = worldPt.y - py;
  const minSize = 1;

  // startSize is in world px; a drag multiplies it by the pointer-distance factor.
  let nextSizeX = drag.startSize.x;
  let nextSizeY = drag.startSize.y;

  if (drag.hit.handle === "uniform") {
    const startDist = Math.hypot(startDx, startDy);
    const nextDist = Math.hypot(nextDx, nextDy);
    const factor = startDist < 0.001 ? 1 : nextDist / startDist;
    nextSizeX = keepSign(drag.startSize.x, Math.max(minSize, Math.abs(drag.startSize.x) * factor));
    nextSizeY = keepSign(drag.startSize.y, Math.max(minSize, Math.abs(drag.startSize.y) * factor));
  } else if (drag.hit.handle === "x") {
    if (Math.abs(startDx) >= 0.001) nextSizeX = keepSign(drag.startSize.x, Math.max(minSize, Math.abs(drag.startSize.x) * Math.abs(nextDx / startDx)));
  } else {
    if (Math.abs(startDy) >= 0.001) nextSizeY = keepSign(drag.startSize.y, Math.max(minSize, Math.abs(drag.startSize.y) * Math.abs(nextDy / startDy)));
  }

  transform.size = { x: snapSize(nextSizeX), y: snapSize(nextSizeY) };
}

// Preserve the original sign (mirror) while taking a new magnitude.
function keepSign(original: number, magnitude: number) {
  return original < 0 ? -magnitude : magnitude;
}
