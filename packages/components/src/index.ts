import { createStore } from "@engine/ecs-core";

// Premade, engine-provided components shared across renderer, physics, and the
// runtime. Anything with an x/y pair — position, scale, velocity — uses the one
// Vector type so components compose cleanly and vector math is reusable.

export type Vector = { x: number; y: number };

export const vec = (x = 0, y = 0): Vector => ({ x, y });
export const cloneVector = (v: Vector): Vector => ({ x: v.x, y: v.y });

// Spatial transform. `position` is the entity's CENTER (world px), `rotation` is
// radians, and `size` is the entity's size in world px — NOT a multiplier. A `size`
// axis of 0 means "auto" (render at the sprite's native texture size); a negative
// size.x mirrors horizontally. The renderer derives the pixi draw-scale from
// size / textureSize.
export type Transform = { position: Vector; rotation: number; size: Vector };

export const transform = (init?: Partial<Transform>): Transform => ({
  position: init?.position ? cloneVector(init.position) : vec(),
  rotation: init?.rotation ?? 0,
  size: init?.size ? cloneVector(init.size) : vec(0, 0),
});

export const transforms = createStore<Transform>();
