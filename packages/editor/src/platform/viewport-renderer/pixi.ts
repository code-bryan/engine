// The one and only editor module that touches Pixi. Implements the
// EditorViewportRenderer port over an EngineApplication's Pixi stage. Everything
// Pixi-specific — the overlay Graphics layer, entity Text labels, stage camera
// transform, texture filtering, background/resolution save+restore — lives here.
//
// See MEMORY: isolate-rendering-for-3d.

import { sprites, type EngineApplication } from "@engine/renderer";
import { Graphics, Text, type TextureSource, type SCALE_MODE } from "pixi.js";
import type { Camera, DrawList, EditorViewportRenderer, Point } from "./port";

const LABEL_STYLE = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 10,
  fill: 0xffffff,
  stroke: { color: 0x000000, width: 2 },
} as const;

export function createPixiViewportRenderer(
  engine: EngineApplication,
  viewport: HTMLElement,
): EditorViewportRenderer {
  const overlay = new Graphics();
  overlay.eventMode = "none";
  engine.app.stage.addChild(overlay);

  const labels = new Map<number, Text>();

  // Save original surface state so destroy() can restore the shipped game look.
  const gameW = engine.app.renderer.width;
  const gameH = engine.app.renderer.height;
  const origBg = engine.app.renderer.background.color;
  const origScaleModes = new Map<TextureSource, SCALE_MODE>();

  const toCanvas = (clientX: number, clientY: number): Point => {
    const canvas = engine.app.canvas;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  return {
    get width() {
      return engine.app.renderer.width;
    },
    get height() {
      return engine.app.renderer.height;
    },
    get canvas() {
      return engine.app.canvas;
    },

    applyCamera(camera: Camera) {
      engine.app.stage.scale.set(camera.zoom);
      engine.app.stage.position.set(camera.x, camera.y);
    },

    paintOverlay(commands: DrawList) {
      overlay.clear();
      const seen = new Set<number>();
      for (const cmd of commands) {
        switch (cmd.kind) {
          case "line":
            overlay.moveTo(cmd.x1, cmd.y1).lineTo(cmd.x2, cmd.y2).stroke(cmd.stroke);
            break;
          case "path": {
            const [x0, y0, ...rest] = cmd.points;
            overlay.moveTo(x0, y0);
            for (let i = 0; i < rest.length; i += 2) overlay.lineTo(rest[i], rest[i + 1]);
            overlay.stroke(cmd.stroke);
            break;
          }
          case "rect":
            overlay.rect(cmd.x, cmd.y, cmd.width, cmd.height);
            if (cmd.fill) overlay.fill(cmd.fill);
            if (cmd.stroke) overlay.stroke(cmd.stroke);
            break;
          case "circle":
            overlay.circle(cmd.x, cmd.y, cmd.radius);
            if (cmd.fill) overlay.fill(cmd.fill);
            if (cmd.stroke) overlay.stroke(cmd.stroke);
            break;
          case "poly":
            overlay.poly(cmd.points);
            if (cmd.fill) overlay.fill(cmd.fill);
            if (cmd.stroke) overlay.stroke(cmd.stroke);
            break;
          case "label": {
            seen.add(cmd.entity);
            let label = labels.get(cmd.entity);
            if (!label) {
              label = new Text({ text: cmd.text, style: { ...LABEL_STYLE } });
              labels.set(cmd.entity, label);
              overlay.parent?.addChild(label);
            } else {
              label.text = cmd.text;
            }
            label.position.set(cmd.x, cmd.y);
            label.visible = true;
            break;
          }
        }
      }
      // Drop labels not emitted this frame (toggled off, entity destroyed, ...).
      for (const [entity, label] of labels) {
        if (seen.has(entity)) continue;
        label.destroy();
        labels.delete(entity);
      }
    },

    screenToCanvas: toCanvas,

    screenToWorld(clientX: number, clientY: number): Point {
      const stage = engine.app.stage;
      const pt = toCanvas(clientX, clientY);
      return {
        x: (pt.x - stage.position.x) / stage.scale.x,
        y: (pt.y - stage.position.y) / stage.scale.y,
      };
    },

    setPixelFiltering() {
      for (const [, spriteRef] of sprites) {
        const src = spriteRef.sprite.texture.source;
        if (!origScaleModes.has(src)) origScaleModes.set(src, src.scaleMode);
        src.scaleMode = "nearest";
      }
    },

    resize(width: number, height: number) {
      if (width > 0 && height > 0) engine.app.renderer.resize(width, height);
    },

    setBackground(color: number) {
      engine.app.renderer.background.color = color;
    },

    getViewportRect(): DOMRect {
      const stage = document.querySelector(".debugger-stage");
      if (stage instanceof HTMLElement) return stage.getBoundingClientRect();
      return viewport.getBoundingClientRect();
    },

    destroy() {
      overlay.destroy();
      for (const label of labels.values()) label.destroy();
      labels.clear();
      engine.app.renderer.resize(gameW, gameH);
      engine.app.renderer.background.color = origBg;
      for (const [src, mode] of origScaleModes) src.scaleMode = mode;
      engine.app.stage.scale.set(1, 1);
      engine.app.stage.position.set(0, 0);
    },
  };
}
