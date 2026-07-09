import { GRAPH_NODE_LIBRARY, type GraphNodeDefinition, type GraphNodeSpec } from "@engine/runtime";
import type { GraphAsset } from "./graph-asset";

export function createGraphNode(spec: GraphNodeSpec, position: { x: number; y: number }): GraphAsset["nodes"][number] {
  return {
    id: crypto.randomUUID(),
    type: spec.type,
    position: {
      x: Math.round(position.x),
      y: Math.round(position.y),
    },
    data: {},
  };
}

export function parseEditableValue(value: string, type: GraphNodeSpec["fields"][number]["type"]) {
  if (type === "number") {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? 0 : numeric;
  }
  if (type === "boolean") return value.trim().toLowerCase() === "true";
  if (type === "json") {
    if (value.trim() === "") return undefined;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export function formatEditableValue(value: unknown, type: GraphNodeSpec["fields"][number]["type"]) {
  if (value === undefined) return "";
  if (type === "json") return JSON.stringify(value, null, 2);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function parseJsonInput(input: string, fallback: unknown) {
  if (input.trim() === "") return fallback;
  try {
    return JSON.parse(input);
  } catch {
    return fallback;
  }
}

export function formatJsonValue(value: unknown) {
  if (value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

export function describeNodePorts(type: GraphNodeDefinition["type"]) {
  const spec = GRAPH_NODE_LIBRARY.find((entry) => entry.type === type);
  if (!spec) return "flow";
  const inputs = spec.inputs.map((port) => port.name).join(", ") || "-";
  const outputs = spec.outputs.map((port) => port.name).join(", ") || "-";
  return `in: ${inputs} | out: ${outputs}`;
}

export function edgeKey(edge: GraphAsset["edges"][number]) {
  return `${edge.from.node}:${edge.from.port}->${edge.to.node}:${edge.to.port}`;
}

export function moveGraphNode(graph: GraphAsset, nodeId: string, deltaX: number, deltaY: number): GraphAsset {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => (
      node.id === nodeId
        ? {
            ...node,
            position: {
              x: Math.round(node.position.x + deltaX),
              y: Math.round(node.position.y + deltaY),
            },
          }
        : node
    )),
  };
}

export function fitGraphView(viewportWidth: number, viewportHeight: number, bounds: { x: number; y: number; width: number; height: number }) {
  const padding = 56;
  const usableWidth = Math.max(1, viewportWidth - padding * 2);
  const usableHeight = Math.max(1, viewportHeight - padding * 2);
  const zoom = clamp(Math.min(usableWidth / bounds.width, usableHeight / bounds.height), 0.2, 2);
  return {
    zoom,
    x: (viewportWidth - bounds.width * zoom) / 2,
    y: (viewportHeight - bounds.height * zoom) / 2,
  };
}

export function toGraphPoint(
  viewport: HTMLDivElement | null,
  graphView: { x: number; y: number; zoom: number },
  clientX: number,
  clientY: number,
) {
  if (!viewport) return null;
  const rect = viewport.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  return {
    x: (x - graphView.x) / graphView.zoom,
    y: (y - graphView.y) / graphView.zoom,
  };
}

export function computeGraphBounds(graph: GraphAsset) {
  const padX = 112;
  const padY = 96;
  const cardWidth = 246;
  const cardHeight = 176;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of graph.nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + cardWidth);
    maxY = Math.max(maxY, node.position.y + cardHeight);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { x: 0, y: 0, width: 1400, height: 900 };
  }

  return {
    x: minX - padX,
    y: minY - padY,
    width: Math.max(1400, maxX - minX + padX * 2),
    height: Math.max(900, maxY - minY + padY * 2),
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getGraphNodeCenter(node: GraphAsset["nodes"][number], bounds: { x: number; y: number }) {
  return {
    x: node.position.x - bounds.x + 123,
    y: node.position.y - bounds.y + 88,
  };
}

export function getGraphPortPoint(
  node: GraphAsset["nodes"][number],
  portName: string,
  direction: "input" | "output",
  bounds: { x: number; y: number },
) {
  const spec = GRAPH_NODE_LIBRARY.find((entry) => entry.type === node.type);
  const ports = direction === "input" ? spec?.inputs ?? [] : spec?.outputs ?? [];
  const portIndex = Math.max(0, ports.findIndex((port) => port.name === portName));
  const center = getGraphNodeCenter(node, bounds);
  const xOffset = direction === "input" ? -116 : 116;
  const yOffset = -42 + Math.min(portIndex, 4) * 20;
  return {
    x: center.x + xOffset,
    y: center.y + yOffset,
  };
}

export function formatGraphValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map((entry) => formatGraphValue(entry)).join(", ")}]`;
  if (value && typeof value === "object") return "{…}";
  return String(value);
}
