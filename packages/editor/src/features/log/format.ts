// Pure formatters: turn world/physics debug events into log entries. The dedupe
// + cap logic lives in the reducer's "push-log" case; these just produce the text.

import type { Entity, WorldDebugEvent } from "@engine/ecs-core";
import type { PhysicsDebugEvent } from "@engine/physics";
import type { DebuggerWorld, LogEntry } from "../../shared/types";

export function formatWorldEvent<TWorld extends DebuggerWorld>(
  world: TWorld,
  event: WorldDebugEvent,
  getEntityTitle?: (world: TWorld, entity: Entity) => string,
): Omit<LogEntry, "count"> | null {
  switch (event.type) {
    case "entity:spawn":
      return { cat: "entity", text: `frame ${event.frame} spawn ${entityLabel(world, event.entity, getEntityTitle)}` };
    case "entity:destroy":
      return { cat: "entity", text: `frame ${event.frame} destroy ${entityLabel(world, event.entity, getEntityTitle)}` };
    case "tag:add":
      return { cat: "tag", text: `frame ${event.frame} tag+ ${entityLabel(world, event.entity, getEntityTitle)} ${event.tag}` };
    case "tag:remove":
      return { cat: "tag", text: `frame ${event.frame} tag- ${entityLabel(world, event.entity, getEntityTitle)} ${event.tag}` };
    case "system:add":
      return { cat: "system", text: `frame ${event.frame} system ${event.index} ${event.label}` };
    default:
      return null;
  }
}

export function formatPhysicsEvent<TWorld extends DebuggerWorld>(
  world: TWorld,
  event: PhysicsDebugEvent,
  getEntityTitle?: (world: TWorld, entity: Entity) => string,
): Omit<LogEntry, "count"> {
  switch (event.type) {
    case "body:set":
      return { cat: "physics", text: `body set ${entityLabel(world, event.entity, getEntityTitle)} ${event.kind} ${event.width}x${event.height} @ ${event.x},${event.y}` };
    case "body:reset":
      return { cat: "physics", text: `body reset ${entityLabel(world, event.entity, getEntityTitle)} @ ${event.x},${event.y}` };
    case "body:angle":
      return { cat: "physics", text: `body angle ${entityLabel(world, event.entity, getEntityTitle)} ${event.angle.toFixed(2)}` };
    case "body:velocity":
      return { cat: "physics", text: `velocity ${entityLabel(world, event.entity, getEntityTitle)} ${event.velocity.x.toFixed(2)},${event.velocity.y.toFixed(2)}` };
    case "collision:start":
      return { cat: "collision", text: `collision start ${entityLabel(world, event.entities[0], getEntityTitle)} <-> ${entityLabel(world, event.entities[1], getEntityTitle)}` };
    case "collision:end":
      return { cat: "collision", text: `collision end ${entityLabel(world, event.entities[0], getEntityTitle)} <-> ${entityLabel(world, event.entities[1], getEntityTitle)}` };
  }
}

export function entityTitle<TWorld extends DebuggerWorld>(world: TWorld, entity: Entity) {
  const firstTag = world.tags.list(entity)[0] ?? "entity";
  return `${firstTag}_${entity}`;
}

export function entityLabel<TWorld extends DebuggerWorld>(
  world: TWorld,
  entity: Entity,
  getEntityTitle?: (world: TWorld, entity: Entity) => string,
) {
  return getEntityTitle?.(world, entity) ?? entityTitle(world, entity);
}

// Serialize a value stably (sorted keys / set members) for change detection.
export function stableSerialize(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value;
  if (value instanceof Set) return JSON.stringify(Array.from(value).sort());
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => stableNormalize(item)));
  return JSON.stringify(stableNormalize(value));
}

function stableNormalize(value: unknown): unknown {
  if (value instanceof Set) return Array.from(value).sort();
  if (Array.isArray(value)) return value.map((item) => stableNormalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableNormalize(item)]),
    );
  }
  return value;
}
