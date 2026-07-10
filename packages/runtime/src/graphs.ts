import { type Entity } from "@engine/ecs-core";
import { keyboard } from "@engine/input";
import { sprite, transforms } from "@engine/renderer";
import type { DemoGameWorld } from "./types";
import { tryGetComponentStore } from "./components";

export type GraphDefinition = {
  version: 3;
  name: string;
  entrypoint: string;
  variables: GraphVariableDefinition[];
  nodes: GraphNodeDefinition[];
  edges: GraphEdgeDefinition[];
  metadata?: Record<string, unknown> & { order?: number };
};

export type GraphVariableScope = "private" | "public";

export type GraphVariableDefinition = {
  name: string;
  scope: GraphVariableScope;
  type: string;
  default: unknown;
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
  | "ReadInput"
  | "ForEachEntityWithTag"
  | "ForEachEntityWithComponent"
  | "FindFirstEntityWithTag"
  | "GetComponent"
  | "ReadTransform"
  | "GetVelocity"
  | "ReadVelocity"
  | "SetPosition"
  | "Multiply"
  | "Add"
  | "ScaleVector"
  | "ComposeVector"
  | "GetVariable"
  | "SetVariable"
  | "DirectionToTarget"
  | "If"
  | "IsMoving"
  | "ChooseStateFromVelocity"
  | "ChooseFacingFromVelocity"
  | "WriteComponent"
  | "SetSpriteState"
  | "FlipSpriteFacing"
  | "SetVelocity"
  | "CheckCollisionWithTag"
  | "ResetTaggedEntities"
  | "EmitSignal"
  | "OnSignal"
  | "ForEachTag"
  | "ForEachComponent"
  | "FindFirstTag"
  | "ReadInputAxes"
  | "BuildVelocity"
  | "SetVelocityFromAxes"
  | "SetVar"
  | "BuildDirectionToTarget"
  | "MultiplyVector"
  | "SelectStateFromVelocity"
  | "SelectFacingFromVelocity"
  | "ReadComponent"
  | "SetComponent"
  | "WriteComponent"
  | "SetAnimationState"
  | "SetTransformScaleFromFacing"
  | "SetPhysicsVelocity"
  | "CollisionWithTag";

export type GraphPortDirection = "input" | "output";
export type GraphPortKind = "flow" | "data" | "signal";

export type GraphNodePortDefinition = {
  name: string;
  kind: GraphPortKind;
  direction: GraphPortDirection;
  label?: string;
};

export type GraphNodeFieldDefinition = {
  name: string;
  label: string;
  type: "string" | "number" | "boolean" | "json";
};

export type GraphNodeSpec = {
  type: GraphNodeType;
  label: string;
  inputs: GraphNodePortDefinition[];
  outputs: GraphNodePortDefinition[];
  fields: GraphNodeFieldDefinition[];
};

export const GRAPH_NODE_LIBRARY: GraphNodeSpec[] = [
  {
    type: "OnUpdate",
    label: "On Update",
    inputs: [],
    outputs: [{ name: "flow", kind: "flow", direction: "output", label: "next" }],
    fields: [],
  },
  {
    type: "ReadInput",
    label: "Read Input",
    inputs: [{ name: "flow", kind: "flow", direction: "input" }],
    outputs: [
      { name: "x", kind: "data", direction: "output", label: "x" },
      { name: "y", kind: "data", direction: "output", label: "y" },
      { name: "vector", kind: "data", direction: "output", label: "vector" },
      { name: "flow", kind: "flow", direction: "output" },
    ],
    fields: [],
  },
  {
    type: "ForEachEntityWithTag",
    label: "For Each Entity With Tag",
    inputs: [{ name: "flow", kind: "flow", direction: "input" }],
    outputs: [
      { name: "entity", kind: "data", direction: "output", label: "entity" },
      { name: "flow", kind: "flow", direction: "output" },
    ],
    fields: [{ name: "tag", label: "Tag", type: "string" }],
  },
  {
    type: "ForEachEntityWithComponent",
    label: "For Each Entity With Component",
    inputs: [{ name: "flow", kind: "flow", direction: "input" }],
    outputs: [
      { name: "entity", kind: "data", direction: "output", label: "entity" },
      { name: "flow", kind: "flow", direction: "output" },
    ],
    fields: [{ name: "component", label: "Component", type: "string" }],
  },
  {
    type: "FindFirstEntityWithTag",
    label: "Find First Entity With Tag",
    inputs: [{ name: "flow", kind: "flow", direction: "input" }],
    outputs: [
      { name: "entity", kind: "data", direction: "output", label: "entity" },
      { name: "flow", kind: "flow", direction: "output" },
    ],
    fields: [{ name: "tag", label: "Tag", type: "string" }],
  },
  {
    type: "GetComponent",
    label: "Get Component",
    inputs: [{ name: "flow", kind: "flow", direction: "input" }],
    outputs: [
      { name: "value", kind: "data", direction: "output", label: "value" },
      { name: "flow", kind: "flow", direction: "output" },
    ],
    fields: [
      { name: "component", label: "Component", type: "string" },
      { name: "field", label: "Field", type: "string" },
    ],
  },
  {
    type: "ReadTransform",
    label: "Read Transform",
    inputs: [
      { name: "entity", kind: "data", direction: "input", label: "entity" },
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [
      { name: "transform", kind: "data", direction: "output", label: "transform" },
      { name: "flow", kind: "flow", direction: "output" },
    ],
    fields: [],
  },
  {
    type: "GetVelocity",
    label: "Get Velocity",
    inputs: [
      { name: "entity", kind: "data", direction: "input", label: "entity" },
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [
      { name: "velocity", kind: "data", direction: "output", label: "velocity" },
      { name: "flow", kind: "flow", direction: "output" },
    ],
    fields: [],
  },
  {
    type: "SetPosition",
    label: "Set Position",
    inputs: [
      { name: "position", kind: "data", direction: "input", label: "position" },
      { name: "entity", kind: "data", direction: "input", label: "entity" },
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [{ name: "flow", kind: "flow", direction: "output" }],
    fields: [],
  },
  {
    type: "Multiply",
    label: "Multiply",
    inputs: [
      { name: "value", kind: "data", direction: "input", label: "value" },
      { name: "by", kind: "data", direction: "input", label: "by" },
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [
      { name: "result", kind: "data", direction: "output", label: "result" },
      { name: "flow", kind: "flow", direction: "output" },
    ],
    fields: [],
  },
  {
    type: "Add",
    label: "Add",
    inputs: [
      { name: "left", kind: "data", direction: "input", label: "left" },
      { name: "right", kind: "data", direction: "input", label: "right" },
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [
      { name: "result", kind: "data", direction: "output", label: "result" },
      { name: "flow", kind: "flow", direction: "output" },
    ],
    fields: [],
  },
  {
    type: "ComposeVector",
    label: "Compose Vector",
    inputs: [
      { name: "x", kind: "data", direction: "input", label: "x" },
      { name: "y", kind: "data", direction: "input", label: "y" },
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [
      { name: "vector", kind: "data", direction: "output", label: "vector" },
      { name: "flow", kind: "flow", direction: "output" },
    ],
    fields: [],
  },
  {
    type: "GetVariable",
    label: "Get Variable",
    inputs: [{ name: "flow", kind: "flow", direction: "input" }],
    outputs: [
      { name: "value", kind: "data", direction: "output", label: "value" },
      { name: "flow", kind: "flow", direction: "output" },
    ],
    fields: [{ name: "variable", label: "Variable", type: "string" }],
  },
  {
    type: "SetVariable",
    label: "Set Variable",
    inputs: [
      { name: "value", kind: "data", direction: "input", label: "value" },
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [{ name: "flow", kind: "flow", direction: "output" }],
    fields: [{ name: "variable", label: "Variable", type: "string" }],
  },
  {
    type: "DirectionToTarget",
    label: "Direction To Target",
    inputs: [
      { name: "target", kind: "data", direction: "input", label: "target" },
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [
      { name: "direction", kind: "data", direction: "output", label: "direction" },
      { name: "distance", kind: "data", direction: "output", label: "distance" },
      { name: "flow", kind: "flow", direction: "output" },
    ],
    fields: [],
  },
  {
    type: "IsMoving",
    label: "Is Moving",
    inputs: [
      { name: "velocity", kind: "data", direction: "input", label: "velocity" },
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [
      { name: "condition", kind: "data", direction: "output", label: "condition" },
      { name: "flow", kind: "flow", direction: "output" },
    ],
    fields: [],
  },
  {
    type: "If",
    label: "If",
    inputs: [
      { name: "condition", kind: "data", direction: "input", label: "condition" },
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [
      { name: "then", kind: "flow", direction: "output", label: "then" },
      { name: "else", kind: "flow", direction: "output", label: "else" },
    ],
    fields: [],
  },
  {
    type: "ChooseStateFromVelocity",
    label: "Choose State From Velocity",
    inputs: [
      { name: "velocity", kind: "data", direction: "input", label: "velocity" },
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [
      { name: "state", kind: "data", direction: "output", label: "state" },
      { name: "flow", kind: "flow", direction: "output" },
    ],
    fields: [
      { name: "idle", label: "Idle", type: "string" },
      { name: "moving", label: "Moving", type: "string" },
    ],
  },
  {
    type: "ChooseFacingFromVelocity",
    label: "Choose Facing From Velocity",
    inputs: [
      { name: "velocity", kind: "data", direction: "input", label: "velocity" },
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [
      { name: "facing", kind: "data", direction: "output", label: "facing" },
      { name: "flow", kind: "flow", direction: "output" },
    ],
    fields: [
      { name: "left", label: "Left", type: "string" },
      { name: "right", label: "Right", type: "string" },
    ],
  },
  {
    type: "SetComponent",
    label: "Set Component",
    inputs: [
      { name: "value", kind: "data", direction: "input", label: "value" },
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [{ name: "flow", kind: "flow", direction: "output" }],
    fields: [
      { name: "component", label: "Component", type: "string" },
      { name: "value", label: "Value", type: "string" },
    ],
  },
  {
    type: "SetSpriteState",
    label: "Set Sprite State",
    inputs: [
      { name: "state", kind: "data", direction: "input", label: "state" },
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [{ name: "flow", kind: "flow", direction: "output" }],
    fields: [],
  },
  {
    type: "FlipSpriteFacing",
    label: "Flip Sprite Facing",
    inputs: [
      { name: "facing", kind: "data", direction: "input", label: "facing" },
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [{ name: "flow", kind: "flow", direction: "output" }],
    fields: [
      { name: "left", label: "Left", type: "string" },
      { name: "right", label: "Right", type: "string" },
    ],
  },
  {
    type: "SetVelocity",
    label: "Set Velocity",
    inputs: [
      { name: "velocity", kind: "data", direction: "input", label: "velocity" },
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [{ name: "flow", kind: "flow", direction: "output" }],
    fields: [],
  },
  {
    type: "CheckCollisionWithTag",
    label: "Check Collision With Tag",
    inputs: [
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [
      { name: "hit", kind: "signal", direction: "output", label: "hit" },
      { name: "flow", kind: "flow", direction: "output" },
    ],
    fields: [{ name: "tag", label: "Tag", type: "string" }],
  },
  {
    type: "EmitSignal",
    label: "Emit Signal",
    inputs: [
      { name: "payload", kind: "data", direction: "input", label: "payload" },
      { name: "flow", kind: "flow", direction: "input" },
    ],
    outputs: [{ name: "flow", kind: "flow", direction: "output" }],
    fields: [{ name: "signal", label: "Signal", type: "string" }],
  },
  {
    type: "OnSignal",
    label: "On Signal",
    inputs: [],
    outputs: [
      { name: "payload", kind: "data", direction: "output", label: "payload" },
      { name: "flow", kind: "flow", direction: "output", label: "next" },
    ],
    fields: [{ name: "signal", label: "Signal", type: "string" }],
  },
];

type GraphContext = {
  entity?: Entity;
  values: Record<string, unknown>;
  dt: number;
  nextPort?: string;
};

type GraphRuntimeState = {
  variables: Record<string, unknown>;
};

type GraphSignalListener = (payload: unknown) => void;

type GraphSignalBus = {
  emit: (signal: string, payload: unknown) => void;
  on: (signal: string, listener: GraphSignalListener) => () => void;
};

const graphCache = new Map<string, Promise<GraphDefinition | null>>();
const worldSignalBuses = new WeakMap<object, GraphSignalBus>();

export async function loadGraphDefinition(name: string): Promise<GraphDefinition | null> {
  const cached = graphCache.get(name);
  if (cached) return cached;

  const pending = resolveGraphPath(name)
    .then(async (path) => {
      const res = await fetch(`/api/content/file?path=${encodeURIComponent(path)}`);
      if (!res.ok) return null;
      return parseGraphDefinition(await res.json());
    })
    .catch(() => null);

  graphCache.set(name, pending);
  return pending;
}

type GraphTreeNode = { name?: string; path: string; kind?: string; children?: GraphTreeNode[] };

// Resolve a stored system identifier to a content path. Explicit paths (containing "/") are used
// directly; a bare name is looked up across the whole content tree (a graph asset in any folder),
// falling back to the legacy `systems/<name>` location.
async function resolveGraphPath(name: string): Promise<string> {
  if (name.includes("/")) return name;
  try {
    const res = await fetch("/api/content/tree");
    if (res.ok) {
      const match = findGraphPathByName(await res.json() as GraphTreeNode[], name);
      if (match) return match;
    }
  } catch {
    // ignore; fall through to legacy location
  }
  return `systems/${name}`;
}

function findGraphPathByName(nodes: GraphTreeNode[], name: string): string | null {
  for (const node of nodes) {
    if (node.kind === "graph") {
      const base = node.path.split("/").filter(Boolean).at(-1);
      if (base === name || node.name === name) return node.path;
    }
    if (node.children?.length) {
      const found = findGraphPathByName(node.children, name);
      if (found) return found;
    }
  }
  return null;
}

export async function createGraphSystem(world: DemoGameWorld, graphOrName: string | GraphDefinition) {
  const graph = typeof graphOrName === "string" ? await loadGraphDefinition(graphOrName) : graphOrName;
  if (!graph) throw new Error(`graph not found: ${graphOrName}`);

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const flowEdgesBySource = new Map<string, GraphEdgeDefinition[]>();
  const incomingDataById = new Map<string, GraphEdgeDefinition[]>();
  const runtimeState: GraphRuntimeState = {
    variables: Object.fromEntries(graph.variables.map((variable) => [variable.name, cloneValue(variable.default)])),
  };
  const signalBus = getGraphSignalBus(world);

  for (const edge of graph.edges) {
    const fromNode = nodesById.get(edge.from.node);
    const fromSpec = fromNode ? getGraphNodeSpec(fromNode.type) : undefined;
    const isFlowOutput = fromSpec?.outputs.some((port) => port.name === edge.from.port && port.kind === "flow") ?? false;
    if (isFlowOutput) {
      const next = flowEdgesBySource.get(edge.from.node) ?? [];
      next.push(edge);
      flowEdgesBySource.set(edge.from.node, next);
    } else {
      const incoming = incomingDataById.get(edge.to.node) ?? [];
      incoming.push(edge);
      incomingDataById.set(edge.to.node, incoming);
    }
  }

  const root = nodesById.get(graph.entrypoint) ?? graph.nodes.find((node) => node.type === "OnUpdate");
  if (!root) throw new Error(`graph entrypoint not found: ${graph.name}`);

  for (const node of graph.nodes.filter((candidate) => candidate.type === "OnSignal")) {
    const signalName = String(node.data?.signal ?? "");
    if (!signalName) continue;
    signalBus.on(signalName, (payload) => {
      const values = { ...runtimeState.variables };
      values.payload = cloneValue(payload);
      runNodeChain(world, graph, nodesById, flowEdgesBySource, incomingDataById, node.id, {
        dt: 0,
        values,
      }, runtimeState, signalBus);
    });
  }

  return (dt: number) => {
    runNodeChain(world, graph, nodesById, flowEdgesBySource, incomingDataById, root.id, {
      dt,
      values: { ...runtimeState.variables },
    }, runtimeState, signalBus);
  };
}

function runNodeChain(
  world: DemoGameWorld,
  graph: GraphDefinition,
  nodesById: Map<string, GraphNodeDefinition>,
  flowEdgesBySource: Map<string, GraphEdgeDefinition[]>,
  incomingDataById: Map<string, GraphEdgeDefinition[]>,
  nodeId: string,
  context: GraphContext,
  runtimeState: GraphRuntimeState,
  signalBus: GraphSignalBus,
) {
  const node = nodesById.get(nodeId);
  if (!node) return;

  const resolvedContext = applyIncomingDataEdges(nodeId, context, incomingDataById);
  const contexts = executeNode(world, graph, node, resolvedContext, runtimeState, signalBus)
    .map((nextContext) => annotateNodeOutputs(node, nextContext));
  const nextFlowEdges = flowEdgesBySource.get(nodeId) ?? [];
  if (nextFlowEdges.length === 0) return;

  const edgesByPort = new Map<string, GraphEdgeDefinition[]>();
  for (const edge of nextFlowEdges) {
    const bucket = edgesByPort.get(edge.from.port) ?? [];
    bucket.push(edge);
    edgesByPort.set(edge.from.port, bucket);
  }

  for (const nextContext of contexts) {
    const branchPort = nextContext.nextPort ?? "flow";
    for (const edge of edgesByPort.get(branchPort) ?? []) {
      runNodeChain(
        world,
        graph,
        nodesById,
        flowEdgesBySource,
        incomingDataById,
        edge.to.node,
        { ...nextContext, nextPort: undefined },
        runtimeState,
        signalBus,
      );
    }
  }
}

function applyIncomingDataEdges(
  nodeId: string,
  context: GraphContext,
  incomingDataById: Map<string, GraphEdgeDefinition[]>,
): GraphContext {
  const nextValues = { ...context.values };
  for (const edge of incomingDataById.get(nodeId) ?? []) {
    const sourceKey = `${edge.from.node}.${edge.from.port}`;
    const value = Object.prototype.hasOwnProperty.call(context.values, sourceKey)
      ? context.values[sourceKey]
      : context.values[edge.from.port];
    if (value === undefined) continue;
    nextValues[edge.to.port] = cloneValue(value);
  }
  return { ...context, values: nextValues };
}

function annotateNodeOutputs(node: GraphNodeDefinition, context: GraphContext): GraphContext {
  const spec = getGraphNodeSpec(node.type);
  if (!spec) return context;
  const values = { ...context.values };
  for (const port of spec.outputs) {
    if (port.name === "flow") continue;
    if (!Object.prototype.hasOwnProperty.call(values, port.name)) continue;
    values[`${node.id}.${port.name}`] = cloneValue(values[port.name]);
  }
  return { ...context, values };
}

function getGraphNodeSpec(type: string) {
  return GRAPH_NODE_LIBRARY.find((spec) => spec.type === type);
}

function executeNode(
  world: DemoGameWorld,
  graph: GraphDefinition,
  node: GraphNodeDefinition,
  context: GraphContext,
  runtimeState: GraphRuntimeState,
  signalBus: GraphSignalBus,
): GraphContext[] {
  switch (node.type) {
    case "OnUpdate":
      return [context];
    case "OnSignal":
      return [context];
    case "ForEachEntityWithTag":
    case "ForEachTag": {
      const tag = String(node.data?.tag ?? "");
      if (!tag) return [];
      return Array.from(world.tags.with(tag)).map((entity) => ({
        ...context,
        entity,
        values: {
          ...context.values,
          entity,
        },
      }));
    }
    case "ForEachEntityWithComponent":
    case "ForEachComponent": {
      const componentId = String(node.data?.component ?? "");
      if (!componentId) return [];
      const store = tryGetComponentStore<unknown>(componentId);
      if (!store) return [];
      return Array.from(store.keys()).map((entity) => ({
        ...context,
        entity,
        values: {
          ...context.values,
          entity,
        },
      }));
    }
    case "FindFirstEntityWithTag":
    case "FindFirstTag": {
      const tag = String(node.data?.tag ?? "");
      if (!tag) return [];
      const entity = world.tags.with(tag).values().next().value as Entity | undefined;
      if (entity === undefined) return [];
      return [{
        ...context,
        values: {
          ...context.values,
          entity,
        },
      }];
    }
    case "ReadInput":
    case "ReadInputAxes": {
      const axes = readAxes(node.data);
      return [{
        ...context,
        values: {
          ...context.values,
          x: axes.x,
          y: axes.y,
          vector: { x: axes.x, y: axes.y },
        },
      }];
    }
    case "GetComponent":
    case "ReadComponent": {
      const entity = resolveEntityRef(context, node.data?.entityFrom ?? context.values.entity, context.entity);
      if (entity === undefined) return [];
      const componentId = String(node.data?.component ?? "");
      if (!componentId) return [];
      const store = tryGetComponentStore<Record<string, unknown>>(componentId);
      if (!store) return [context];
      const value = store.get(entity);
      const field = typeof node.data?.field === "string" ? node.data.field : undefined;
      const resolved = field && value && typeof value === "object" ? (value as Record<string, unknown>)[field] : value;
      return [{
        ...context,
        values: {
          ...context.values,
          value: cloneValue(resolved),
        },
      }];
    }
    case "ReadTransform": {
      const entity = resolveEntityRef(
        context,
        context.values.entity ?? context.values.entityFrom ?? node.data?.entityFrom,
        context.entity,
      );
      if (entity === undefined) return [];
      const transform = transforms.get(entity);
      if (!transform) return [];
      return [{
        ...context,
        values: {
          ...context.values,
          transform: cloneValue({
            x: transform.position.x,
            y: transform.position.y,
            rotation: transform.rotation,
            scale: transform.scale,
          }),
        },
      }];
    }
    case "GetVelocity":
    case "ReadVelocity": {
      const entity = resolveEntityRef(
        context,
        context.values.entity ?? context.values.entityFrom ?? node.data?.entityFrom,
        context.entity,
      );
      if (entity === undefined) return [];
      return [{
        ...context,
        values: {
          ...context.values,
          velocity: world.physics.getVelocity(entity),
        },
      }];
    }
    case "SetPosition": {
      const entity = resolveEntityRef(context, node.data?.entityFrom ?? context.values.entity, context.entity);
      if (entity === undefined) return [context];
      // `position` may be a bare vector or a transform-shaped object (x/y at top).
      const pos = asVector(context.values.position ?? resolveNodeValue(node.data, context));
      if (!pos) return [context];
      const transform = transforms.get(entity);
      if (transform) {
        transform.position.x = pos.x;
        transform.position.y = pos.y;
      }
      // Keep the physics body in sync and zero velocity, like a respawn.
      world.physics.reset(entity, { x: pos.x, y: pos.y });
      return [context];
    }
    case "Multiply": {
      // Polymorphic multiply: `value` may be a number or a vector, `by` a number
      // or a vector. Returns the same shape as `value` — number*number → number,
      // vector*number → scaled vector, vector*vector → componentwise. Subsumes the
      // old ScaleVector. Reads legacy port names (left/right/vector/scale) too.
      const a = context.values.value ?? context.values.left ?? context.values.vector;
      const b = context.values.by ?? context.values.right ?? context.values.scale;
      const av = asVector(a);
      const bv = asVector(b);
      let result: number | { x: number; y: number };
      if (typeof a === "number" && typeof b === "number") result = a * b;
      else if (av && typeof b === "number") result = { x: av.x * b, y: av.y * b };
      else if (typeof a === "number" && bv) result = { x: bv.x * a, y: bv.y * a };
      else if (av && bv) result = { x: av.x * bv.x, y: av.y * bv.y };
      else return [];
      const values: Record<string, unknown> = { ...context.values, result, value: result };
      if (typeof result === "object") values.vector = result;
      return [{ ...context, values }];
    }
    // Retired from the node palette (superseded by the polymorphic Multiply node).
    // Executor kept as a hidden alias so existing graphs that reference these types
    // still load and run.
    case "ScaleVector":
    case "BuildVelocity":
    case "SetVelocityFromAxes": {
      const vector = context.values.vector ?? context.values.axes ?? context.values.direction;
      const scale = context.values.scale ?? context.values.speed ?? context.values.right;
      if (!vector || typeof (vector as { x?: unknown }).x !== "number" || typeof (vector as { y?: unknown }).y !== "number" || typeof scale !== "number") return [];
      const velocity = {
        x: (vector as { x: number; y: number }).x * scale,
        y: (vector as { x: number; y: number }).y * scale,
      };
      return [{
        ...context,
        values: {
          ...context.values,
          vector: velocity,
          velocity,
        },
      }];
    }
    case "ComposeVector": {
      const x = context.values.x;
      const y = context.values.y;
      if (typeof x !== "number" || typeof y !== "number") return [];
      return [{
        ...context,
        values: {
          ...context.values,
          vector: { x, y },
        },
      }];
    }
    case "GetVariable": {
      const name = String(node.data?.variable ?? "");
      if (!name) return [];
      return [{
        ...context,
        values: {
          ...context.values,
          value: cloneValue(runtimeState.variables[name]),
        },
      }];
    }
    case "SetVariable":
    case "SetVar": {
      const name = String(node.data?.variable ?? node.data?.name ?? "");
      if (!name) return [context];
      // A node's own configured literal/ref wins over the ambient `value` slot, which
      // upstream nodes (e.g. GetComponent) may have populated with unrelated data.
      const value = resolveNodeValue(node.data, context) ?? context.values.value;
      runtimeState.variables[name] = cloneValue(value);
      return [{
        ...context,
        values: {
          ...context.values,
          [name]: cloneValue(value),
          value: cloneValue(value),
        },
      }];
    }
    case "DirectionToTarget":
    case "BuildDirectionToTarget": {
      const target = (context.values.target ?? context.values[String(node.data?.targetFrom ?? "target")]) as { x?: number; y?: number } | undefined;
      if (!target || context.entity === undefined) return [];
      const sourceTransform = transforms.get(context.entity);
      if (!sourceTransform || typeof target.x !== "number" || typeof target.y !== "number") return [];
      const dx = target.x - sourceTransform.position.x;
      const dy = target.y - sourceTransform.position.y;
      const distance = Math.hypot(dx, dy);
      const direction = distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 };
      return [{
        ...context,
        values: {
          ...context.values,
          direction,
          distance,
        },
      }];
    }
    case "IsMoving": {
      const velocity = (context.values.velocity ?? context.values[String(node.data?.from ?? "velocity")]) as { x?: number; y?: number } | undefined;
      if (!velocity || typeof velocity.x !== "number" || typeof velocity.y !== "number") return [];
      const moving = velocity.x !== 0 || velocity.y !== 0;
      return [{
        ...context,
        values: {
          ...context.values,
          condition: moving,
        },
      }];
    }
    case "If": {
      const condition = context.values.condition;
      const nextPort = condition ? "then" : "else";
      return [{
        ...context,
        nextPort,
      }];
    }
    case "ChooseStateFromVelocity": {
      const velocity = (context.values.velocity ?? context.values[String(node.data?.from ?? "velocity")]) as { x?: number; y?: number } | undefined;
      if (!velocity || typeof velocity.x !== "number" || typeof velocity.y !== "number") return [];
      const nextState = velocity.x === 0 && velocity.y === 0 ? String(node.data?.idle ?? "idle") : String(node.data?.moving ?? "walk");
      return [{
        ...context,
        values: {
          ...context.values,
          state: nextState,
        },
      }];
    }
    case "ChooseFacingFromVelocity": {
      const velocity = (context.values.velocity ?? context.values[String(node.data?.from ?? "velocity")]) as { x?: number } | undefined;
      if (!velocity || typeof velocity.x !== "number" || velocity.x === 0) return [];
      const facing = velocity.x < 0 ? String(node.data?.left ?? "left") : String(node.data?.right ?? "right");
      return [{
        ...context,
        values: {
          ...context.values,
          facing,
        },
      }];
    }
    case "SetComponent": {
      if (context.entity === undefined) return [];
      const componentId = String(node.data?.component ?? "");
      if (!componentId) return [];
      // Prefer the node's own configured value; only fall back to ambient slots when the
      // node doesn't specify one. Otherwise a prior GetComponent's `value` (e.g. velocity)
      // would clobber the intended literal (e.g. actor-state "walk").
      const value = resolveNodeValue(node.data, context) ?? context.values.value ?? context.values.payload ?? context.values[String(node.data?.from ?? componentId)];
      if (value === undefined) return [context];
      const store = tryGetComponentStore<unknown>(componentId);
      if (!store) return [context];
      const field = typeof node.data?.field === "string" ? node.data.field : undefined;
      if (field) {
        const current = store.get(context.entity);
        if (current && typeof current === "object") {
          store.set(context.entity, cloneValue({
            ...(current as Record<string, unknown>),
            [field]: cloneValue(value),
          }));
        } else {
          store.set(context.entity, cloneValue({ [field]: cloneValue(value) }));
        }
      } else {
        store.set(context.entity, cloneValue(value));
      }
      return [context];
    }
    case "SetSpriteState":
    case "SetAnimationState": {
      if (context.entity === undefined) return [];
      const nextState = resolveNodeValue(node.data, context) ?? context.values.state ?? context.values[String(node.data?.from ?? "state")];
      if (typeof nextState !== "string") return [context];
      sprite.animation.state.set(context.entity, nextState);
      return [context];
    }
    case "FlipSpriteFacing":
    case "SetTransformScaleFromFacing": {
      if (context.entity === undefined) return [];
      const facing = context.values.facing ?? context.values[String(node.data?.facingFrom ?? "facing")];
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
    case "SetVelocity":
    case "SetPhysicsVelocity": {
      if (context.entity === undefined) return [];
      const value = (resolveNodeValue(node.data, context) ?? context.values.velocity ?? context.values.vector ?? context.values[String(node.data?.from ?? "velocity")]) as { x?: number; y?: number } | undefined;
      if (!value || typeof value.x !== "number" || typeof value.y !== "number") return [context];
      world.physics.setVelocity(context.entity, { x: value.x, y: value.y });
      return [context];
    }
    case "CheckCollisionWithTag":
    case "CollisionWithTag": {
      if (context.entity === undefined) return [];
      const tag = String(node.data?.tag ?? "");
      if (!tag) return [];
      if (!world.physics.collider(world, context.entity).collide(tag)) return [];
      return [{
        ...context,
        values: {
          ...context.values,
          hit: true,
        },
      }];
    }
    case "EmitSignal": {
      const signal = String(node.data?.signal ?? "");
      if (!signal) return [context];
      const payload = Object.prototype.hasOwnProperty.call(context.values, "payload")
        ? cloneValue(context.values.payload)
        : node.data && Object.prototype.hasOwnProperty.call(node.data, "payload")
          ? cloneValue(node.data.payload)
          : typeof node.data?.from === "string"
            ? cloneValue(context.values[node.data.from])
            : cloneValue(context.values);
      signalBus.emit(signal, payload);
      return [context];
    }
    case "ResetTaggedEntities": {
      const tags = normalizeStringArray(node.data?.tags, []);
      for (const tag of tags) {
        for (const entity of world.tags.with(tag)) {
          const componentId = tag;
          const store = tryGetComponentStore<{ spawn?: { x: number; y: number }; spawnX?: number; spawnY?: number; speed?: number }>(componentId);
          const component = store?.get(entity);
          if (!component) continue;
          // Prefer the vector `spawn`; fall back to legacy scalar spawnX/spawnY.
          const spawn = component.spawn ?? { x: component.spawnX ?? 0, y: component.spawnY ?? 0 };
          const transform = transforms.get(entity);
          if (transform) {
            transform.position.x = spawn.x;
            transform.position.y = spawn.y;
          }
          // Physics owns velocity; reset() already zeroes the body's velocity.
          world.physics.reset(entity, { x: spawn.x, y: spawn.y });
        }
      }
      return [context];
    }
    default:
      return [context];
  }
}

function resolveNodeValue(data: Record<string, unknown> | undefined, context: GraphContext) {
  if (!data) return undefined;
  if (Object.prototype.hasOwnProperty.call(data, "value")) return cloneValue(data.value);
  if (typeof data.from === "string") return cloneValue(context.values[data.from]);
  if (data.from && typeof data.from === "object") {
    const source = data.from as Record<string, unknown>;
    const resolved: Record<string, unknown> = {};
    for (const [key, ref] of Object.entries(source)) {
      resolved[key] = typeof ref === "string" ? cloneValue(context.values[ref]) : cloneValue(ref);
    }
    return resolved;
  }
  return undefined;
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
  if (typeof ref === "number") {
    return ref as Entity;
  }
  if (typeof ref === "string") {
    const value = context.values[ref];
    if (typeof value === "number") return value as Entity;
  }
  return fallback;
}

function getBaseScale(scale: number | { x: number; y: number } = 1) {
  return typeof scale === "number" ? Math.abs(scale) : Math.abs(scale.y);
}

function asVector(value: unknown): { x: number; y: number } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as { x?: unknown; y?: unknown };
  return typeof v.x === "number" && typeof v.y === "number" ? { x: v.x, y: v.y } : undefined;
}

function parseGraphDefinition(value: unknown): GraphDefinition | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as {
    version?: unknown;
    name?: unknown;
    entrypoint?: unknown;
    variables?: unknown;
    nodes?: unknown;
    edges?: unknown;
    metadata?: unknown;
  };
  if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3) {
    return null;
  }

  if (typeof parsed.name !== "string" || typeof parsed.entrypoint !== "string" || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    return null;
  }

  const variables = normalizeGraphVariables(parsed.variables);
  const nodes = parsed.version === 1 ? parsed.nodes.filter(isLegacyNodeDefinition) : parsed.nodes.filter(isNodeDefinition);
  const edges = parsed.edges.filter(isEdgeDefinition);

  return {
    version: 3,
    name: parsed.name,
    entrypoint: parsed.entrypoint,
    variables,
    nodes,
    edges,
    metadata: typeof parsed.metadata === "object" && parsed.metadata !== null
      ? parsed.metadata as GraphDefinition["metadata"]
      : undefined,
  };
}

function isNodeDefinition(value: unknown): value is GraphNodeDefinition {
  if (!value || typeof value !== "object") return false;
  const node = value as Partial<GraphNodeDefinition>;
  return typeof node.id === "string"
    && isUuid(node.id)
    && typeof node.type === "string"
    && typeof node.position === "object"
    && node.position !== null
    && typeof (node.position as { x?: unknown }).x === "number"
    && typeof (node.position as { y?: unknown }).y === "number";
}

function isLegacyNodeDefinition(value: unknown): value is GraphNodeDefinition {
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

function normalizeGraphVariables(value: unknown): GraphVariableDefinition[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const variable = entry as Partial<GraphVariableDefinition> & { default?: unknown };
    if (typeof variable.name !== "string" || variable.name.trim() === "") return [];
    if (variable.scope !== "private" && variable.scope !== "public") return [];
    if (typeof variable.type !== "string" || variable.type.trim() === "") return [];
    if (!Object.prototype.hasOwnProperty.call(variable, "default")) return [];
    return [{
      name: variable.name,
      scope: variable.scope,
      type: variable.type,
      default: cloneValue(variable.default),
    }];
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getGraphSignalBus(world: object): GraphSignalBus {
  const cached = worldSignalBuses.get(world);
  if (cached) return cached;

  const listeners = new Map<string, Set<GraphSignalListener>>();
  const bus: GraphSignalBus = {
    emit(signal, payload) {
      for (const listener of listeners.get(signal) ?? []) {
        listener(cloneValue(payload));
      }
    },
    on(signal, listener) {
      const bucket = listeners.get(signal) ?? new Set<GraphSignalListener>();
      bucket.add(listener);
      listeners.set(signal, bucket);
      return () => {
        bucket.delete(listener);
      };
    },
  };

  worldSignalBuses.set(world, bus);
  return bus;
}

function cloneValue<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
