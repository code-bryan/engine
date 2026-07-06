import type { Entity } from "@engine/ecs-core";
import { sprites, transforms } from "@engine/renderer";
import { Graphics, Text } from "pixi.js";
import { renderWorldGrid } from "./grid";
import { renderEditorGizmo, renderSelectionOutline } from "./gizmo";
import type { DebugGridOptions, DebugState, DebuggerWorld } from "../shared/types";

export function renderPhysicsOverlay<TWorld extends DebuggerWorld>(
  world: TWorld,
  overlay: Graphics,
  labels: Map<number, Text>,
  selectedEntity: Entity | undefined,
  getEntityTitle: ((world: TWorld, entity: Entity) => string) | undefined,
  state?: DebugState,
  gridOptions?: Required<DebugGridOptions>,
  viewportW?: number,
  viewportH?: number,
  gameW?: number,
  gameH?: number,
) {
  overlay.clear();

  if (state?.showGrid && gridOptions) {
    renderWorldGrid(overlay, state.camera, gridOptions, viewportW, viewportH);
  }

  if (gameW && gameH) {
    overlay.rect(0, 0, gameW, gameH).stroke({ color: 0x3f3f46, width: 1, alpha: 0.8 });
  }

  const liveEntities = new Set(world.entities);
  for (const [entity, label] of labels) {
    if (liveEntities.has(entity)) continue;
    label.destroy();
    labels.delete(entity);
  }

  const shouldRenderSceneDebug = Boolean(state?.showPhysics || state?.showLabels || state?.showSprites);
  if (!shouldRenderSceneDebug) {
    if (state?.selectedEntity !== undefined && state.toolMode === "select") {
      renderSelectionOutline(world, overlay, state.selectedEntity, state.camera.zoom);
    } else if (state?.selectedEntity !== undefined) {
      renderEditorGizmo(world, overlay, state.selectedEntity, state.toolMode, state.camera.zoom);
    }
    return;
  }

  for (const body of world.physics.getDebugBodies()) {
    const isSelected = body.entity === selectedEntity;
    const cx = body.x + body.width / 2;
    const cy = body.y + body.height / 2;

    if (state?.showPhysics) {
      const color = isSelected ? 0xf59e0b : colorForBodyKind(body.kind);
      overlay
        .rect(body.x, body.y, body.width, body.height)
        .stroke({ color, width: isSelected ? 2 : 1, alpha: 0.95 });

      overlay.circle(cx, cy, 2).fill({ color, alpha: 0.9 });

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
          overlay.moveTo(cx, cy).lineTo(tx, ty).stroke({ color: arrowColor, width: 1.5, alpha: 0.85 });
          const angle = Math.atan2(vy, vx);
          const headLen = 5;
          overlay
            .moveTo(tx, ty)
            .lineTo(tx - headLen * Math.cos(angle - 0.5), ty - headLen * Math.sin(angle - 0.5))
            .stroke({ color: arrowColor, width: 1.5, alpha: 0.85 });
          overlay
            .moveTo(tx, ty)
            .lineTo(tx - headLen * Math.cos(angle + 0.5), ty - headLen * Math.sin(angle + 0.5))
            .stroke({ color: arrowColor, width: 1.5, alpha: 0.85 });
        }
      }
    }

    let label = labels.get(body.entity);
    if (!state?.showLabels) {
      if (label) label.visible = false;
    } else {
      if (!label) {
        label = new Text({
          text: getEntityTitle?.(world, body.entity) ?? entityTitle(world, body.entity),
          style: {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 10,
            fill: 0xffffff,
            stroke: { color: 0x000000, width: 2 },
          },
        });
        labels.set(body.entity, label);
        overlay.parent?.addChild(label);
      }
      label.position.set(body.x, body.y - 12);
      label.visible = true;
    }
  }

  if (state?.showSprites) {
    for (const [entity, spriteRef] of sprites) {
      const t = transforms.get(entity);
      if (!t) continue;
      const { sprite, offset, anchor } = spriteRef;
      const scaleX = typeof t.scale === "number" ? t.scale : (t.scale?.x ?? 1);
      const scaleY = typeof t.scale === "number" ? t.scale : (t.scale?.y ?? 1);
      const w = sprite.texture.width * Math.abs(scaleX);
      const h = sprite.texture.height * Math.abs(scaleY);
      const posX = t.x + offset.x;
      const posY = t.y + offset.y;
      const bx = posX - (scaleX < 0 ? (1 - anchor.x) : anchor.x) * w;
      const by = posY - (scaleY < 0 ? (1 - anchor.y) : anchor.y) * h;
      overlay.rect(bx, by, w, h).stroke({ color: 0x06b6d4, width: 1, alpha: 0.7 });
      const ax = posX;
      const ay = posY;
      const cs = 4;
      overlay.moveTo(ax - cs, ay).lineTo(ax + cs, ay).stroke({ color: 0xfbbf24, width: 1.5, alpha: 0.9 });
      overlay.moveTo(ax, ay - cs).lineTo(ax, ay + cs).stroke({ color: 0xfbbf24, width: 1.5, alpha: 0.9 });
    }
  }

  if (state?.selectedEntity !== undefined && state.toolMode === "select") {
    renderSelectionOutline(world, overlay, state.selectedEntity, state.camera.zoom);
  } else if (state?.selectedEntity !== undefined) {
    renderEditorGizmo(world, overlay, state.selectedEntity, state.toolMode, state.camera.zoom);
  }
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
