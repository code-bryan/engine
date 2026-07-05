import { attachRuntimeDebugger, createStoreInspector, type DebuggerWorld } from "@engine/debugger";
import type { EngineApplication } from "@engine/renderer";
import { actorStates, enemies, facings, players, velocities } from "../components";
import type { GameWorld } from "../app";

export type DebugEditorPlayback = {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onStep: () => void;
  getState: () => "playing" | "paused" | "stopped";
};

export function attachDebugEditor(world: GameWorld, engine: EngineApplication, playback: DebugEditorPlayback) {
  return attachRuntimeDebugger(world, engine, {
    playback,
    trackedStores: [
      { label: "velocity", store: velocities },
      { label: "player", store: players },
      { label: "enemy", store: enemies },
      { label: "state", store: actorStates },
      { label: "facing", store: facings },
    ],
    getEntityTitle(debugWorld: DebuggerWorld, entity: number) {
      const tag = debugWorld.tags.list(entity)[0] ?? "entity";
      return `${tag.slice(0, 1).toUpperCase()}${tag.slice(1)}_${entity}`;
    },
    components: [
      createStoreInspector({
        id: "facing",
        title: "Facing",
        store: facings,
        fields(value) {
          return [{ label: "Value", value }];
        },
      }),
      createStoreInspector({
        id: "actor-state",
        title: "Actor State",
        store: actorStates,
        fields(value) {
          return [{ label: "Value", value }];
        },
      }),
      createStoreInspector({
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
      createStoreInspector({
        id: "player",
        title: "Player",
        store: players,
        fields(value) {
          return [
            { label: "Speed", value: formatNumber(value.speed) },
            { label: "Spawn X", value: formatNumber(value.spawnX) },
            { label: "Spawn Y", value: formatNumber(value.spawnY) },
          ];
        },
      }),
      createStoreInspector({
        id: "enemy",
        title: "Enemy",
        store: enemies,
        fields(value) {
          return [
            { label: "Speed", value: formatNumber(value.speed) },
            { label: "Spawn X", value: formatNumber(value.spawnX) },
            { label: "Spawn Y", value: formatNumber(value.spawnY) },
          ];
        },
      }),
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
