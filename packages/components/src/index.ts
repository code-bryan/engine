import { createStore } from "@engine/ecs-core";

// Premade, engine-provided components shared across renderer, physics, and the
// runtime. Anything with an x/y pair — position, scale, velocity — uses the one
// Vector type so components compose cleanly and vector math is reusable.

export type Vector = { x: number; y: number };

export const vec = (x = 0, y = 0): Vector => ({ x, y });
export const cloneVector = (v: Vector): Vector => ({ x: v.x, y: v.y });

// Spatial transform. Position, rotation (radians), and scale are always present
// and fully-formed — no optional fields, no number|vector union. Callers reading
// a Transform never normalize; defaults are applied once here at construction.
export type Transform = { position: Vector; rotation: number; scale: Vector };

export const transform = (init?: Partial<Transform>): Transform => ({
  position: init?.position ? cloneVector(init.position) : vec(),
  rotation: init?.rotation ?? 0,
  scale: init?.scale ? cloneVector(init.scale) : vec(1, 1),
});

export const transforms = createStore<Transform>();
