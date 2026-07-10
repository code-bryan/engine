// Orchestrates the full editor overlay into a single world-space draw-list:
// grid, game bounds, physics bodies + velocity arrows, entity labels, sprite
// bounds, and the selection outline / transform gizmo. Pure — no Pixi.

import type { Entity } from "@engine/ecs-core";
import { sprites, transforms } from "@engine/renderer";
import type { DrawCommand, DrawList } from "../../platform/viewport-renderer/port";
import type { DebugState, DebuggerWorld } from "../../shared/types";
import { buildEditorGizmo, buildSelectionOutline } from "./gizmo";
import { buildWorldGrid } from "./grid";

export function buildOverlay<TWorld extends DebuggerWorld>(
  world: TWorld,
  state: DebugState,
  getEntityTitle: ((world: TWorld, entity: Entity) => string) | undefined,
  gameW?: number,
  gameH?: number,
  viewportW?: number,
  viewportH?: number,
): DrawList {
  const out: DrawCommand[] = [];

  if (state.showGrid) out.push(...buildWorldGrid(state.camera, state.snapGridSize, viewportW, viewportH));

  if (gameW && gameH) {
    out.push({ kind: "rect", x: 0, y: 0, width: gameW, height: gameH, stroke: { color: 0x3f3f46, width: 1, alpha: 0.8 } });
  }

  const gizmo = () => {
    if (state.selectedEntity === undefined) return;
    out.push(...(state.toolMode === "select"
      ? buildSelectionOutline(world, state.selectedEntity, state.camera.zoom)
      : buildEditorGizmo(world, state.selectedEntity, state.toolMode, state.camera.zoom)));
  };

  const shouldRenderSceneDebug = Boolean(state.showPhysics || state.showLabels || state.showSprites);
  if (!shouldRenderSceneDebug) {
    gizmo();
    return out;
  }

  for (const body of world.physics.getDebugBodies()) {
    const isSelected = body.entity === state.selectedEntity;
    const cx = body.x + body.width / 2;
    const cy = body.y + body.height / 2;

    if (state.showPhysics) {
      const color = isSelected ? 0xf59e0b : colorForBodyKind(body.kind);
      out.push({ kind: "rect", x: body.x, y: body.y, width: body.width, height: body.height, stroke: { color, width: isSelected ? 2 : 1, alpha: 0.95 } });
      out.push({ kind: "circle", x: cx, y: cy, radius: 2, fill: { color, alpha: 0.9 } });

      const rigidBody = world.physics.rigidBodies.get(body.entity);
      if (rigidBody) {
        const vx = rigidBody.body.velocity.x;
        const vy = rigidBody.body.velocity.y;
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > 0.1) {
          const scale = 30;
          const tx = cx + vx * scale;
          const ty = cy + vy * scale;
          const arrowColor = isSelected ? 0xf59e0b : 0xffffff;
          const arrowStroke = { color: arrowColor, width: 1.5, alpha: 0.85 };
          const angle = Math.atan2(vy, vx);
          const headLen = 5;
          out.push({ kind: "line", x1: cx, y1: cy, x2: tx, y2: ty, stroke: arrowStroke });
          out.push({ kind: "line", x1: tx, y1: ty, x2: tx - headLen * Math.cos(angle - 0.5), y2: ty - headLen * Math.sin(angle - 0.5), stroke: arrowStroke });
          out.push({ kind: "line", x1: tx, y1: ty, x2: tx - headLen * Math.cos(angle + 0.5), y2: ty - headLen * Math.sin(angle + 0.5), stroke: arrowStroke });
        }
      }
    }

    if (state.showLabels) {
      out.push({ kind: "label", entity: body.entity, text: getEntityTitle?.(world, body.entity) ?? entityTitle(world, body.entity), x: body.x, y: body.y - 12 });
    }
  }

  if (state.showSprites) {
    for (const [entity, spriteRef] of sprites) {
      const t = transforms.get(entity);
      if (!t) continue;
      const { sprite, offset, anchor } = spriteRef;
      const scaleX = t.scale.x;
      const scaleY = t.scale.y;
      const w = sprite.texture.width * Math.abs(scaleX);
      const h = sprite.texture.height * Math.abs(scaleY);
      const posX = t.position.x + offset.x;
      const posY = t.position.y + offset.y;
      const bx = posX - (scaleX < 0 ? (1 - anchor.x) : anchor.x) * w;
      const by = posY - (scaleY < 0 ? (1 - anchor.y) : anchor.y) * h;
      const cs = 4;
      out.push({ kind: "rect", x: bx, y: by, width: w, height: h, stroke: { color: 0x06b6d4, width: 1, alpha: 0.7 } });
      out.push({ kind: "line", x1: posX - cs, y1: posY, x2: posX + cs, y2: posY, stroke: { color: 0xfbbf24, width: 1.5, alpha: 0.9 } });
      out.push({ kind: "line", x1: posX, y1: posY - cs, x2: posX, y2: posY + cs, stroke: { color: 0xfbbf24, width: 1.5, alpha: 0.9 } });
    }
  }

  gizmo();
  return out;
}

function entityTitle<TWorld extends DebuggerWorld>(world: TWorld, entity: Entity) {
  const firstTag = world.tags.list(entity)[0] ?? "entity";
  return `${firstTag}_${entity}`;
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
