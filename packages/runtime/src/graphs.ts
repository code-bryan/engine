import { type Entity } from "@engine/ecs-core";
import { keyboard } from "@engine/input";
import { sprite, transforms } from "@engine/renderer";
import type { DemoGameWorld } from "./types";
import { getComponentStore } from "./components";

export type GraphDefinition = {
  version: 1;
  name: string;
  entrypoint: string;
  nodes: GraphNodeDefinition[];
  edges: GraphEdgeDefinition[];
  metadata?: Record<string, unknown> & { order?: number };
};

export type GraphNodeDefinition = {
  id: string;
  type: GraphNodeType;
  position: { x: number; y: number };
  data?: Record<string, unknown>;
};

export type GraphEdgeDefinition = {
  from: { node: string; port: string };
  to: { node: string; port: string };
};

export type GraphNodeType =
  | "OnUpdate"
  | "ForEachTag"
  | "ForEachComponent"
  | "FindFirstTag"
  | "ReadInputAxes"
  | "ReadComponent"
  | "ReadTransform"
  | "BuildVelocity"
  | "BuildDirectionToTarget"
  | "MultiplyVector"
  | "SelectStateFromVelocity"
  | "SelectFacingFromVelocity"
  | "SetComponent"
  | "SetAnimationState"
  | "SetTransformScaleFromFacing"
  | "SetPhysicsVelocity"
  | "CollisionWithTag"
  | "ResetTaggedEntities";

type GraphContext = {
  entity?: Entity;
  values: Record<string, unknown>;
  dt: number;
};

const graphCache = new Map<string, Promise<GraphDefinition | null>>();

export async function loadGraphDefinition(name: string): Promise<GraphDefinition | null> {
  const cached = graphCache.get(name);
  if (cached) return cached;

  const pending = fetch(`/api/content/file?path=${encodeURIComponent(`systems/${name}`)}`)
    .then(async (res) => {
      if (!res.ok) return null;
      const raw = await res.json();
      return parseGraphDefinition(raw);
    })
    .catch(() => null);

  graphCache.set(name, pending);
  return pending;
}

export async function createGraphSystem(world: DemoGameWorld, graphOrName: string | GraphDefinition) {
  const graph = typeof graphOrName === "string" ? await loadGraphDefinition(graphOrName) : graphOrName;
  if (!graph) throw new Error(`graph not found: ${graphOrName}`);

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const nextById = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const next = nextById.get(edge.from.node) ?? [];
    next.push(edge.to.node);
    nextById.set(edge.from.node, next);
  }

  const root = nodesById.get(graph.entrypoint) ?? graph.nodes.find((node) => node.type === "OnUpdate");
  if (!root) throw new Error(`graph entrypoint not found: ${graph.name}`);

  return (dt: number) => {
    runNodeChain(world, nodesById, nextById, root.id, {
      dt,
      values: {},
    });
  };
}

function runNodeChain(
  world: DemoGameWorld,
  nodesById: Map<string, GraphNodeDefinition>,
  nextById: Map<string, string[]>,
  nodeId: string,
  context: GraphContext,
) {
  const node = nodesById.get(nodeId);
  if (!node) return;

  const contexts = executeNode(world, node, context);
  const nextNodes = nextById.get(nodeId) ?? [];
  if (nextNodes.length === 0) return;

  for (const nextNodeId of nextNodes) {
    for (const nextContext of contexts) {
      runNodeChain(world, nodesById, nextById, nextNodeId, nextContext);
    }
  }
}

function executeNode(world: DemoGameWorld, node: GraphNodeDefinition, context: GraphContext): GraphContext[] {
  switch (node.type) {
    case "OnUpdate":
      return [context];
    case "ForEachTag": {
      const tag = String(node.data?.tag ?? "");
      if (!tag) return [];
      return Array.from(world.tags.with(tag)).map((entity) => ({
        ...context,
        entity,
        values: { ...context.values },
      }));
    }
    case "ForEachComponent": {
      const componentId = String(node.data?.component ?? "");
      if (!componentId) return [];
      const store = getComponentStore<unknown>(componentId);
      return Array.from(store.keys()).map((entity) => ({
        ...context,
        entity,
        values: { ...context.values },
      }));
    }
    case "FindFirstTag": {
      const tag = String(node.data?.tag ?? "");
      if (!tag) return [];
      const entity = world.tags.with(tag).values().next().value as Entity | undefined;
      if (entity === undefined) return [];
      return [{
        ...context,
        values: {
          ...context.values,
          [String(node.data?.as ?? "entity")]: entity,
        },
      }];
    }
    case "ReadInputAxes": {
      const axes = readAxes(node.data);
      return [{
        ...context,
        values: {
          ...context.values,
          [String(node.data?.as ?? "axes")]: axes,
        },
      }];
    }
    case "ReadComponent": {
      const entity = resolveEntityRef(context, node.data?.entityFrom, context.entity);
      if (entity === undefined) return [];
      const componentId = String(node.data?.component ?? "");
      if (!componentId) return [];
      const store = getComponentStore<Record<string, unknown>>(componentId);
      const value = store.get(entity);
      const field = typeof node.data?.field === "string" ? node.data.field : undefined;
      const resolved = field && value && typeof value === "object" ? (value as Record<string, unknown>)[field] : value;
      return [{
        ...context,
        values: {
          ...context.values,
          [String(node.data?.as ?? componentId)]: cloneValue(resolved),
        },
      }];
    }
    case "ReadTransform": {
      const entity = resolveEntityRef(context, node.data?.entityFrom, context.entity);
      if (entity === undefined) return [];
      const transform = transforms.get(entity);
      if (!transform) return [];
      return [{
        ...context,
        values: {
          ...context.values,
          [String(node.data?.as ?? "transform")]: cloneValue({
            x: transform.x,
            y: transform.y,
            rotation: transform.rotation ?? 0,
            scale: transform.scale ?? 1,
          }),
        },
      }];
    }
    case "BuildVelocity": {
      const axes = context.values[String(node.data?.axesFrom ?? "axes")] as { x: number; y: number } | undefined;
      const speed = context.values[String(node.data?.speedFrom ?? "speed")] as number | undefined;
      if (!axes || typeof speed !== "number") return [];
      const velocity = { x: axes.x * speed, y: axes.y * speed };
      return [{
        ...context,
        values: {
          ...context.values,
          [String(node.data?.as ?? "velocity")]: velocity,
        },
      }];
    }
    case "BuildDirectionToTarget": {
      const target = context.values[String(node.data?.targetFrom ?? "target")] as { x?: number; y?: number } | undefined;
      if (!target || context.entity === undefined) return [];
      const sourceTransform = transforms.get(context.entity);
      if (!sourceTransform || typeof target.x !== "number" || typeof target.y !== "number") return [];
      const dx = target.x - sourceTransform.x;
      const dy = target.y - sourceTransform.y;
      const distance = Math.hypot(dx, dy);
      const direction = distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 };
      return [{
        ...context,
        values: {
          ...context.values,
          [String(node.data?.as ?? "direction")]: direction,
          [String(node.data?.distanceAs ?? "distance")]: distance,
        },
      }];
    }
    case "MultiplyVector": {
      const vector = context.values[String(node.data?.vectorFrom ?? "direction")] as { x: number; y: number } | undefined;
      const scalar = context.values[String(node.data?.scalarFrom ?? "speed")] as number | undefined;
      if (!vector || typeof scalar !== "number") return [];
      return [{
        ...context,
        values: {
          ...context.values,
          [String(node.data?.as ?? "velocity")]: { x: vector.x * scalar, y: vector.y * scalar },
        },
      }];
    }
    case "SelectStateFromVelocity": {
      const velocity = context.values[String(node.data?.from ?? "velocity")] as { x?: number; y?: number } | undefined;
      if (!velocity || typeof velocity.x !== "number" || typeof velocity.y !== "number") return [];
      const nextState = velocity.x === 0 && velocity.y === 0 ? String(node.data?.idle ?? "idle") : String(node.data?.moving ?? "walk");
      return [{
        ...context,
        values: {
          ...context.values,
          [String(node.data?.as ?? "state")]: nextState,
        },
      }];
    }
    case "SelectFacingFromVelocity": {
      const velocity = context.values[String(node.data?.from ?? "velocity")] as { x?: number } | undefined;
      if (!velocity || typeof velocity.x !== "number" || velocity.x === 0) return [];
      const facing = velocity.x < 0 ? String(node.data?.left ?? "left") : String(node.data?.right ?? "right");
      return [{
        ...context,
        values: {
          ...context.values,
          [String(node.data?.as ?? "facing")]: facing,
        },
      }];
    }
    case "SetComponent": {
      if (context.entity === undefined) return [];
      const componentId = String(node.data?.component ?? "");
      if (!componentId) return [];
      const value = context.values[String(node.data?.from ?? componentId)];
      if (value === undefined) return [context];
      const store = getComponentStore<unknown>(componentId);
        store.set(context.entity, cloneValue(value));
      return [context];
    }
    case "SetAnimationState": {
      if (context.entity === undefined) return [];
      const nextState = context.values[String(node.data?.from ?? "state")];
      if (typeof nextState !== "string") return [context];
      sprite.animation.state.set(context.entity, nextState);
      return [context];
    }
    case "SetTransformScaleFromFacing": {
      if (context.entity === undefined) return [];
      const facing = context.values[String(node.data?.facingFrom ?? "facing")];
      if (typeof facing !== "string") return [context];
      const transform = transforms.get(context.entity);
      if (!transform) return [context];
      const baseScale = getBaseScale(transform.scale);
      transform.scale = {
        x: facing === String(node.data?.left ?? "left") ? -baseScale : baseScale,
        y: baseScale,
      };
      return [context];
    }
    case "SetPhysicsVelocity": {
      if (context.entity === undefined) return [];
      const value = context.values[String(node.data?.from ?? "velocity")] as { x?: number; y?: number } | undefined;
      if (!value || typeof value.x !== "number" || typeof value.y !== "number") return [context];
      world.physics.setVelocity(context.entity, { x: value.x, y: value.y });
      return [context];
    }
    case "CollisionWithTag": {
      if (context.entity === undefined) return [];
      const tag = String(node.data?.tag ?? "");
      if (!tag) return [];
      if (!world.physics.collider(world, context.entity).collide(tag)) return [];
      return [context];
    }
    case "ResetTaggedEntities": {
      const tags = normalizeStringArray(node.data?.tags, []);
      for (const tag of tags) {
        for (const entity of world.tags.with(tag)) {
          const componentId = tag;
          const store = getComponentStore<{ spawnX: number; spawnY: number; speed?: number }>(componentId);
          const component = store.get(entity);
          if (!component) continue;
          const transform = transforms.get(entity);
          const velocity = getComponentStore<{ x: number; y: number }>("velocity").get(entity);
          if (transform) {
            transform.x = component.spawnX;
            transform.y = component.spawnY;
          }
          if (velocity) {
            velocity.x = 0;
            velocity.y = 0;
          }
          world.physics.reset(entity, { x: component.spawnX, y: component.spawnY });
        }
      }
      return [context];
    }
    default:
      return [context];
  }
}

function readAxes(data: Record<string, unknown> | undefined) {
  const keys = keyboard.get(0)?.keys;
  if (!keys) return { x: 0, y: 0 };

  const positiveX = normalizeKeys(data?.positiveX, ["ArrowRight", "KeyD"]);
  const negativeX = normalizeKeys(data?.negativeX, ["ArrowLeft", "KeyA"]);
  const positiveY = normalizeKeys(data?.positiveY, ["ArrowDown", "KeyS"]);
  const negativeY = normalizeKeys(data?.negativeY, ["ArrowUp", "KeyW"]);

  return {
    x: Number(positiveX.some((key) => keys.has(key))) - Number(negativeX.some((key) => keys.has(key))),
    y: Number(positiveY.some((key) => keys.has(key))) - Number(negativeY.some((key) => keys.has(key))),
  };
}

function normalizeKeys(value: unknown, fallback: string[]) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : fallback;
}

function resolveEntityRef(context: GraphContext, ref: unknown, fallback?: Entity) {
  if (typeof ref === "string") {
    const value = context.values[ref];
    if (typeof value === "number") return value as Entity;
  }
  return fallback;
}

function getBaseScale(scale: number | { x: number; y: number } = 1) {
  return typeof scale === "number" ? Math.abs(scale) : Math.abs(scale.y);
}

function parseGraphDefinition(value: unknown): GraphDefinition | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<GraphDefinition>;
  if (parsed.version !== 1 || typeof parsed.name !== "string" || typeof parsed.entrypoint !== "string" || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    return null;
  }

  return {
    version: 1,
    name: parsed.name,
    entrypoint: parsed.entrypoint,
    nodes: parsed.nodes.filter(isNodeDefinition),
    edges: parsed.edges.filter(isEdgeDefinition),
    metadata: parsed.metadata,
  };
}

function isNodeDefinition(value: unknown): value is GraphNodeDefinition {
  if (!value || typeof value !== "object") return false;
  const node = value as Partial<GraphNodeDefinition>;
  return typeof node.id === "string"
    && typeof node.type === "string"
    && typeof node.position === "object"
    && node.position !== null
    && typeof (node.position as { x?: unknown }).x === "number"
    && typeof (node.position as { y?: unknown }).y === "number";
}

function isEdgeDefinition(value: unknown): value is GraphEdgeDefinition {
  if (!value || typeof value !== "object") return false;
  const edge = value as Partial<GraphEdgeDefinition>;
  return typeof edge.from === "object"
    && edge.from !== null
    && typeof edge.to === "object"
    && edge.to !== null
    && typeof edge.from.node === "string"
    && typeof edge.from.port === "string"
    && typeof edge.to.node === "string"
    && typeof edge.to.port === "string";
}

function cloneValue<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
