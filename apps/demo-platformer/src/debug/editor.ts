import { Graphics, Text } from "pixi.js";
import { facings, players, velocities, actorStates, enemies } from "../components";
import type { GameWorld } from "../app";
import type { EngineApplication } from "@engine/renderer";
import { transforms } from "@engine/renderer";

export type DebugEditor = {
  controls: {
    enabled: boolean;
    showBodies: boolean;
    showLabels: boolean;
    selectedEntity?: number;
  };
};

export function attachDebugEditor(world: GameWorld, engine: EngineApplication): DebugEditor {
  const controls = {
    enabled: true,
    showBodies: true,
    showLabels: true,
    selectedEntity: undefined as number | undefined,
  };

  const panel = document.createElement("aside");
  panel.className = "debug-panel";
  panel.innerHTML = `
    <div class="debug-panel__title">Engine Debug</div>
    <label class="debug-panel__row"><input data-debug-toggle="enabled" type="checkbox" checked /> Enabled</label>
    <label class="debug-panel__row"><input data-debug-toggle="showBodies" type="checkbox" checked /> Physics Bodies</label>
    <label class="debug-panel__row"><input data-debug-toggle="showLabels" type="checkbox" checked /> Entity Labels</label>
    <div class="debug-panel__hint">Click a body to inspect it. Press \` to toggle debug.</div>
    <pre class="debug-panel__details"></pre>
  `;
  const shell = document.querySelector(".app-shell");
  (shell ?? document.body).appendChild(panel);

  const details = panel.querySelector(".debug-panel__details");
  if (!(details instanceof HTMLPreElement)) throw new Error("debug panel details not found");

  for (const key of ["enabled", "showBodies", "showLabels"] as const) {
    const input = panel.querySelector<HTMLInputElement>(`[data-debug-toggle="${key}"]`);
    input?.addEventListener("change", () => {
      controls[key] = input.checked;
    });
  }

  const overlay = new Graphics();
  overlay.eventMode = "none";
  engine.app.stage.addChild(overlay);

  const labels = new Map<number, Text>();

  engine.app.canvas.addEventListener("click", (event) => {
    const rect = engine.app.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (engine.app.canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (engine.app.canvas.height / rect.height);
    controls.selectedEntity = world.physics.pickEntityAt({ x, y });
  });

  window.addEventListener("keydown", (event) => {
    if (event.code !== "Backquote") return;
    controls.enabled = !controls.enabled;
    const input = panel.querySelector<HTMLInputElement>("[data-debug-toggle=\"enabled\"]");
    if (input) input.checked = controls.enabled;
  });

  world.addSystem(() => {
    overlay.visible = controls.enabled;
    panel.dataset.enabled = String(controls.enabled);

    if (!controls.enabled) {
      overlay.clear();
      for (const label of labels.values()) label.visible = false;
      details.textContent = "debug disabled";
      return;
    }

    overlay.clear();

    const debugBodies = world.physics.getDebugBodies();
    const active = new Set(debugBodies.map((body) => body.entity));

    for (const body of debugBodies) {
      if (controls.showBodies) {
        overlay.rect(body.x, body.y, body.width, body.height);
        overlay.stroke({
          width: body.entity === controls.selectedEntity ? 2 : 1,
          color: body.entity === controls.selectedEntity ? 0xffdd57 : body.isColliding ? 0xff5c5c : colorForBodyKind(body.kind),
          alpha: 1,
        });
      }

      let label = labels.get(body.entity);
      if (!label) {
        label = new Text({
          text: "",
          style: {
            fill: 0xffffff,
            fontSize: 10,
          },
        });
        label.eventMode = "none";
        labels.set(body.entity, label);
        engine.app.stage.addChild(label);
      }

      label.visible = controls.showLabels;
      if (!controls.showLabels) continue;
      label.text = `#${body.entity} ${world.tags.list(body.entity).join(",")}`;
      label.position.set(body.x, Math.max(0, body.y - 12));
    }

    for (const [entity, label] of labels) {
      if (!active.has(entity)) label.visible = false;
    }

    details.textContent = formatSelectedEntity(world, controls.selectedEntity);
  });

  return { controls };
}

function colorForBodyKind(kind: "dynamic" | "kinematic" | "static") {
  switch (kind) {
    case "dynamic":
      return 0x45d483;
    case "kinematic":
      return 0x4dabf7;
    case "static":
      return 0xa78bfa;
  }
}

function formatSelectedEntity(world: GameWorld, entity?: number) {
  if (entity === undefined) return "selection: none";

  const transform = transforms.get(entity);
  const velocity = velocities.get(entity);
  const facing = facings.get(entity);
  const state = actorStates.get(entity);
  const body = world.physics.getDebugBodies().find((item) => item.entity === entity);
  const player = players.get(entity);
  const enemy = enemies.get(entity);

  return [
    `entity: ${entity}`,
    `tags: ${world.tags.list(entity).join(", ") || "-"}`,
    `transform: ${formatPoint(transform?.x, transform?.y)} rot=${formatNumber(transform?.rotation ?? 0)}`,
    `velocity: ${formatPoint(velocity?.x, velocity?.y)}`,
    `facing: ${facing ?? "-"}`,
    `state: ${state ?? "-"}`,
    `body: ${body ? `${body.kind} ${body.width}x${body.height}` : "-"}`,
    `player: ${player ? `speed=${player.speed}` : "-"}`,
    `enemy: ${enemy ? `speed=${enemy.speed}` : "-"}`,
  ].join("\n");
}

function formatPoint(x?: number, y?: number) {
  if (x === undefined || y === undefined) return "-";
  return `${formatNumber(x)}, ${formatNumber(y)}`;
}

function formatNumber(value: number) {
  return value.toFixed(2);
}
