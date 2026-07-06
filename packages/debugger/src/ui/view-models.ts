import type { Entity } from "@engine/ecs-core";
import { createElement } from "react";
import type { Root } from "react-dom/client";
import {
  DebuggerUi,
  type DebuggerEntityItemView,
  type DebuggerFieldView,
  type DebuggerInspectorCardView,
  type DebuggerLogEntryView,
  type DebuggerSnapshotView,
  type DebuggerStatusCardView,
  type DebuggerSystemView,
} from "./debugger-ui";
import { buildInspectorCards } from "../inspectors";
import type {
  DebugInspectorComponent,
  DebugState,
  DebugStatusPanel,
  EditorToolMode,
  DebuggerWorld,
  FrameMetric,
  LogCategory,
  RuntimeDebuggerOptions,
} from "../shared/types";

export type DebuggerUiActions = {
  toggleDebugMenu: () => void;
  closeMenus: () => void;
  toggleGrid: () => void;
  togglePhysics: () => void;
  toggleLabels: () => void;
  toggleSprites: () => void;
  toggleCameraLock: () => void;
  setToolMode: (mode: EditorToolMode) => void;
  playback: (action: "play" | "pause" | "step" | "stop") => void;
  zoom: (action: "zoom-in" | "zoom-out" | "zoom-100" | "zoom-fit" | "camera-reset") => void;
  setEntityQuery: (value: string) => void;
  setInspectorQuery: (value: string) => void;
  selectEntity: (entity: number) => void;
  toggleComponentCollapse: (id: string) => void;
  editInspector: (entity: number, componentId: string, key: string, value: string) => void;
  saveSnapshot: () => void;
  restoreSnapshot: (index: number) => void;
  toggleSystem: (index: number) => void;
  toggleLogFilter: (cat: string) => void;
  toggleLogPause: () => void;
  openLevel: () => void;
  toggleContentDrawer: () => void;
  loadWorld: (name: string) => void;
};

export function renderDebuggerUi<TWorld extends DebuggerWorld>(
  root: Root,
  world: TWorld,
  state: DebugState,
  components: DebugInspectorComponent<TWorld>[],
  options: RuntimeDebuggerOptions<TWorld>,
  actions: DebuggerUiActions,
  logCategories: readonly LogCategory[],
) {
  root.render(createElement(DebuggerUi, {
    fps: state.fps.toFixed(1),
    frameMs: state.latestFrameMs.toFixed(2),
    playbackState: options.playback?.getState?.() ?? "playing",
    zoomLabel: `${Math.round(state.camera.zoom * 100)}%`,
    showGrid: state.showGrid,
    showPhysics: state.showPhysics,
    showLabels: state.showLabels,
    showSprites: state.showSprites,
    cameraLocked: state.lockTarget !== undefined,
    debugMenuOpen: state.openDropdown === "debug",
    toolMode: state.toolMode,
    entityQuery: state.entityQuery,
    inspectorQuery: state.inspectorQuery,
    statusCards: buildStatusCards(world, options.statusPanels ?? []),
    entities: buildEntityItems(world, state, options.getEntityTitle),
    inspectorCards: buildInspectorCards(world, state, components, options),
    snapshots: buildSnapshotViews(state),
    systems: buildSystemViews(world, state.systemMetrics, state.systemTimingHistory),
    logs: buildLogEntries(state),
    logFilters: logCategories.map((cat) => ({ cat, active: state.logFilter.has(cat) })),
    logPaused: state.logPaused,
    onToggleDebugMenu: actions.toggleDebugMenu,
    onCloseMenus: actions.closeMenus,
    onToggleGrid: actions.toggleGrid,
    onTogglePhysics: actions.togglePhysics,
    onToggleLabels: actions.toggleLabels,
    onToggleSprites: actions.toggleSprites,
    onToggleCameraLock: actions.toggleCameraLock,
    onSetToolMode: actions.setToolMode,
    onPlaybackAction: actions.playback,
    onZoomAction: actions.zoom,
    onEntityQueryChange: actions.setEntityQuery,
    onInspectorQueryChange: actions.setInspectorQuery,
    onSelectEntity: actions.selectEntity,
    onToggleComponentCollapse: actions.toggleComponentCollapse,
    onInspectorEdit: actions.editInspector,
    onSaveSnapshot: actions.saveSnapshot,
    onRestoreSnapshot: actions.restoreSnapshot,
    onToggleSystem: actions.toggleSystem,
    onToggleLogFilter: actions.toggleLogFilter,
    onToggleLogPause: actions.toggleLogPause,
    onOpenLevel: actions.openLevel,
    contentDrawerOpen: state.contentDrawerOpen,
    contentTree: options.contentTree ?? [],
    activeWorld: options.activeWorld,
    onLoadWorld: actions.loadWorld,
    onToggleContentDrawer: actions.toggleContentDrawer,
    onCreateFolder: options.onCreateFolder,
    onCreateWorld: options.onCreateWorld ?? (() => {}),
    onCreateComponent: options.onCreateComponent,
  }));
}

export function buildStatusCards<TWorld extends DebuggerWorld>(
  world: TWorld,
  panels: DebugStatusPanel<TWorld>[],
): DebuggerStatusCardView[] {
  return panels.flatMap((panel) => {
    const fields = panel.fields(world);
    if (fields.length === 0) return [];
    return [{
      title: panel.title,
      fields: fields.map((field) => ({
        label: field.label,
        value: field.secondary === undefined ? field.value : `${field.value}, ${field.secondary}`,
      })),
    }];
  });
}

export function buildEntityItems<TWorld extends DebuggerWorld>(
  world: TWorld,
  state: DebugState,
  getEntityTitle?: (world: TWorld, entity: Entity) => string,
): DebuggerEntityItemView[] {
  const query = state.entityQuery.trim().toLowerCase();
  return Array.from(world.entities)
    .filter((entity) => {
      const title = getEntityTitle?.(world, entity) ?? entityListTitle(world, entity);
      const tags = world.tags.list(entity).join(" ");
      return `${title} ${tags} ${entity}`.toLowerCase().includes(query);
    })
    .map((entity) => ({
      entity,
      title: getEntityTitle?.(world, entity) ?? entityListTitle(world, entity),
      tag: world.tags.list(entity)[0] ?? "entity",
      selected: entity === state.selectedEntity,
    }));
}

export function buildSnapshotViews(state: DebugState): DebuggerSnapshotView[] {
  return state.snapshots.map((snapshot, index) => ({
    index,
    frame: snapshot.frame,
    entityCount: snapshot.entities.size,
  }));
}

export function buildSystemViews<TWorld extends DebuggerWorld>(
  world: TWorld,
  metrics: FrameMetric[],
  history: Map<string, number[]>,
): DebuggerSystemView[] {
  const entries = world.getSystemEntries();
  const metricByLabel = new Map(metrics.map((metric) => [metric.label, metric]));

  return entries.map((entry, index) => {
    const metric = metricByLabel.get(entry.label);
    const hist = history.get(entry.label) ?? [];
    const cur = metric ? metric.durationMs : null;
    const avg = hist.length > 0 ? hist.reduce((a, b) => a + b, 0) / hist.length : null;
    const peak = hist.length > 0 ? Math.max(...hist) : null;
    return {
      index,
      label: entry.label,
      enabled: entry.enabled,
      timing: !entry.enabled ? "off"
        : cur === null ? "—"
        : `${cur.toFixed(2)} / ${avg?.toFixed(2) ?? "—"} / ${peak?.toFixed(2) ?? "—"}`,
    };
  });
}

export function buildLogEntries(state: DebugState): DebuggerLogEntryView[] {
  return state.eventLog.filter((entry) => state.logFilter.has(entry.cat));
}

export function toInspectorFieldView(
  componentId: string,
  entity: Entity,
  field: { label: string; value: string; editable?: boolean; editKey?: string; selectEntity?: number; selectEntities?: number[] },
): DebuggerFieldView {
  return {
    label: field.label,
    value: field.value,
    editable: field.editable,
    componentId,
    editKey: field.editKey,
    entity,
    selectEntity: field.selectEntity,
    selectEntities: field.selectEntities,
  };
}

function entityListTitle<TWorld extends DebuggerWorld>(world: TWorld, entity: Entity) {
  const firstTag = world.tags.list(entity)[0] ?? "entity";
  return `#${entity} ${firstTag}`;
}
