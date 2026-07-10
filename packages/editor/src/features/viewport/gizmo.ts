// Transform gizmos: hit-testing (pointer -> which handle) and draw-list builders
// (state -> world-space primitives). No Pixi — the renderer paints the commands.

import type { Entity } from "@engine/ecs-core";
import { transforms } from "@engine/renderer";
import type { DrawCommand } from "../../platform/viewport-renderer/port";
import type { DebuggerWorld, EditorToolMode } from "../../shared/types";
import { getEntityEditorBounds, type EditorBounds } from "./bounds";

export type { EditorBounds } from "./bounds";
export { getEntityEditorBounds } from "./bounds";

export type GizmoHit =
  | { kind: "move"; entity: Entity }
  | { kind: "scale"; entity: Entity; handle: "x" | "y" | "uniform"; bounds: EditorBounds }
  | { kind: "rotate"; entity: Entity; bounds: EditorBounds };

const GIZMO_RED = 0xf87171;
const GIZMO_GREEN = 0x4ade80;
const GIZMO_BLUE = 0x60a5fa;
const GIZMO_YELLOW = 0xfacc15;
const SELECT_BLUE = 0x60a5fa;

function gizmoAxisLength(_bounds: EditorBounds, z: number) {
  return 90 / z;
}

function gizmoRotateRadius(_bounds: EditorBounds, z: number) {
  return 70 / z;
}

export function buildSelectionOutline<TWorld extends DebuggerWorld>(
  world: TWorld,
  selectedEntity: Entity | undefined,
  zoom: number,
): DrawCommand[] {
  if (selectedEntity === undefined) return [];
  const bounds = getEntityEditorBounds(world, selectedEntity);
  if (!bounds) return [];

  const outlineWidth = 1.5 / Math.max(zoom, 0.1);
  const pivotRadius = 4 / Math.max(zoom, 0.1);

  // Empty entity (no sprite/collider → 0×0 bounds): draw a constant-screen-size
  // marker box at the pivot instead of a zero-size world rect, like Unity's empties.
  const markerHalf = 6 / Math.max(zoom, 0.1);
  const isEmpty = bounds.width === 0 && bounds.height === 0;
  const box = isEmpty
    ? { x: bounds.pivotX - markerHalf, y: bounds.pivotY - markerHalf, width: markerHalf * 2, height: markerHalf * 2 }
    : { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };

  return [
    { kind: "rect", x: box.x, y: box.y, width: box.width, height: box.height, stroke: { color: SELECT_BLUE, width: outlineWidth, alpha: 0.95 } },
    { kind: "circle", x: bounds.pivotX, y: bounds.pivotY, radius: pivotRadius, fill: { color: SELECT_BLUE, alpha: 0.95 } },
  ];
}

export function buildEditorGizmo<TWorld extends DebuggerWorld>(
  world: TWorld,
  selectedEntity: Entity | undefined,
  toolMode: EditorToolMode,
  zoom: number,
): DrawCommand[] {
  if (selectedEntity === undefined) return [];
  const bounds = getEntityEditorBounds(world, selectedEntity);
  if (!bounds) return [];

  const z = Math.max(zoom, 0.1);
  const handleRadius = 6 / z;
  const outlineWidth = 3 / z;
  const px = bounds.pivotX;
  const py = bounds.pivotY;

  const out: DrawCommand[] = buildSelectionOutline(world, selectedEntity, zoom);

  if (toolMode === "move") {
    const axis = gizmoAxisLength(bounds, z);
    const head = 8 / z;
    const boxHalf = 5 / z;
    const off = 8 / z;
    const leg = 9 / z;

    out.push(
      { kind: "line", x1: px, y1: py, x2: px + axis, y2: py, stroke: { color: GIZMO_RED, width: outlineWidth, alpha: 0.95 } },
      { kind: "poly", points: [px + axis, py, px + axis - head, py - head * 0.6, px + axis - head, py + head * 0.6], fill: { color: GIZMO_RED, alpha: 0.95 } },
      { kind: "line", x1: px, y1: py, x2: px, y2: py - axis, stroke: { color: GIZMO_GREEN, width: outlineWidth, alpha: 0.95 } },
      { kind: "poly", points: [px, py - axis, px - head * 0.6, py - axis + head, px + head * 0.6, py - axis + head], fill: { color: GIZMO_GREEN, alpha: 0.95 } },
      { kind: "path", points: [px + off, py - off - leg, px + off, py - off, px + off + leg, py - off], stroke: { color: GIZMO_GREEN, width: outlineWidth * 0.9, alpha: 0.5 } },
      { kind: "rect", x: px - boxHalf, y: py - boxHalf, width: boxHalf * 2, height: boxHalf * 2, fill: { color: 0xffffff, alpha: 0.95 }, stroke: { color: 0x000000, width: outlineWidth * 0.8, alpha: 0.5 } },
    );
    return out;
  }

  if (toolMode === "scale") {
    const axis = gizmoAxisLength(bounds, z);
    const tip = 6 / z;
    const boxHalf = 6 / z;
    const off = 8 / z;
    const leg = 9 / z;

    out.push(
      { kind: "line", x1: px, y1: py, x2: px + axis, y2: py, stroke: { color: GIZMO_RED, width: outlineWidth, alpha: 0.95 } },
      { kind: "rect", x: px + axis - tip, y: py - tip, width: tip * 2, height: tip * 2, fill: { color: GIZMO_RED, alpha: 0.95 } },
      { kind: "line", x1: px, y1: py, x2: px, y2: py - axis, stroke: { color: GIZMO_GREEN, width: outlineWidth, alpha: 0.95 } },
      { kind: "rect", x: px - tip, y: py - axis - tip, width: tip * 2, height: tip * 2, fill: { color: GIZMO_GREEN, alpha: 0.95 } },
      { kind: "path", points: [px + off, py - off - leg, px + off, py - off, px + off + leg, py - off], stroke: { color: GIZMO_YELLOW, width: outlineWidth * 0.9, alpha: 0.5 } },
      { kind: "rect", x: px - boxHalf, y: py - boxHalf, width: boxHalf * 2, height: boxHalf * 2, fill: { color: GIZMO_YELLOW, alpha: 0.95 }, stroke: { color: 0x000000, width: outlineWidth * 0.8, alpha: 0.5 } },
    );
    return out;
  }

  // rotate: blue ring + white handle that orbits with the entity's rotation
  const rotateRadius = gizmoRotateRadius(bounds, z);
  const rotation = transforms.get(selectedEntity)?.rotation ?? 0;
  const handleAngle = -Math.PI / 2 + rotation;
  const hx = px + Math.cos(handleAngle) * rotateRadius;
  const hy = py + Math.sin(handleAngle) * rotateRadius;
  out.push(
    { kind: "circle", x: px, y: py, radius: rotateRadius, stroke: { color: GIZMO_BLUE, width: 4 / z, alpha: 0.9 } },
    { kind: "line", x1: px, y1: py, x2: hx, y2: hy, stroke: { color: GIZMO_BLUE, width: outlineWidth, alpha: 0.5 } },
    { kind: "circle", x: hx, y: hy, radius: handleRadius, fill: { color: 0xffffff, alpha: 0.95 }, stroke: { color: GIZMO_BLUE, width: outlineWidth, alpha: 0.95 } },
  );
  return out;
}

export function hitEditorGizmo<TWorld extends DebuggerWorld>(
  world: TWorld,
  entity: Entity | undefined,
  toolMode: EditorToolMode,
  point: { x: number; y: number },
  zoom: number,
): GizmoHit | null {
  if (entity === undefined) return null;
  const bounds = getEntityEditorBounds(world, entity);
  if (!bounds) return null;

  const handleRadius = 10 / Math.max(zoom, 0.1);

  if (toolMode === "move") {
    if (pointHitsMoveGizmo(point, bounds, handleRadius, zoom)) return { kind: "move", entity };
    return null;
  }

  if (toolMode === "scale") {
    const z = Math.max(zoom, 0.1);
    const axis = gizmoAxisLength(bounds, z);
    const px = bounds.pivotX;
    const py = bounds.pivotY;
    if (Math.abs(point.x - px) <= handleRadius && Math.abs(point.y - py) <= handleRadius) {
      return { kind: "scale", entity, handle: "uniform", bounds };
    }
    if (Math.abs(point.x - (px + axis)) <= handleRadius && Math.abs(point.y - py) <= handleRadius) {
      return { kind: "scale", entity, handle: "x", bounds };
    }
    if (Math.abs(point.x - px) <= handleRadius && Math.abs(point.y - (py - axis)) <= handleRadius) {
      return { kind: "scale", entity, handle: "y", bounds };
    }
    return null;
  }

  const rotateRadius = gizmoRotateRadius(bounds, Math.max(zoom, 0.1));
  const distance = Math.hypot(point.x - bounds.pivotX, point.y - bounds.pivotY);
  if (Math.abs(distance - rotateRadius) <= handleRadius * 1.2) return { kind: "rotate", entity, bounds };

  return null;
}

function pointInBounds(point: { x: number; y: number }, bounds: EditorBounds) {
  return point.x >= bounds.x
    && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y <= bounds.y + bounds.height;
}

function inflateBounds(bounds: EditorBounds, amount: number): EditorBounds {
  return {
    ...bounds,
    x: bounds.x - amount,
    y: bounds.y - amount,
    width: bounds.width + amount * 2,
    height: bounds.height + amount * 2,
    centerX: bounds.centerX,
    centerY: bounds.centerY,
  };
}

function pointHitsMoveGizmo(
  point: { x: number; y: number },
  bounds: EditorBounds,
  handleRadius: number,
  zoom: number,
) {
  if (pointInBounds(point, inflateBounds(bounds, handleRadius))) return true;

  const axis = Math.max(bounds.width, bounds.height) * 0.5 + 24 / Math.max(zoom, 0.1);
  const linePadding = handleRadius * 0.8;

  if (
    point.x >= bounds.pivotX - linePadding
    && point.x <= bounds.pivotX + axis + linePadding
    && point.y >= bounds.pivotY - linePadding
    && point.y <= bounds.pivotY + linePadding
  ) return true;

  if (
    point.x >= bounds.pivotX - linePadding
    && point.x <= bounds.pivotX + linePadding
    && point.y >= bounds.pivotY - axis - linePadding
    && point.y <= bounds.pivotY + linePadding
  ) return true;

  if (
    Math.abs(point.x - bounds.pivotX) <= handleRadius
    && Math.abs(point.y - bounds.pivotY) <= handleRadius
  ) return true;

  return false;
}
