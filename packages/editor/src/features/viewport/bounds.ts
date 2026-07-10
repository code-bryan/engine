// Editor-space selection bounds of an entity. The box SIZE reflects the entity's
// real content — its sprite extent (texture × scale), else its physics collider,
// else zero for a transform-only "empty" (drawn as a constant-screen marker by the
// gizmo). The box is always CENTERED on transform.position so two entities at the
// same position produce boxes with the same center. Pure geometry — no Pixi.

import type { Entity } from "@engine/ecs-core";
import { sprites, transforms } from "@engine/renderer";
import type { DebuggerWorld } from "../../shared/types";

// Minimum content-box size (world px) so a tiny sprite/collider stays grabbable.
const MIN = 12;

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
  const transform = transforms.get(entity);
  if (!transform) return undefined;

  const pivotX = transform.position.x;
  const pivotY = transform.position.y;

  // Box is the entity's size (world px), centered on its position. When a size axis
  // is 0 ("auto"), fall back to the content extent: sprite texture, else collider,
  // else 0 (empty → gizmo draws a constant-screen marker).
  let width = Math.abs(transform.size.x);
  let height = Math.abs(transform.size.y);
  if (width === 0 || height === 0) {
    const spriteRef = sprites.get(entity);
    const body = spriteRef ? undefined : world.physics.getDebugBody(entity);
    if (width === 0) {
      width = spriteRef ? spriteRef.sprite.texture.width : body ? body.width : 0;
    }
    if (height === 0) {
      height = spriteRef ? spriteRef.sprite.texture.height : body ? body.height : 0;
    }
  }
  if (width > 0) width = Math.max(MIN, width);
  if (height > 0) height = Math.max(MIN, height);

  return toBounds(entity, pivotX - width / 2, pivotY - height / 2, width, height, pivotX, pivotY);
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

