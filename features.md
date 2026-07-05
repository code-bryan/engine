# Debugger Feature Backlog

This file tracks debugger work that is still missing or incomplete after the current implementation.

## Already Implemented

- Centered viewport with debugger layout around it
- Top toolbar with play, pause, step, restart
- Page grid and viewport grid
- Toggle buttons for grid, physics boxes, labels
- Entity list with selection
- Physics overlay and labels
- FPS / MS HUD in viewport
- Event log
- System timings list
- Inspector component registry
- Built-in inspector cards for `Entity`, `Transform`, `Physics`
- Demo inspector cards for `Facing`, `Actor State`, `Velocity`, `Player`, `Enemy`, `Collisions`
- Editable inspector fields for:
  - `Transform`
  - `Velocity`
  - `Player`
  - `Enemy`
- Clickable collision targets and entity id links
- Input panel with active pressed keys

## High Priority Missing Features

- Real component registry across the engine
  - Right now components are still registered manually per game.
  - Goal: register component stores once and let the debugger discover them automatically.

- Better input debugging
  - Show `pressed this frame`
  - Show `released this frame`
  - Show pointer position
  - Show pointer button state
  - Show last input events

- Better collision details
  - Show collision history, not only current contacts
  - Show contact normals / points if available
  - Show selected entity collision timeline

- Runtime editing feedback
  - Edited values should visually confirm update
  - Invalid input should be rejected or highlighted
  - Optional reset-to-default for editable fields

- Entity cleanup and consistency
  - Destroyed entities should also clean all related component stores
  - Debugger should not need to guess stale data state

## Medium Priority Missing Features

- System controls
  - Enable / disable individual systems
  - Show persistent timing history, not only latest frame
  - Show average / peak times

- Better event log
  - Filters by type
  - Pause / resume log
  - Collapse repeated spam
  - Color coding per event category

- Better selection UX
  - Stronger selected entity highlight
  - Selected row auto-scroll into view
  - Optional focus camera on selected entity

- Better inspector UI
  - Collapsible component cards
  - Reorder cards
  - Read-only vs editable visual distinction
  - Search inside inspector

- Better physics debug
  - Velocity vectors
  - Direction arrows
  - Body centers / anchors
  - Sleep / active state

- Better render debug
  - Sprite bounds
  - Anchor / pivot visualization
  - Render order / z-index
  - Visibility / culling state

## Lower Priority / Nice To Have

- Snapshots and replay
  - Save world snapshot
  - Restore snapshot
  - Input recording and playback

- Camera tools
  - Pan / zoom debugger camera
  - Lock camera to entity

- World editing tools
  - Drag entities in viewport
  - Spawn / delete entities from debugger
  - Edit tags directly

- Breakpoint-style debugging
  - Pause on collision
  - Pause on entity spawn/destroy
  - Pause on component change

- Persisted debugger preferences
  - Remember panel visibility
  - Remember toggles
  - Remember last selected entity

## Suggested Next Order

1. Improve input debug panel
2. Add system enable / disable
3. Add event log filters
4. Add richer collision details
5. Add component auto-registration
6. Add snapshots / replay
