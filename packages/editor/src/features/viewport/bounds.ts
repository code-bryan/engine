// Editor-space bounds of an entity, derived from its sprite, physics body, or a
// small fallback box. Pure geometry over the renderer's data stores — no Pixi.

import type { Entity } from "@engine/ecs-core";
import { sprites, transforms, type TransformScale } from "@engine/renderer";
import type { DebuggerWorld } from "../../shared/types";

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

export function toBounds(
  entity: Entity,
  x: number,
  y: number,
  width: number,
  height: number,
  pivotX: number,
  pivotY: number,
): EditorBounds {
  return { entity, x, y, width, height, centerX: x + width / 2, centerY: y + height / 2, pivotX, pivotY };
}

export function normalizeScale(scale?: TransformScale) {
  if (scale === undefined) return { x: 1, y: 1 };
  return typeof scale === "number" ? { x: scale, y: scale } : scale;
}
