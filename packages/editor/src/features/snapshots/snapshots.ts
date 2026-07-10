import { getComponentRegistry, type ComponentRegistryEntry, type Entity } from "@engine/ecs-core";
import { sprites, transforms } from "@engine/renderer";
import type { DebuggerWorld, DebugWorldSnapshot, EntitySnapshot, WorldSnapshot } from "../../shared/types";

function captureSnapshot<TWorld extends DebuggerWorld>(
  world: TWorld,
  registry: readonly ComponentRegistryEntry[],
): WorldSnapshot {
  const entities = new Map<Entity, EntitySnapshot>();

  for (const entity of world.entities) {
    const components = new Map<string, unknown>();
    for (const entry of registry) {
      const value = entry.store.get(entity);
      if (value !== undefined) components.set(entry.id, structuredClone(value));
    }

    const rigidBody = world.physics.rigidBodies.get(entity);
    // Store the body CENTER (= transform.position); physics.reset expects a center.
    const physics = rigidBody
      ? {
        x: rigidBody.body.position.x,
        y: rigidBody.body.position.y,
        vx: rigidBody.body.velocity.x,
        vy: rigidBody.body.velocity.y,
      }
      : undefined;

    const transform = transforms.get(entity);
    const flipX = sprites.get(entity)?.flipX;

    entities.set(entity, transform
      ? {
          components,
          physics,
          flipX,
          transform: {
            position: { x: transform.position.x, y: transform.position.y },
            rotation: transform.rotation,
            size: { x: transform.size.x, y: transform.size.y },
          },
        }
      : { components, physics, flipX });
  }

  return { frame: world.getFrame(), entities };
}

export function captureWorldSnapshot<TWorld extends DebuggerWorld>(world: TWorld): DebugWorldSnapshot {
  return captureSnapshot(world, getComponentRegistry());
}

function restoreSnapshot<TWorld extends DebuggerWorld>(
  world: TWorld,
  snapshot: WorldSnapshot,
  registry: readonly ComponentRegistryEntry[],
) {
  for (const [entity, data] of snapshot.entities) {
    if (!world.entities.has(entity)) continue;

    for (const entry of registry) {
      const value = data.components.get(entry.id);
      if (value !== undefined) entry.store.set(entity, structuredClone(value));
      else entry.store.delete(entity);
    }

    if (data.physics) {
      world.physics.reset(entity, { x: data.physics.x, y: data.physics.y }, { x: data.physics.vx, y: data.physics.vy });
    }

    if (data.transform) {
      const transform = transforms.get(entity);
      if (transform) {
        transform.position.x = data.transform.position.x;
        transform.position.y = data.transform.position.y;
        transform.rotation = data.transform.rotation;
        transform.size.x = data.transform.size.x;
        transform.size.y = data.transform.size.y;
      }
    }

    if (data.flipX !== undefined) {
      const spriteRef = sprites.get(entity);
      if (spriteRef) spriteRef.flipX = data.flipX;
    }
  }
}

export function restoreWorldSnapshot<TWorld extends DebuggerWorld>(
  world: TWorld,
  snapshot: DebugWorldSnapshot,
) {
  restoreSnapshot(world, snapshot, getComponentRegistry());
}

export function captureRegistrySnapshot<TWorld extends DebuggerWorld>(
  world: TWorld,
  registry: readonly ComponentRegistryEntry[],
) {
  return captureSnapshot(world, registry);
}

export function restoreRegistrySnapshot<TWorld extends DebuggerWorld>(
  world: TWorld,
  snapshot: WorldSnapshot,
  registry: readonly ComponentRegistryEntry[],
) {
  restoreSnapshot(world, snapshot, registry);
}
