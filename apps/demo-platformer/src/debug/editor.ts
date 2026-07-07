import { attachRuntimeDebugger, createStoreInspector, type ContentTreeNode, type DebugEditorField, type DebuggerWorld } from "@engine/debugger";
import { getComponentStore } from "@engine/runtime";
import { keyboard, pointer } from "@engine/input";
import type { EngineApplication } from "@engine/renderer";
import type { GameWorld } from "../app";

export type DebugEditorPlayback = {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onStep: () => void;
  getState: () => "playing" | "paused" | "stopped";
  onWorldEdited?: (world: GameWorld) => void;
  onOpenLevel?: (data: unknown) => void;
  onLoadWorld?: (name: string) => void;
  onCreateWorld?: (name: string) => void;
  onCreateFolder?: (path: string) => void;
  onCreateComponent?: (path: string) => void;
};

export type DebugEditorOptions = DebugEditorPlayback & {
  contentTree?: ContentTreeNode[];
  activeWorld?: string;
  activeSystems?: string[];
  onToggleWorldSystem?: (name: string) => void;
  initialContentDrawerOpen?: boolean;
  onContentDrawerToggled?: (open: boolean) => void;
};

export function attachDebugEditor(world: GameWorld, engine: EngineApplication, options: DebugEditorOptions) {
  const playback = options;
  const facings = getComponentStore<"left" | "right">("facing");
  const actorStates = getComponentStore<"idle" | "walk">("actor-state");
  const velocities = getComponentStore<{ x: number; y: number }>("velocity");
  const players = getComponentStore<{ speed: number; spawnX: number; spawnY: number }>("player");
  const enemies = getComponentStore<{ speed: number; spawnX: number; spawnY: number }>("enemy");
  return attachRuntimeDebugger(world, engine, {
    playback,
    onWorldEdited: playback.onWorldEdited,
    onLoadWorld: playback.onLoadWorld,
    onCreateWorld: playback.onCreateWorld,
    onCreateFolder: playback.onCreateFolder,
    onCreateComponent: playback.onCreateComponent,
    contentTree: options.contentTree,
    activeWorld: options.activeWorld,
    activeSystems: options.activeSystems,
    onToggleWorldSystem: options.onToggleWorldSystem,
    initialContentDrawerOpen: options.initialContentDrawerOpen,
    onContentDrawerToggled: options.onContentDrawerToggled,
    onOpenLevel: playback.onOpenLevel ? () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        file.text().then((text) => {
          try {
            playback.onOpenLevel!(JSON.parse(text));
          } catch {}
        });
      };
      input.click();
    } : undefined,
    grid: {
      snapSize: 16,
      majorEvery: 4,
      minMinorScreenPx: 10,
      maxMinorScreenPx: 24,
    },
    statusPanels: [
      {
        id: "input",
        title: "Input",
        fields() {
          const kb = keyboard.get(0);
          const ptr = pointer.get(0);
          const held = Array.from(kb?.keys ?? []);
          const pressed = Array.from(kb?.pressed ?? []);
          const released = Array.from(kb?.released ?? []);
          return [
            { label: "Held", value: held.length === 0 ? "-" : held.join(", ") },
            { label: "Pressed", value: pressed.length === 0 ? "-" : pressed.join(", ") },
            { label: "Released", value: released.length === 0 ? "-" : released.join(", ") },
            { label: "Pointer", value: ptr ? `${ptr.x.toFixed(0)}, ${ptr.y.toFixed(0)}` : "-" },
            { label: "Pointer btn", value: ptr ? (ptr.down ? "down" : "up") : "-" },
          ];
        },
      },
    ],
    getEntityTitle(debugWorld: DebuggerWorld, entity: number) {
      const tag = debugWorld.tags.list(entity)[0] ?? "entity";
      return `${tag.slice(0, 1).toUpperCase()}${tag.slice(1)}_${entity}`;
    },
    components: [
      createStoreInspector<"left" | "right">({
        id: "facing",
        title: "Facing",
        store: facings,
        fields(value) {
          return [{ label: "Value", value: String(value) }];
        },
      }),
      createStoreInspector<"idle" | "walk">({
        id: "actor-state",
        title: "Actor State",
        store: actorStates,
        fields(value) {
          return [{ label: "Value", value: String(value) }];
        },
      }),
      createStoreInspector<{ x: number; y: number }>({
        id: "velocity",
        title: "Velocity",
        store: velocities,
        fields(value) {
          return [
            { label: "X", value: formatNumber(value.x), editable: true, editKey: "x" },
            { label: "Y", value: formatNumber(value.y), editable: true, editKey: "y" },
          ];
        },
        set(value, key, next) {
          const numeric = Number(next);
          if (Number.isNaN(numeric)) return;
          if (key === "x") value.x = numeric;
          if (key === "y") value.y = numeric;
        },
      }),
      createStoreInspector<{ speed: number; spawnX: number; spawnY: number }>({
        id: "player",
        title: "Player",
        store: players,
        fields(value) {
          return [
            { label: "Speed", value: formatNumber(value.speed), editable: true, editKey: "speed" },
            { label: "Spawn X", value: formatNumber(value.spawnX), editable: true, editKey: "spawnX" },
            { label: "Spawn Y", value: formatNumber(value.spawnY), editable: true, editKey: "spawnY" },
          ];
        },
        set(value, key, next) {
          const numeric = Number(next);
          if (Number.isNaN(numeric)) return;
          if (key === "speed") value.speed = numeric;
          if (key === "spawnX") value.spawnX = numeric;
          if (key === "spawnY") value.spawnY = numeric;
        },
      }),
      createStoreInspector<{ speed: number; spawnX: number; spawnY: number }>({
        id: "enemy",
        title: "Enemy",
        store: enemies,
        fields(value) {
          return [
            { label: "Speed", value: formatNumber(value.speed), editable: true, editKey: "speed" },
            { label: "Spawn X", value: formatNumber(value.spawnX), editable: true, editKey: "spawnX" },
            { label: "Spawn Y", value: formatNumber(value.spawnY), editable: true, editKey: "spawnY" },
          ];
        },
        set(value, key, next) {
          const numeric = Number(next);
          if (Number.isNaN(numeric)) return;
          if (key === "speed") value.speed = numeric;
          if (key === "spawnX") value.spawnX = numeric;
          if (key === "spawnY") value.spawnY = numeric;
        },
      }),
      {
        id: "collisions",
        title: "Collisions",
        fields(debugWorld, entity) {
          const touching = debugWorld.physics.getCollidingEntities(entity);
          const body = debugWorld.physics.getDebugBody(entity);
          const history = debugWorld.physics.getCollisionHistory(entity);
          const normals = debugWorld.physics.getContactNormals(entity);
          if (!body && touching.length === 0 && history.length === 0) return [];

          const fields: DebugEditorField[] = [
            { label: "Active", value: body?.isColliding ? "yes" : "no" },
            { label: "Count", value: String(touching.length) },
            touching.length === 0
              ? { label: "Touching", value: "-" }
              : { label: "Touching", value: touching.map((other) => `#${other}`).join(", "), selectEntities: touching },
          ];

          for (const { normal, points } of normals) {
            fields.push({ label: "Normal", value: `${normal.x.toFixed(2)}, ${normal.y.toFixed(2)}  (${points.length} pt)` });
          }

          if (history.length > 0) {
            fields.push({ label: "History", value: "" });
            for (const record of history.slice(0, 6)) {
              fields.push({
                label: `  #${record.seq} ${record.type === "start" ? "▶" : "■"}`,
                value: `#${record.other}`,
                selectEntity: record.other,
              });
            }
          }

          return fields;
        },
      },
    ],
    getRuntimeDetails(debugWorld: DebuggerWorld, entity?: number) {
      if (entity === undefined) return "selection: none";
      const velocity = velocities.get(entity);
      const player = players.get(entity);
      const enemy = enemies.get(entity);
      return [
        `entity: ${entity}`,
        `tags: ${debugWorld.tags.list(entity).join(", ") || "-"}`,
        `velocity: ${formatNumber(velocity?.x)}, ${formatNumber(velocity?.y)}`,
        `facing: ${facings.get(entity) ?? "-"}`,
        `state: ${actorStates.get(entity) ?? "-"}`,
        `player: ${player ? `speed=${player.speed}` : "-"}`,
        `enemy: ${enemy ? `speed=${enemy.speed}` : "-"}`,
      ].join("\n");
    },
  });
}

function formatNumber(value?: number) {
  return value === undefined ? "-" : value.toFixed(2);
}
