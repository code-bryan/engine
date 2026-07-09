// Rendering-backend boundary for the editor viewport.
//
// The editor never talks to a concrete graphics library directly. It builds a
// backend-agnostic draw-list (world-space primitives) and hands it to an
// `EditorViewportRenderer`, which paints it however its backend sees fit. Camera
// application, screen<->world conversion, pixel filtering and teardown all live
// behind this interface too. The only concrete implementation today is the Pixi
// adapter (`./pixi.ts`); a future 3D backend is a new adapter, not a rewrite.
//
// See MEMORY: isolate-rendering-for-3d — only the adapter may import a graphics lib.

export type Camera = { x: number; y: number; zoom: number };
export type Point = { x: number; y: number };

export type Stroke = { color: number; width: number; alpha?: number };
export type Fill = { color: number; alpha?: number };

// Every command is expressed in world space. The renderer is responsible for
// applying the camera transform so these coordinates land on screen correctly.
export type DrawCommand =
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; stroke: Stroke }
  | { kind: "path"; points: number[]; stroke: Stroke } // open polyline: [x0,y0,x1,y1,...]
  | { kind: "rect"; x: number; y: number; width: number; height: number; stroke?: Stroke; fill?: Fill }
  | { kind: "circle"; x: number; y: number; radius: number; stroke?: Stroke; fill?: Fill }
  | { kind: "poly"; points: number[]; fill?: Fill; stroke?: Stroke } // closed polygon
  | { kind: "label"; entity: number; text: string; x: number; y: number };

export type DrawList = DrawCommand[];

export interface EditorViewportRenderer {
  /** Native pixel size of the drawing surface. */
  readonly width: number;
  readonly height: number;
  /** The DOM surface the backend renders into (pointer/wheel listeners attach here). */
  readonly canvas: HTMLCanvasElement;

  /** Position/scale the scene for the given camera. */
  applyCamera(camera: Camera): void;
  /** Repaint the overlay layer with the given world-space commands (replaces prior contents). */
  paintOverlay(commands: DrawList): void;

  /** Convert a browser client point to world coordinates. */
  screenToWorld(clientX: number, clientY: number): Point;
  /** Convert a browser client point to native surface coordinates. */
  screenToCanvas(clientX: number, clientY: number): Point;

  /** Use nearest-neighbour filtering so zoomed pixel art stays crisp. */
  setPixelFiltering(): void;
  /** Resize the drawing surface. */
  resize(width: number, height: number): void;
  /** Set the surface background color (0xRRGGBB). */
  setBackground(color: number): void;
  /** Bounding rect of the on-screen viewport (falls back to the stage element). */
  getViewportRect(): DOMRect;

  /** Restore the surface to its pre-editor state and release resources. */
  destroy(): void;
}
