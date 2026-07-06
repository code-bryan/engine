import { getComponentRegistry, type Entity } from "@engine/ecs-core";
import {
  loadSpriteSheet,
  sprite,
  sprites,
  transforms,
  type SpriteAnchor,
  type SpriteOffset,
  type SpriteAnimationClip,
  type TransformScale,
} from "@engine/renderer";
import type { DemoGameWorld } from "./types";

export type PrefabTransform = {
  x?: number;
  y?: number;
  rotation?: number;
  scale?: TransformScale;
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

export type PrefabPlacement = {
  prefab: string;
  transform?: PrefabTransform;
  components?: Record<string, unknown>;
};

type ResolvedPrefabTransform = {
  x: number;
  y: number;
  rotation: number;
  scale: TransformScale;
};

const prefabCache = new Map<string, Promise<PrefabDefinition | null>>();
const spriteSheetCache = new Map<string, Promise<Awaited<ReturnType<typeof loadSpriteSheet>>>>();

export async function instantiatePrefab(world: DemoGameWorld, placement: PrefabPlacement) {
  const definition = await loadPrefabDefinition(placement.prefab);
  if (!definition) throw new Error(`prefab not found: ${placement.prefab}`);

  const entity = world.spawn();
  const registry = new Map(getComponentRegistry().map((entry) => [entry.id, entry.store]));
  const effectiveTransform = resolveTransform(definition, placement);

  for (const entry of definition.components) {
    await applyPrefabComponent(world, entity, entry, registry, placement, effectiveTransform);
  }

  return entity;
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
  return pending;
}

function resolveTransform(definition: PrefabDefinition, placement: PrefabPlacement): ResolvedPrefabTransform {
  const prefabTransform = definition.components.find((component): component is Extract<PrefabComponentDefinition, { component: "transform" }> => component.component === "transform")?.value ?? {};
  return {
    x: placement.transform?.x ?? prefabTransform.x ?? 0,
    y: placement.transform?.y ?? prefabTransform.y ?? 0,
    rotation: placement.transform?.rotation ?? prefabTransform.rotation ?? 0,
    scale: placement.transform?.scale ?? prefabTransform.scale ?? 1,
  };
}

async function applyPrefabComponent(
  world: DemoGameWorld,
  entity: Entity,
  entry: PrefabComponentDefinition,
  registry: Map<string, Map<Entity, unknown>>,
  placement: PrefabPlacement,
  effectiveTransform: Required<PrefabTransform>,
) {
  switch (entry.component) {
    case "tag": {
      const tags = Array.isArray(entry.value) ? entry.value : [entry.value];
      world.tags.add(entity, ...tags);
      return;
    }
    case "transform": {
      transforms.set(entity, {
        x: effectiveTransform.x,
        y: effectiveTransform.y,
        rotation: effectiveTransform.rotation,
        scale: effectiveTransform.scale,
      });
      return;
    }
    case "physics.body": {
      const body = entry.value as Extract<PrefabComponentDefinition, { component: "physics.body" }>["value"];
      const transform = transforms.get(entity) ?? {
        x: effectiveTransform.x,
        y: effectiveTransform.y,
        rotation: effectiveTransform.rotation,
        scale: effectiveTransform.scale,
      };
      const { kind, width, height } = body;
      world.physics.body[kind ?? "dynamic"].set(entity, { x: transform.x, y: transform.y, width, height });
      return;
    }
    case "sprite": {
      const spriteValue = entry.value as Extract<PrefabComponentDefinition, { component: "sprite" }>["value"];
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
      const animation = entry.value as Extract<PrefabComponentDefinition, { component: "sprite.animation" }>["value"];
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
      const store = registry.get(entry.component);
      if (!store) return;
      const override = placement.components?.[entry.component];
      store.set(entity, cloneValue(override ?? entry.value));
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
