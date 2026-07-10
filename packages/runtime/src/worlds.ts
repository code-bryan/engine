import { getComponentRegistry, type Entity } from "@engine/ecs-core";
import { transforms, sprites, spriteAnimations } from "@engine/renderer";
import type { DemoGameWorld } from "./types";
import { instantiateEntity, coerceTransform, entityFolders, entityExtends, type WorldEntity, type PrefabTransform } from "./prefabs";

export type DemoWorldEntity = WorldEntity;

export type DemoWorldData = {
  version: 1;
  systems: string[];
  entities: DemoWorldEntity[];
};

export type DemoContentNode = {
  name: string;
  path: string;
  kind: "folder" | "world" | "prefab" | "component" | "graph" | "file";
  children?: DemoContentNode[];
};

export async function loadWorldDefinition(name: string): Promise<DemoWorldData> {
  const stored = readStoredWorld(name);
  if (stored) return stored;

  try {
    const res = await fetch(`/api/content/file?path=${encodeURIComponent(name)}`);
    if (res.ok) {
      const fromFile = parseDemoWorldData(await res.json());
      if (fromFile) return fromFile;
    }
  } catch {}

  return { version: 1, systems: [], entities: [] };
}

export async function saveWorldDefinition(name: string, world: DemoWorldData): Promise<void> {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(world, null, 2);
  window.localStorage.setItem(storageKey(name), json);
  try {
    await fetch(`/api/content/file?path=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
    });
  } catch {}
}

export async function fetchContentTree(): Promise<DemoContentNode[]> {
  try {
    const res = await fetch("/api/content/tree");
    if (res.ok) return await res.json() as DemoContentNode[];
  } catch {}
  return [];
}

export async function materializeWorld(world: DemoGameWorld, data: DemoWorldData) {
  // Shared component/render stores are module-level singletons; clear them so a
  // remounted world starts from a clean slate instead of inheriting the previous
  // world's sprites/entities. Destroy the old sprite display objects first so they
  // are removed from the Pixi stage (an in-place world swap keeps the same engine).
  for (const [, ref] of sprites) ref.sprite.destroy({ children: true });
  transforms.clear();
  sprites.clear();
  spriteAnimations.clear();
  entityFolders.clear();
  entityExtends.clear();
  for (const { store } of getComponentRegistry()) store.clear();

  for (const entity of data.entities) {
    await instantiateEntity(world, entity);
  }
}

export function serializeWorld(world: DemoGameWorld, systems: string[] = []): DemoWorldData {
  const entities: DemoWorldEntity[] = [];

  for (const entity of Array.from(world.entities as Iterable<Entity>).sort((left, right) => left - right)) {
    const transform = transforms.get(entity);
    if (!transform) continue;

    const extendsPrefab = entityExtends.get(entity);
    const components: Record<string, unknown> = {};

    // Transform is components-first now.
    components.transform = {
      position: { x: transform.position.x, y: transform.position.y },
      rotation: transform.rotation,
      size: { x: transform.size.x, y: transform.size.y },
    };
    // Registry (per-instance / runtime-varying) components.
    for (const { id, store } of getComponentRegistry()) {
      const value = store.get(entity);
      if (value !== undefined) components[id] = cloneValue(value);
    }
    // A prefab-less entity keeps its tag inline; extends entities inherit tag/sprite/
    // physics from the prefab, so those are not re-emitted (overrides-only).
    if (!extendsPrefab) {
      const tags = world.tags.list(entity);
      if (tags.length > 0) components.tag = tags.length === 1 ? tags[0] : tags;
    }

    entities.push({
      extends: extendsPrefab,
      components,
      folder: entityFolders.get(entity),
    });
  }

  return { version: 1, systems, entities };
}

export function parseDemoWorldData(raw: unknown): DemoWorldData | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as { version?: unknown; systems?: unknown; entities?: unknown };
  if (parsed.version !== 1 || !Array.isArray(parsed.entities)) return null;
  const entities = parsed.entities.map(normalizeWorldEntity).filter((entity): entity is DemoWorldEntity => entity !== null);
  return {
    version: 1,
    systems: normalizeStringArray(parsed.systems),
    entities,
  };
}

function readStoredWorld(name: string): DemoWorldData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(name));
    if (!raw) return null;
    return parseDemoWorldData(JSON.parse(raw));
  } catch {
    return null;
  }
}

// Local edits are cached in localStorage keyed by project so opening a different
// project doesn't inherit another project's unsaved worlds.
let storageNamespace = "engine";

export function setStorageNamespace(namespace: string) {
  storageNamespace = namespace || "engine";
}

function storageKey(name: string) {
  return `${storageNamespace}.${name}`;
}

function normalizeWorldEntity(value: unknown): DemoWorldEntity | null {
  if (!value || typeof value !== "object") return null;
  const entity = value as {
    extends?: unknown;
    prefab?: unknown;
    transform?: unknown;
    components?: unknown;
    kind?: unknown;
    x?: unknown;
    y?: unknown;
    rotation?: unknown;
    scale?: unknown;
    speed?: unknown;
    spawnX?: unknown;
    spawnY?: unknown;
    folder?: unknown;
  };

  const folder = typeof entity.folder === "string" && entity.folder.trim() !== "" ? entity.folder : undefined;
  const extendsPrefab = typeof entity.extends === "string" ? entity.extends : undefined;

  // Legacy: required `prefab` + top-level `transform`. Map prefab→extends and fold
  // the top-level transform into components.transform (components-first).
  if (typeof entity.prefab === "string") {
    return {
      extends: entity.prefab,
      folder,
      components: { ...normalizeComponents(entity.components), transform: normalizeTransform(entity.transform) },
    };
  }

  // Legacy flat {kind,x,y}: kind→extends, synthesize speed, transform from x/y.
  if (typeof entity.kind === "string" && typeof entity.x === "number" && typeof entity.y === "number") {
    const components = normalizeComponents(entity.components);
    if (entity.kind === "player") components.speed = typeof entity.speed === "number" ? entity.speed : 96;
    if (entity.kind === "enemy") components.speed = typeof entity.speed === "number" ? entity.speed : 42;
    components.transform = normalizeTransform(entity);
    return { extends: entity.kind, folder, components };
  }

  // New components-first shape: { extends?, folder?, components }.
  if (entity.components && typeof entity.components === "object") {
    return { extends: extendsPrefab, folder, components: normalizeComponents(entity.components) };
  }

  return null;
}

function normalizeTransform(value: unknown): PrefabTransform | undefined {
  if (!value || typeof value !== "object") return undefined;
  const parts = coerceTransform(value);
  return {
    position: parts.position ?? { x: 0, y: 0 },
    rotation: parts.rotation ?? 0,
    size: parts.size ?? { x: 0, y: 0 },
  };
}

function normalizeComponents(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return { ...(value as Record<string, unknown>) };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function cloneValue<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
