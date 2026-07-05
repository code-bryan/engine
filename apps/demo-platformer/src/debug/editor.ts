import { attachRuntimeDebugger, createStoreInspector, type DebuggerWorld } from "@engine/debugger";
import { keyboard, pointer } from "@engine/input";
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
      createStoreInspector({
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
          if (!body && touching.length === 0) return [];

          return [
            { label: "Active", value: body?.isColliding ? "yes" : "no" },
            { label: "Count", value: String(touching.length) },
            touching.length === 0
              ? { label: "Touching", value: "-" }
              : { label: "Touching", value: touching.map((other) => `#${other}`).join(", "), selectEntities: touching },
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
