import { registerComponent, type ComponentStore } from "@engine/ecs-core";

export type ComponentDefinition = {
  version: 1;
  id: string;
  label: string;
  defaultValue?: unknown;
};

type ContentTreeNode = {
  path: string;
  kind?: string;
  children?: ContentTreeNode[];
};

const componentDefinitions = new Map<string, ComponentDefinition>();
const componentStores = new Map<string, ComponentStore<unknown>>();
let bootstrapPromise: Promise<void> | null = null;

export async function initializeDemoRuntime() {
  if (!bootstrapPromise) {
    bootstrapPromise = fetchComponentDefinitions().then((definitions) => {
      for (const definition of definitions) registerComponentDefinition(definition);
    });
  }
  return bootstrapPromise;
}

export function registerComponentDefinition(definition: ComponentDefinition) {
  validateComponentDefinition(definition);
  const existing = componentDefinitions.get(definition.id);
  if (existing) {
    if (existing.label !== definition.label) {
      throw new Error(`component id already registered with a different label: ${definition.id}`);
    }
    return getComponentStore(definition.id);
  }

  const store = registerComponent(definition.id, definition.label, new Map());
  componentDefinitions.set(definition.id, definition);
  componentStores.set(definition.id, store);
  return store;
}

export async function registerComponentDefinitionFromFile(path: string) {
  const normalized = normalizeComponentPath(path);
  const response = await fetch(`/api/content/file?path=${encodeURIComponent(normalized)}`);
  if (!response.ok) throw new Error(`component file not found: ${normalized}`);
  const raw = await response.json();
  return registerComponentDefinition(parseComponentDefinition(raw));
}

export function getComponentDefinitions() {
  return Array.from(componentDefinitions.values()).sort((left, right) => left.id.localeCompare(right.id));
}

export function getComponentStore<T>(id: string): ComponentStore<T> {
  const store = componentStores.get(id);
  if (!store) throw new Error(`missing component store: ${id}`);
  return store as ComponentStore<T>;
}

async function fetchComponentDefinitions() {
  const tree = await fetchContentTree();
  const paths = collectComponentPaths(tree);
  const definitions = await Promise.all(paths.map(async (path) => {
    const response = await fetch(`/api/content/file?path=${encodeURIComponent(path)}`);
    if (!response.ok) return null;
    try {
      return parseComponentDefinition(await response.json());
    } catch {
      return null;
    }
  }));
  return definitions.filter((definition): definition is ComponentDefinition => definition !== null);
}

async function fetchContentTree(): Promise<ContentTreeNode[]> {
  const response = await fetch("/api/content/tree");
  if (!response.ok) return [];
  return await response.json() as ContentTreeNode[];
}

function collectComponentPaths(nodes: ContentTreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.kind === "component") {
      paths.push(node.path);
    }
    if (node.children?.length) {
      paths.push(...collectComponentPaths(node.children));
    }
  }
  return paths;
}

function normalizeComponentPath(path: string) {
  const normalized = path.replace(/^\/+|\/+$/g, "").replace(/\\/g, "/");
  if (!normalized) throw new Error("missing path");
  if (normalized.split("/").some((segment) => segment === ".." || segment === "")) throw new Error("invalid path");
  return normalized;
}

function parseComponentDefinition(value: unknown): ComponentDefinition {
  if (!value || typeof value !== "object") throw new Error("invalid component definition");
  const parsed = value as Partial<ComponentDefinition>;
  if (parsed.version !== 1) throw new Error("invalid component definition version");
  if (typeof parsed.id !== "string" || parsed.id.trim() === "") throw new Error("invalid component id");
  if (typeof parsed.label !== "string" || parsed.label.trim() === "") throw new Error(`invalid component label for ${parsed.id}`);
  return {
    version: 1,
    id: parsed.id,
    label: parsed.label,
    defaultValue: parsed.defaultValue,
  };
}

function validateComponentDefinition(definition: ComponentDefinition) {
  parseComponentDefinition(definition);
}
