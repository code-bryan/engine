import type { Entity } from "@engine/ecs-core";
import { sprites, transforms, type TransformScale } from "@engine/renderer";
import { Graphics } from "pixi.js";
import type { DebuggerWorld, EditorToolMode } from "../shared/types";

export type EditorBounds = {
  entity: Entity;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  pivotX: number;
  pivotY: number;
};

export type GizmoHit =
  | { kind: "move"; entity: Entity }
  | { kind: "scale"; entity: Entity; handle: "x" | "y" | "uniform"; bounds: EditorBounds }
  | { kind: "rotate"; entity: Entity; bounds: EditorBounds };

const GIZMO_RED = 0xf87171;
const GIZMO_GREEN = 0x4ade80;
const GIZMO_BLUE = 0x60a5fa;
const GIZMO_YELLOW = 0xfacc15;

function gizmoAxisLength(_bounds: EditorBounds, z: number) {
  return 90 / z;
}

function gizmoRotateRadius(_bounds: EditorBounds, z: number) {
  return 70 / z;
}

export function renderSelectionOutline<TWorld extends DebuggerWorld>(
  world: TWorld,
  overlay: Graphics,
  selectedEntity: Entity | undefined,
  zoom: number,
) {
  if (selectedEntity === undefined) return;
  const bounds = getEntityEditorBounds(world, selectedEntity);
  if (!bounds) return;

  const outlineWidth = 1.5 / Math.max(zoom, 0.1);
  const pivotRadius = 4 / Math.max(zoom, 0.1);

  overlay.rect(bounds.x, bounds.y, bounds.width, bounds.height).stroke({
    color: 0x60a5fa,
    width: outlineWidth,
    alpha: 0.95,
  });
  overlay.circle(bounds.pivotX, bounds.pivotY, pivotRadius).fill({
    color: 0x60a5fa,
    alpha: 0.95,
  });
}

export function renderEditorGizmo<TWorld extends DebuggerWorld>(
  world: TWorld,
  overlay: Graphics,
  selectedEntity: Entity | undefined,
  toolMode: EditorToolMode,
  zoom: number,
) {
  if (selectedEntity === undefined) return;
  const bounds = getEntityEditorBounds(world, selectedEntity);
  if (!bounds) return;

  const z = Math.max(zoom, 0.1);
  const handleRadius = 6 / z;
  const outlineWidth = 3 / z;
  const px = bounds.pivotX;
  const py = bounds.pivotY;

  renderSelectionOutline(world, overlay, selectedEntity, zoom);

  if (toolMode === "move") {
    const axis = gizmoAxisLength(bounds, z);
    const head = 8 / z;
    const boxHalf = 5 / z;

    // X axis (right, red) + filled arrowhead
    overlay.moveTo(px, py).lineTo(px + axis, py).stroke({ color: GIZMO_RED, width: outlineWidth, alpha: 0.95 });
    overlay.poly([px + axis, py, px + axis - head, py - head * 0.6, px + axis - head, py + head * 0.6]).fill({ color: GIZMO_RED, alpha: 0.95 });

    // Y axis (up, green) + filled arrowhead
    overlay.moveTo(px, py).lineTo(px, py - axis).stroke({ color: GIZMO_GREEN, width: outlineWidth, alpha: 0.95 });
    overlay.poly([px, py - axis, px - head * 0.6, py - axis + head, px + head * 0.6, py - axis + head]).fill({ color: GIZMO_GREEN, alpha: 0.95 });

    // XY plane right-angle highlight (green, up-right of pivot)
    const off = 8 / z;
    const leg = 9 / z;
    overlay.moveTo(px + off, py - off - leg).lineTo(px + off, py - off).lineTo(px + off + leg, py - off)
      .stroke({ color: GIZMO_GREEN, width: outlineWidth * 0.9, alpha: 0.5 });

    // center box (white)
    overlay.rect(px - boxHalf, py - boxHalf, boxHalf * 2, boxHalf * 2)
      .fill({ color: 0xffffff, alpha: 0.95 })
      .stroke({ color: 0x000000, width: outlineWidth * 0.8, alpha: 0.5 });
    return;
  }

  if (toolMode === "scale") {
    const axis = gizmoAxisLength(bounds, z);
    const tip = 6 / z;
    const boxHalf = 6 / z;

    // X axis (right, red) + square tip
    overlay.moveTo(px, py).lineTo(px + axis, py).stroke({ color: GIZMO_RED, width: outlineWidth, alpha: 0.95 });
    overlay.rect(px + axis - tip, py - tip, tip * 2, tip * 2).fill({ color: GIZMO_RED, alpha: 0.95 });

    // Y axis (up, green) + square tip
    overlay.moveTo(px, py).lineTo(px, py - axis).stroke({ color: GIZMO_GREEN, width: outlineWidth, alpha: 0.95 });
    overlay.rect(px - tip, py - axis - tip, tip * 2, tip * 2).fill({ color: GIZMO_GREEN, alpha: 0.95 });

    // uniform-scale right-angle highlight (yellow)
    const off = 8 / z;
    const leg = 9 / z;
    overlay.moveTo(px + off, py - off - leg).lineTo(px + off, py - off).lineTo(px + off + leg, py - off)
      .stroke({ color: GIZMO_YELLOW, width: outlineWidth * 0.9, alpha: 0.5 });

    // center box (uniform, yellow)
    overlay.rect(px - boxHalf, py - boxHalf, boxHalf * 2, boxHalf * 2)
      .fill({ color: GIZMO_YELLOW, alpha: 0.95 })
      .stroke({ color: 0x000000, width: outlineWidth * 0.8, alpha: 0.5 });
    return;
  }

  // rotate: blue ring + white handle that orbits with the entity's rotation
  const rotateRadius = gizmoRotateRadius(bounds, z);
  const rotation = transforms.get(selectedEntity)?.rotation ?? 0;
  const handleAngle = -Math.PI / 2 + rotation;
  const hx = px + Math.cos(handleAngle) * rotateRadius;
  const hy = py + Math.sin(handleAngle) * rotateRadius;
  overlay.circle(px, py, rotateRadius).stroke({ color: GIZMO_BLUE, width: 4 / z, alpha: 0.9 });
  // spoke from center to handle so the current angle reads clearly
  overlay.moveTo(px, py).lineTo(hx, hy).stroke({ color: GIZMO_BLUE, width: outlineWidth, alpha: 0.5 });
  overlay.circle(hx, hy, handleRadius)
    .fill({ color: 0xffffff, alpha: 0.95 })
    .stroke({ color: GIZMO_BLUE, width: outlineWidth, alpha: 0.95 });
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

export function getEntityEditorBounds<TWorld extends DebuggerWorld>(
  world: TWorld,
  entity: Entity,
): EditorBounds | undefined {
  const spriteRef = sprites.get(entity);
  const transform = transforms.get(entity);
  if (spriteRef && transform) {
    const { sprite, offset, anchor } = spriteRef;
    const scale = normalizeScale(transform.scale);
    const width = Math.max(12, sprite.texture.width * Math.abs(scale.x));
    const height = Math.max(12, sprite.texture.height * Math.abs(scale.y));
    const pivotX = transform.x + offset.x;
    const pivotY = transform.y + offset.y;
    const x = pivotX - anchor.x * width;
    const y = pivotY - anchor.y * height;
    return toBounds(entity, x, y, width, height, pivotX, pivotY);
  }

  const body = world.physics.getDebugBody(entity);
  if (body) return toBounds(entity, body.x, body.y, body.width, body.height, body.x + body.width / 2, body.y + body.height / 2);

  if (!transform) return undefined;
  return toBounds(entity, transform.x - 8, transform.y - 8, 16, 16, transform.x, transform.y);
}

function toBounds(entity: Entity, x: number, y: number, width: number, height: number, pivotX: number, pivotY: number): EditorBounds {
  return {
    entity,
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
    pivotX,
    pivotY,
  };
}

function normalizeScale(scale?: TransformScale) {
  if (scale === undefined) return { x: 1, y: 1 };
  return typeof scale === "number" ? { x: scale, y: scale } : scale;
}

function pointInBounds(point: { x: number; y: number }, bounds: EditorBounds) {
  return point.x >= bounds.x
    && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y <= bounds.y + bounds.height;
}

function inflateBounds(bounds: EditorBounds, amount: number): EditorBounds {
  return toBounds(
    bounds.entity,
    bounds.x - amount,
    bounds.y - amount,
    bounds.width + amount * 2,
    bounds.height + amount * 2,
    bounds.pivotX,
    bounds.pivotY,
  );
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
