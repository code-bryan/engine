import { registerComponent, type ComponentStore } from "@engine/ecs-core";

export type ComponentKind = "struct" | "scalar" | "enum";

// Premade, engine-provided components registered before any project content so
// their typed stores back the shared registry and the editor lists them under the
// Engine tab. Content files must not redefine these. (Velocity is deliberately NOT
// here — velocity is owned by physics, read via physics.getVelocity, not a component.)
const PREMADE_COMPONENTS: { definition: ComponentDefinition; store: ComponentStore<unknown> }[] = [];

export function getPremadeComponentIds(): string[] {
  return PREMADE_COMPONENTS.map((entry) => entry.definition.id);
}

// A premade, engine-provided asset surfaced (read-only) under the editor's Engine
// tab. `body` is the definition shown in preview; these are usable in worlds by id
// without importing anything into the project.
export type PremadeAsset = { kind: "component" | "system" | "prefab"; id: string; label: string; body: unknown };

// Transform is a native, always-present component (its own transform store); it is
// not in PREMADE_COMPONENTS since it is not registered through the generic registry,
// so it is listed here explicitly for discoverability.
const TRANSFORM_ASSET: PremadeAsset = {
  kind: "component",
  id: "transform",
  label: "Transform",
  body: { version: 1, id: "transform", label: "Transform", kind: "struct", defaultValue: { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } } },
};

export function getPremadeAssets(): PremadeAsset[] {
  return [
    TRANSFORM_ASSET,
    ...PREMADE_COMPONENTS.map(({ definition }) => ({ kind: "component" as const, id: definition.id, label: definition.label, body: definition })),
  ];
}

// Per-field inspector metadata for a struct component's key (Unity/Unreal-style:
// per-property editability + numeric constraints). Overrides the component-level
// defaults below for that key.
export type FieldConstraint = {
  label?: string;
  editable?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
};

export type ComponentDefinition = {
  version: 1;
  id: string;
  label: string;
  kind?: ComponentKind;
  values?: string[];
  defaultValue?: unknown;
  // Component-level defaults, enforced when editing this component's number values
  // in the inspector. `min: 0` prevents negatives; `integer` rounds.
  min?: number;
  max?: number;
  integer?: boolean;
  // Whether this component is editable in the Details panel (default true). Set
  // `"editable": false` to make the whole component read-only.
  editable?: boolean;
  // Per-key overrides for struct components — control editability/constraints/label
  // of individual fields, e.g. `"fields": { "maxHealth": { "editable": false } }`.
  fields?: Record<string, FieldConstraint>;
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
    for (const { definition, store } of PREMADE_COMPONENTS) registerComponentDefinition(definition, store);
    bootstrapPromise = fetchComponentDefinitions().then((definitions) => {
      for (const definition of definitions) registerComponentDefinition(definition);
    });
  }
  return bootstrapPromise;
}

export function registerComponentDefinition(definition: ComponentDefinition, store?: ComponentStore<unknown>) {
  validateComponentDefinition(definition);
  const existing = componentDefinitions.get(definition.id);
  if (existing) {
    if (existing.label !== definition.label) {
      throw new Error(`component id already registered with a different label: ${definition.id}`);
    }
    return getComponentStore(definition.id);
  }

  const registered = registerComponent(definition.id, definition.label, store ?? new Map());
  componentDefinitions.set(definition.id, definition);
  componentStores.set(definition.id, registered);
  return registered;
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

// Non-throwing lookup for callers that must degrade gracefully when a referenced
// component was removed (e.g. a stale "velocity" reference — velocity is now
// physics-owned, not a component).
export function tryGetComponentStore<T>(id: string): ComponentStore<T> | undefined {
  return componentStores.get(id) as ComponentStore<T> | undefined;
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

  const kind = parsed.kind === "struct" || parsed.kind === "scalar" || parsed.kind === "enum" ? parsed.kind : undefined;
  if (kind === "enum") {
    const values = Array.isArray(parsed.values) ? parsed.values.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];
    if (values.length === 0) throw new Error(`enum component "${parsed.id}" must declare at least one value`);
    const defaultValue = typeof parsed.defaultValue === "string" && values.includes(parsed.defaultValue) ? parsed.defaultValue : values[0];
    return {
      version: 1,
      id: parsed.id,
      label: parsed.label,
      kind,
      values,
      defaultValue,
      ...(parsed.editable === false ? { editable: false } : {}),
    };
  }

  const fields = parseFieldConstraints(parsed.fields);
  return {
    version: 1,
    id: parsed.id,
    label: parsed.label,
    ...(kind ? { kind } : {}),
    defaultValue: parsed.defaultValue,
    ...(typeof parsed.min === "number" ? { min: parsed.min } : {}),
    ...(typeof parsed.max === "number" ? { max: parsed.max } : {}),
    ...(parsed.integer === true ? { integer: true } : {}),
    ...(parsed.editable === false ? { editable: false } : {}),
    ...(fields ? { fields } : {}),
  };
}

function parseFieldConstraints(value: unknown): Record<string, FieldConstraint> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const out: Record<string, FieldConstraint> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    const fc: FieldConstraint = {
      ...(typeof c.label === "string" ? { label: c.label } : {}),
      ...(typeof c.editable === "boolean" ? { editable: c.editable } : {}),
      ...(typeof c.min === "number" ? { min: c.min } : {}),
      ...(typeof c.max === "number" ? { max: c.max } : {}),
      ...(c.integer === true ? { integer: true } : {}),
    };
    out[key] = fc;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function validateComponentDefinition(definition: ComponentDefinition) {
  parseComponentDefinition(definition);
}
