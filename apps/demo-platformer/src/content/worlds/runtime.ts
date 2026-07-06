import { transforms, type TransformScale } from "@engine/renderer";
import type { WorldData, WorldEntityBase } from "@engine/debugger";
import type { GameWorld } from "../../app";
import { enemies, players } from "../components";
import { EnemyPrefab, PlayerPrefab } from "../prefabs";
export type DemoWorldEntityKind = "player" | "enemy";

export type DemoWorldEntity = WorldEntityBase & {
  kind: DemoWorldEntityKind;
  speed?: number;
  spawnX?: number;
  spawnY?: number;
};

export type DemoWorldData = WorldData<DemoWorldEntity>;

export type DemoContentNode = {
  name: string;
  path: string;
  kind: "folder" | "world" | "file";
  children?: DemoContentNode[];
};

export async function loadWorldDefinition(name: string): Promise<DemoWorldData> {
  const stored = readStoredWorld(name);
  if (stored) return stored;

  try {
    const res = await fetch(`/api/world?path=${encodeURIComponent(name)}`);
    if (res.ok) {
      const fromFile = parseDemoWorldData(await res.json());
      if (fromFile) return fromFile;
    }
  } catch {}

  return { version: 1, entities: [] };
}

export async function saveWorldDefinition(name: string, world: DemoWorldData): Promise<void> {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(world, null, 2);
  window.localStorage.setItem(storageKey(name), json);
  try {
    await fetch(`/api/world?path=${encodeURIComponent(name)}`, {
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

export async function materializeWorld(world: GameWorld, data: DemoWorldData) {
  for (const entity of data.entities) {
    if (entity.kind === "player") {
      await PlayerPrefab(world, entity);
      continue;
    }
    await EnemyPrefab(world, entity);
  }
}

export function serializeWorld(world: GameWorld): DemoWorldData {
  const entities: DemoWorldEntity[] = [];

  for (const entity of Array.from(world.entities as Iterable<number>).sort((left, right) => left - right)) {
    const transform = transforms.get(entity);
    if (!transform) continue;

    const scale = normalizeScale(transform.scale);

    const player = players.get(entity);
    if (player) {
      entities.push({
        kind: "player",
        x: transform.x,
        y: transform.y,
        rotation: transform.rotation ?? 0,
        scale: scale.y,
        speed: player.speed,
        spawnX: player.spawnX,
        spawnY: player.spawnY,
      });
      continue;
    }

    const enemy = enemies.get(entity);
    if (enemy) {
      entities.push({
        kind: "enemy",
        x: transform.x,
        y: transform.y,
        rotation: transform.rotation ?? 0,
        scale: scale.y,
        speed: enemy.speed,
        spawnX: enemy.spawnX,
        spawnY: enemy.spawnY,
      });
    }
  }

  return { version: 1, entities };
}

export function parseDemoWorldData(raw: unknown): DemoWorldData | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as { version?: unknown; entities?: unknown };
  if (parsed.version !== 1 || !Array.isArray(parsed.entities)) return null;
  return {
    version: 1,
    entities: parsed.entities.filter(isDemoWorldEntity),
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

function isDemoWorldEntity(value: unknown): value is DemoWorldEntity {
  if (!value || typeof value !== "object") return false;
  const entity = value as Partial<DemoWorldEntity>;
  return (entity.kind === "player" || entity.kind === "enemy")
    && typeof entity.x === "number"
    && typeof entity.y === "number";
}
