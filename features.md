# Debugger Feature Backlog

This file tracks debugger work that is still missing or incomplete after the current implementation.

## Already Implemented

### Core Layout
- Full-screen debugger mode — app shell takes over the full viewport with `position: fixed`
- Game canvas fills the viewport via `position: absolute; inset: 0` on game-frame
- Floating panel layout overlaid on top with `pointer-events: none` grid, panels re-enable pointer events
- Top toolbar, left panel, right panel, bottom panel

### Toolbar
- Three-column layout: Debug menu (left) | playback controls (center) | zoom + camera (right)
- Playback buttons: play, pause, step, restart — active state highlighted on the current state instead of a text badge
- Debug dropdown menu (opens downward, closes on outside click):
  - Grid toggle
  - Physics overlay toggle
  - Labels toggle
  - Sprite Bounds toggle
- Zoom + camera group (single pill):
  - Zoom out (−)
  - Zoom level display (click resets to 100%)
  - Zoom in (+)
  - Fit to viewport
  - Separator
  - Reset camera
  - Lock camera to selected entity

### Camera Tools
- Pan with middle mouse button (drag)
- Zoom to cursor with scroll wheel (zoom range 0.1×–20×)
- Zoom display updates live on wheel scroll
- Camera fit on attach — game viewport centered at 72% scale
- Camera reset button — recenters and resets zoom
- Lock to entity — camera follows selected entity each frame, pan disabled while locked
- Canvas click picks entity under cursor (inverse camera transform to world space)

### Viewport & Rendering
- Renderer resized to full viewport via ResizeObserver, recenters on resize
- Pixel-perfect sprite rendering — `scaleMode = "nearest"` on all texture sources when debugger is active, restored on destroy
- Pixi background color matches engine dark theme (`0x09090b`)
- Game starts paused when debugger attaches (via `queueMicrotask`)
- Game viewport border indicator drawn in Pixi overlay (shows 1:1 game bounds)

### Grid
- Grid defined as `game-frame::after` in `index.html` — big boxes only (64px), no small subdivision
- Toggle via `app-shell--debug-grid-off` class on shell → `display: none` on `game-frame::after`

### Entity Panel (right)
- Entity list with search/filter
- Selected entity highlighted, auto-scrolls into view
- Click entity to select

### Inspector Panel (right)
- Collapsible component cards
- Search/filter fields
- Built-in cards: Entity, Transform, Physics
- Editable fields for Transform (x, y, scale, rotation)
- Auto-discovered component cards from global registry
- Custom inspector cards registered per game
- Demo cards: Facing, Actor State, Velocity (editable), Player (editable), Enemy (editable), Collisions
- Collision history, contact normals, touching entities with clickable links

### Left Panel
- Input status panel (held keys, pressed, released, pointer position and state)
- Snapshots: save up to 5 world snapshots, restore by frame
- Systems list with enable/disable toggle and per-system timing (current / avg / peak)

### Bottom Panel
- Event log with category filters: entity, tag, collision, physics, store, system
- Pause/resume log
- Repeated events collapsed with count badge
- Color-coded by category

### FPS / Frame HUD
- Overlay in top-left of game frame showing FPS and MS

### Sprite Debug Overlay
- Physics body boxes with color by kind (dynamic / kinematic / static)
- Selected body highlighted in amber
- Velocity arrow on dynamic bodies
- Entity labels above bodies
- Sprite bounds boxes (cyan)
- Anchor/pivot crosshair (yellow)
- Correct bounds when sprite faces left (scaleX < 0)

### Snapshots
- Capture full world snapshot (all component stores + physics positions/velocities)
- Restore snapshot — resets all stores and physics bodies to saved state

### Cleanup on Destroy
- Renderer resized back to original game resolution
- Background color restored
- Texture scale modes restored
- Stage position and scale reset to identity
- All event listeners removed
- ResizeObserver disconnected

---

## High Priority Missing Features

- Real component registry across the engine
  - Right now components are still registered manually per game.
  - Goal: register component stores once and let the debugger discover them automatically.

- Runtime editing feedback
  - Edited values should visually confirm update
  - Invalid input should be rejected or highlighted
  - Optional reset-to-default for editable fields

- Entity cleanup and consistency
  - Destroyed entities should also clean all related component stores
  - Debugger should not need to guess stale data state

## Medium Priority Missing Features

- Better physics debug
  - Body sleep / active state
  - Render order / z-index

- Better inspector UI
  - Reorder cards
  - Pin frequently used components

## Lower Priority / Nice To Have

- World editing tools
  - Drag entities in viewport
  - Spawn / delete entities from debugger
  - Edit tags directly

- Breakpoint-style debugging
  - Pause on collision
  - Pause on entity spawn/destroy
  - Pause on component change

- Input recording and playback

- Persisted debugger preferences
  - Remember panel visibility
  - Remember toggles
  - Remember last selected entity
