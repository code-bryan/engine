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
  | { kind: "scale"; entity: Entity; handle: "nw" | "ne" | "se" | "sw"; bounds: EditorBounds }
  | { kind: "rotate"; entity: Entity; bounds: EditorBounds };

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

  const handleRadius = 6 / Math.max(zoom, 0.1);
  const outlineWidth = 1.5 / Math.max(zoom, 0.1);

  renderSelectionOutline(world, overlay, selectedEntity, zoom);

  if (toolMode === "move") {
    const axis = Math.max(bounds.width, bounds.height) * 0.5 + 24 / Math.max(zoom, 0.1);
    const head = 7 / Math.max(zoom, 0.1);
    overlay.moveTo(bounds.pivotX, bounds.pivotY).lineTo(bounds.pivotX + axis, bounds.pivotY).stroke({
      color: 0xef4444,
      width: outlineWidth,
      alpha: 0.95,
    });
    overlay.moveTo(bounds.pivotX + axis, bounds.pivotY)
      .lineTo(bounds.pivotX + axis - head, bounds.pivotY - head * 0.65)
      .stroke({ color: 0xef4444, width: outlineWidth, alpha: 0.95 });
    overlay.moveTo(bounds.pivotX + axis, bounds.pivotY)
      .lineTo(bounds.pivotX + axis - head, bounds.pivotY + head * 0.65)
      .stroke({ color: 0xef4444, width: outlineWidth, alpha: 0.95 });

    overlay.moveTo(bounds.pivotX, bounds.pivotY).lineTo(bounds.pivotX, bounds.pivotY - axis).stroke({
      color: 0x22c55e,
      width: outlineWidth,
      alpha: 0.95,
    });
    overlay.moveTo(bounds.pivotX, bounds.pivotY - axis)
      .lineTo(bounds.pivotX - head * 0.65, bounds.pivotY - axis + head)
      .stroke({ color: 0x22c55e, width: outlineWidth, alpha: 0.95 });
    overlay.moveTo(bounds.pivotX, bounds.pivotY - axis)
      .lineTo(bounds.pivotX + head * 0.65, bounds.pivotY - axis + head)
      .stroke({ color: 0x22c55e, width: outlineWidth, alpha: 0.95 });

    overlay.rect(
      bounds.pivotX - handleRadius,
      bounds.pivotY - handleRadius,
      handleRadius * 2,
      handleRadius * 2,
    ).fill({ color: 0x60a5fa, alpha: 0.95 });
    return;
  }

  if (toolMode === "scale") {
    for (const corner of getScaleHandlePoints(bounds)) {
      overlay.rect(corner.x - handleRadius, corner.y - handleRadius, handleRadius * 2, handleRadius * 2).fill({
        color: 0x38bdf8,
        alpha: 0.95,
      });
    }
    return;
  }

  const rotateRadius = Math.max(bounds.width, bounds.height) * 0.5 + 18 / Math.max(zoom, 0.1);
  const handleY = bounds.y - 22 / Math.max(zoom, 0.1);
  overlay.circle(bounds.pivotX, bounds.pivotY, rotateRadius).stroke({
    color: 0xf59e0b,
    width: outlineWidth,
    alpha: 0.9,
  });
  overlay.moveTo(bounds.pivotX, bounds.y).lineTo(bounds.pivotX, handleY).stroke({
    color: 0xf59e0b,
    width: outlineWidth,
    alpha: 0.9,
  });
  overlay.circle(bounds.pivotX, handleY, handleRadius).fill({ color: 0xf59e0b, alpha: 0.95 });
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
    for (const corner of getScaleHandlePoints(bounds)) {
      if (Math.abs(point.x - corner.x) <= handleRadius && Math.abs(point.y - corner.y) <= handleRadius) {
        return { kind: "scale", entity, handle: corner.handle, bounds };
      }
    }
    return null;
  }

  const rotateRadius = Math.max(bounds.width, bounds.height) * 0.5 + 18 / Math.max(zoom, 0.1);
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

function getScaleHandlePoints(bounds: EditorBounds) {
  return [
    { handle: "nw" as const, x: bounds.x, y: bounds.y },
    { handle: "ne" as const, x: bounds.x + bounds.width, y: bounds.y },
    { handle: "se" as const, x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { handle: "sw" as const, x: bounds.x, y: bounds.y + bounds.height },
  ];
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
