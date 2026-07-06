import { getComponentRegistry, type Entity } from "@engine/ecs-core";
import { transforms, type TransformScale } from "@engine/renderer";
import type { DemoGameWorld } from "./types";
import { instantiatePrefab, type PrefabPlacement } from "./prefabs";

export type DemoWorldEntity = PrefabPlacement;

export type DemoWorldData = {
  version: 1;
  systems: string[];
  entities: DemoWorldEntity[];
};

export type DemoContentNode = {
  name: string;
  path: string;
  kind: "folder" | "world" | "prefab" | "component" | "graph";
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
  for (const entity of data.entities) {
    await instantiatePrefab(world, entity);
  }
}

export function serializeWorld(world: DemoGameWorld, systems: string[] = []): DemoWorldData {
  const entities: DemoWorldEntity[] = [];

  for (const entity of Array.from(world.entities as Iterable<Entity>).sort((left, right) => left - right)) {
    const transform = transforms.get(entity);
    if (!transform) continue;

    const prefab = world.tags.list(entity)[0] ?? "entity";
    const components: Record<string, unknown> = {};
    for (const { id, store } of getComponentRegistry()) {
      const value = store.get(entity);
      if (value !== undefined) components[id] = cloneValue(value);
    }

    entities.push({
      prefab,
      transform: {
        x: transform.x,
        y: transform.y,
        rotation: transform.rotation ?? 0,
        scale: normalizeScale(transform.scale),
      },
      components: Object.keys(components).length > 0 ? components : undefined,
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

function storageKey(name: string) {
  return `demo-platformer.${name}`;
}

function normalizeScale(scale?: TransformScale) {
  if (scale === undefined) return { x: 1, y: 1 };
  return typeof scale === "number" ? { x: scale, y: scale } : scale;
}

function normalizeWorldEntity(value: unknown): DemoWorldEntity | null {
  if (!value || typeof value !== "object") return null;
  const entity = value as {
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
  };

  if (typeof entity.prefab === "string") {
    return {
      prefab: entity.prefab,
      transform: normalizeTransform(entity.transform),
      components: normalizeComponents(entity.components),
    };
  }

  if (typeof entity.kind !== "string") return null;
  if (typeof entity.x !== "number" || typeof entity.y !== "number") return null;

  const prefab = entity.kind;
  const components = normalizeComponents(entity.components);
  if (prefab === "player") {
    components.player = {
      speed: typeof entity.speed === "number" ? entity.speed : 96,
      spawnX: typeof entity.spawnX === "number" ? entity.spawnX : entity.x,
      spawnY: typeof entity.spawnY === "number" ? entity.spawnY : entity.y,
    };
  }
  if (prefab === "enemy") {
    components.enemy = {
      speed: typeof entity.speed === "number" ? entity.speed : 42,
      spawnX: typeof entity.spawnX === "number" ? entity.spawnX : entity.x,
      spawnY: typeof entity.spawnY === "number" ? entity.spawnY : entity.y,
    };
  }

  return {
    prefab,
    transform: {
      x: entity.x,
      y: entity.y,
      rotation: typeof entity.rotation === "number" ? entity.rotation : 0,
      scale: typeof entity.scale === "number" ? entity.scale : 1,
    },
    components: Object.keys(components).length > 0 ? components : undefined,
  };
}

function normalizeTransform(value: unknown): DemoWorldEntity["transform"] {
  if (!value || typeof value !== "object") return undefined;
  const transform = value as Partial<NonNullable<DemoWorldEntity["transform"]>>;
  return {
    x: typeof transform.x === "number" ? transform.x : 0,
    y: typeof transform.y === "number" ? transform.y : 0,
    rotation: typeof transform.rotation === "number" ? transform.rotation : 0,
    scale: normalizeScale(transform.scale),
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
