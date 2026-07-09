import type { GraphDefinition, GraphVariableDefinition } from "@engine/runtime";

export type GraphAsset = GraphDefinition;

async function fetchContentFile(path: string): Promise<unknown | null> {
  const response = await fetch(`/api/content/file?path=${encodeURIComponent(path)}`);
  if (!response.ok) return null;
  return await response.json();
}

export async function fetchGraphAsset(path: string): Promise<GraphAsset | null> {
  const raw = await fetchContentFile(path);
  if (raw === null) return null;
  return parseGraphAsset(raw);
}

export async function saveGraphAsset(path: string, graph: GraphAsset): Promise<void> {
  await fetch(`/api/content/file?path=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(graph, null, 2),
  });
}

export function parseGraphAsset(value: unknown): GraphAsset | null {
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
  if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3) return null;
  if (typeof parsed.name !== "string" || typeof parsed.entrypoint !== "string" || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    return null;
  }
  const version = parsed.version;
  const nodes = version === 1 ? parsed.nodes.filter(isLegacyGraphNode) : parsed.nodes.filter(isGraphNode);
  const edges = parsed.edges.filter(isGraphEdge);
  const variables = version === 1 ? [] : Array.isArray(parsed.variables) ? parsed.variables.filter(isGraphVariable) : [];
  return {
    version: 3,
    name: parsed.name,
    entrypoint: parsed.entrypoint,
    variables,
    nodes,
    edges,
    metadata: typeof parsed.metadata === "object" && parsed.metadata !== null ? parsed.metadata as GraphAsset["metadata"] : undefined,
  };
}

export function isGraphNode(value: unknown): value is GraphAsset["nodes"][number] {
  if (!value || typeof value !== "object") return false;
  const node = value as Partial<GraphAsset["nodes"][number]>;
  return typeof node.id === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(node.id)
    && typeof node.type === "string"
    && typeof node.position === "object"
    && node.position !== null
    && typeof (node.position as { x?: unknown }).x === "number"
    && typeof (node.position as { y?: unknown }).y === "number";
}

export function isLegacyGraphNode(value: unknown): value is GraphAsset["nodes"][number] {
  if (!value || typeof value !== "object") return false;
  const node = value as Partial<GraphAsset["nodes"][number]>;
  return typeof node.id === "string"
    && typeof node.type === "string"
    && typeof node.position === "object"
    && node.position !== null
    && typeof (node.position as { x?: unknown }).x === "number"
    && typeof (node.position as { y?: unknown }).y === "number";
}

export function isGraphVariable(value: unknown): value is GraphVariableDefinition {
  if (!value || typeof value !== "object") return false;
  const variable = value as Partial<GraphVariableDefinition> & { default?: unknown };
  return typeof variable.name === "string"
    && variable.name.trim() !== ""
    && (variable.scope === "private" || variable.scope === "public")
    && typeof variable.type === "string"
    && variable.type.trim() !== ""
    && Object.prototype.hasOwnProperty.call(variable, "default");
}

export function isGraphEdge(value: unknown): value is GraphAsset["edges"][number] {
  if (!value || typeof value !== "object") return false;
  const edge = value as Partial<GraphAsset["edges"][number]>;
  return typeof edge.from === "object"
    && edge.from !== null
    && typeof edge.to === "object"
    && edge.to !== null
    && typeof edge.from.node === "string"
    && typeof edge.from.port === "string"
    && typeof edge.to.node === "string"
    && typeof edge.to.port === "string";
}
