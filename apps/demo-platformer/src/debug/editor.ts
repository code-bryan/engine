import { attachRuntimeDebugger, type DebuggerWorld } from "@engine/debugger";
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
    sections: [
      {
        title: "Actor",
        fields(_debugWorld: DebuggerWorld, entity?: number) {
          return [
            { label: "Facing", value: entity === undefined ? "-" : facings.get(entity) ?? "-" },
            { label: "State", value: entity === undefined ? "-" : actorStates.get(entity) ?? "-" },
          ];
        },
      },
      {
        title: "Motion",
        fields(_debugWorld: DebuggerWorld, entity?: number) {
          const velocity = entity === undefined ? undefined : velocities.get(entity);
          return [
            {
              label: "Velocity",
              value: formatNumber(velocity?.x),
              secondary: formatNumber(velocity?.y),
            },
          ];
        },
      },
      {
        title: "Gameplay",
        fields(_debugWorld: DebuggerWorld, entity?: number) {
          const player = entity === undefined ? undefined : players.get(entity);
          const enemy = entity === undefined ? undefined : enemies.get(entity);
          return [
            { label: "Player", value: player ? `speed=${player.speed}` : "-" },
            { label: "Enemy", value: enemy ? `speed=${enemy.speed}` : "-" },
          ];
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
