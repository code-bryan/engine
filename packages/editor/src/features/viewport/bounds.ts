// Editor-space bounds of an entity, derived from its sprite, physics body, or a
// small fallback box. Pure geometry over the renderer's data stores — no Pixi.

import type { Entity } from "@engine/ecs-core";
import { sprites, transforms, type Vector } from "@engine/renderer";
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
    const scale = transform.scale;
    const width = Math.max(12, sprite.texture.width * Math.abs(scale.x));
    const height = Math.max(12, sprite.texture.height * Math.abs(scale.y));
    const pivotX = transform.position.x + offset.x;
    const pivotY = transform.position.y + offset.y;
    const x = pivotX - anchor.x * width;
    const y = pivotY - anchor.y * height;
    return toBounds(entity, x, y, width, height, pivotX, pivotY);
  }

  const body = world.physics.getDebugBody(entity);
  if (body) return toBounds(entity, body.x, body.y, body.width, body.height, body.x + body.width / 2, body.y + body.height / 2);

  if (!transform) return undefined;
  const { x, y } = transform.position;
  return toBounds(entity, x - 8, y - 8, 16, 16, x, y);
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

// Scale is always a fully-formed Vector now; kept as a thin clone helper so the
// few call sites that defensively normalized keep working.
export function normalizeScale(scale?: Vector): Vector {
  return scale ? { x: scale.x, y: scale.y } : { x: 1, y: 1 };
}
