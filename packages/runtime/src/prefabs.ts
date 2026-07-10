import { getComponentRegistry, type Entity } from "@engine/ecs-core";
import { transforms, type Transform, type Vector } from "@engine/components";
import {
  loadSpriteSheet,
  sprite,
  sprites,
  type SpriteAnchor,
  type SpriteOffset,
  type SpriteAnimationClip,
} from "@engine/renderer";
import type { DemoGameWorld } from "./types";

// On-disk transform: position/rotation/scale as vectors. Legacy flat {x,y} and
// numeric scale are tolerated on read (see coerceTransform) so old prefab/world
// files still load.
export type PrefabTransform = {
  position?: Vector;
  rotation?: number;
  size?: Vector;
};

export type PrefabSpriteSheet = {
  src: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
};

export type PrefabSpriteDefinition = {
  anchor?: SpriteAnchor;
  offset?: SpriteOffset;
  tint?: number;
  texture?: {
    sheet: PrefabSpriteSheet;
    frame?: number;
  };
};

export type PrefabComponentDefinition =
  | { component: "tag"; value: string | string[] }
  | { component: "transform"; value: PrefabTransform }
  | { component: "physics.body"; value: { kind?: "dynamic" | "kinematic" | "static"; width: number; height: number } }
  | { component: "sprite"; value: PrefabSpriteDefinition }
  | { component: "sprite.animation"; value: { initial: string; autoplay?: boolean; clips: Record<string, PrefabAnimationClipDefinition> } }
  | { component: string; value: unknown };

export type PrefabAnimationClipDefinition = {
  sheet: PrefabSpriteSheet;
  fps: number;
  loop: boolean;
};

export type PrefabDefinition = {
  version: 1;
  name: string;
  components: PrefabComponentDefinition[];
};

// A world entity is components-first: a component map that may declare any
// component inline (tag/transform/physics.body/sprite/sprite.animation + registry
// components). `extends` optionally inherits a prefab's components as a base, which
// the inline components then override/extend (Unity-style linked instance).
export type WorldEntity = {
  extends?: string;
  folder?: string;
  components: Record<string, unknown>;
};

const prefabCache = new Map<string, Promise<PrefabDefinition | null>>();
const spriteSheetCache = new Map<string, Promise<Awaited<ReturnType<typeof loadSpriteSheet>>>>();

// Live-entity → outliner folder path / extended prefab name. Populated at instantiate,
// read back by serializeWorld and the editor. Cleared per world load (materializeWorld).
export const entityFolders = new Map<Entity, string>();
export const entityExtends = new Map<Entity, string>();

// Special component types are applied before generic ones (transform first so the
// physics body can anchor to it; sprite before its animation).
const COMPONENT_APPLY_ORDER = ["transform", "tag", "physics.body", "sprite", "sprite.animation"];

export async function instantiateEntity(world: DemoGameWorld, entity: WorldEntity) {
  const base = entity.extends ? await loadPrefabDefinition(entity.extends) : null;
  if (entity.extends && !base) throw new Error(`prefab not found: ${entity.extends}`);

  // Merge: prefab components (base) with the entity's inline components layered on top.
  const merged: Record<string, unknown> = {};
  for (const entry of base?.components ?? []) merged[entry.component] = entry.value;
  for (const [id, value] of Object.entries(entity.components ?? {})) merged[id] = value;

  // Transform field-merges (inline overrides base per field), then defaults.
  const baseTransform = base?.components.find((c) => c.component === "transform")?.value;
  const effectiveTransform = mergeTransform(coerceTransform(baseTransform), coerceTransform(entity.components?.transform));

  const spawned = world.spawn();
  if (entity.folder) entityFolders.set(spawned, entity.folder);
  if (entity.extends) entityExtends.set(spawned, entity.extends);
  const registry = new Map(getComponentRegistry().map((entry) => [entry.id, entry.store]));

  const ids = Object.keys(merged);
  const ordered = [
    ...COMPONENT_APPLY_ORDER.filter((id) => id in merged),
    ...ids.filter((id) => !COMPONENT_APPLY_ORDER.includes(id)),
  ];
  for (const id of ordered) {
    await applyComponent(world, spawned, id, merged[id], registry, effectiveTransform);
  }

  return spawned;
}

export async function loadPrefabDefinition(name: string): Promise<PrefabDefinition | null> {
  const cached = prefabCache.get(name);
  if (cached) return cached;

  const pending = fetch(`/api/content/file?path=${encodeURIComponent(`prefabs/${name}`)}`)
    .then(async (res) => {
      if (!res.ok) return null;
      const raw = await res.json();
      if (!raw || typeof raw !== "object") return null;
      const parsed = raw as Partial<PrefabDefinition>;
      if (parsed.version !== 1 || typeof parsed.name !== "string" || !Array.isArray(parsed.components)) return null;
      return parsed as PrefabDefinition;
    })
    .catch(() => null);

  prefabCache.set(name, pending);
  // Never poison the cache with a transient failure: evict a null result so the
  // next load retries the fetch (only successful definitions stay cached).
  void pending.then((def) => {
    if (!def && prefabCache.get(name) === pending) prefabCache.delete(name);
  });
  return pending;
}

// Field-level transform merge: `over` (inline) wins per field, else `base` (prefab),
// else defaults. Lets an entity override just position while inheriting size.
// `size` defaults to 0 (= auto/native render size).
function mergeTransform(base: ReturnType<typeof coerceTransform>, over: ReturnType<typeof coerceTransform>): Transform {
  return {
    position: {
      x: over.position?.x ?? base.position?.x ?? 0,
      y: over.position?.y ?? base.position?.y ?? 0,
    },
    rotation: over.rotation ?? base.rotation ?? 0,
    size: {
      x: over.size?.x ?? base.size?.x ?? 0,
      y: over.size?.y ?? base.size?.y ?? 0,
    },
  };
}

// Read a transform-ish value from prefab/world JSON, tolerating the nested
// {position,size} vectors and the legacy flat {x,y} layout.
export function coerceTransform(value: unknown): { position?: Vector; rotation?: number; size?: Vector } {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  const position = coerceVector(raw.position) ?? coerceVector({ x: raw.x, y: raw.y });
  const size = coerceSize(raw.size);
  const rotation = typeof raw.rotation === "number" ? raw.rotation : undefined;
  return { position, rotation, size };
}

function coerceVector(value: unknown): Vector | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.x !== "number" || typeof raw.y !== "number") return undefined;
  return { x: raw.x, y: raw.y };
}

function coerceSize(value: unknown): Vector | undefined {
  if (typeof value === "number") return { x: value, y: value };
  return coerceVector(value);
}

// Apply one component (already merged from extends + inline) to a live entity.
// Special types write their dedicated stores; everything else is a generic registry
// component. `transform` uses the pre-merged effectiveTransform (its own value is ignored).
async function applyComponent(
  world: DemoGameWorld,
  entity: Entity,
  componentId: string,
  value: unknown,
  registry: Map<string, Map<Entity, unknown>>,
  effectiveTransform: Transform,
) {
  switch (componentId) {
    case "tag": {
      const tags = Array.isArray(value) ? (value as string[]) : [value as string];
      world.tags.add(entity, ...tags);
      return;
    }
    case "transform": {
      transforms.set(entity, {
        position: { ...effectiveTransform.position },
        rotation: effectiveTransform.rotation,
        size: { ...effectiveTransform.size },
      });
      return;
    }
    case "physics.body": {
      const body = value as { kind?: "dynamic" | "kinematic" | "static"; width: number; height: number };
      const transform = transforms.get(entity) ?? effectiveTransform;
      const { kind, width, height } = body;
      world.physics.body[kind ?? "dynamic"].set(entity, { x: transform.position.x, y: transform.position.y, width, height });
      return;
    }
    case "sprite": {
      const spriteValue = value as PrefabSpriteDefinition;
      const texture = spriteValue.texture ? await resolveSpriteTexture(spriteValue.texture.sheet, spriteValue.texture.frame ?? 0) : undefined;
      sprite.set(entity, {
        texture,
        tint: spriteValue.tint,
        anchor: spriteValue.anchor,
        offset: spriteValue.offset,
      });
      return;
    }
    case "sprite.animation": {
      const animation = value as { initial: string; autoplay?: boolean; clips: Record<string, PrefabAnimationClipDefinition> };
      if (!sprites.get(entity)) sprite.set(entity, {});
      const clips = await resolveAnimationClips(animation.clips);
      sprite.animation.set(entity, {
        initial: animation.initial,
        autoplay: animation.autoplay,
        clips,
      });
      return;
    }
    default: {
      const store = registry.get(componentId);
      if (!store) return;
      store.set(entity, cloneValue(value));
    }
  }
}

async function resolveAnimationClips(clips: Record<string, PrefabAnimationClipDefinition>): Promise<Record<string, SpriteAnimationClip>> {
  const resolved: Record<string, SpriteAnimationClip> = {};
  for (const [name, clip] of Object.entries(clips)) {
    const textures = await loadSpriteSheetCached(clip.sheet);
    resolved[name] = {
      fps: clip.fps,
      loop: clip.loop,
      frames: textures.map((texture) => ({ texture })),
    };
  }
  return resolved;
}

async function resolveSpriteTexture(sheet: PrefabSpriteSheet, frame: number) {
  const textures = await loadSpriteSheetCached(sheet);
  return textures[frame];
}

async function loadSpriteSheetCached(sheet: PrefabSpriteSheet) {
  const key = JSON.stringify(sheet);
  const cached = spriteSheetCache.get(key);
  if (cached) return cached;
  const pending = loadSpriteSheet(sheet);
  spriteSheetCache.set(key, pending);
  return pending;
}

function cloneValue<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
