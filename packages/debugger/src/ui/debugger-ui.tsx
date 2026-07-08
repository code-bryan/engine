import {
  Camera,
  Check,
  Crosshair,
  ChevronRight,
  Expand,
  FileJson,
  Folder,
  Globe,
  LocateFixed,
  MousePointer2,
  Minus,
  Pause,
  Plus,
  Play,
  Puzzle,
  Redo2,
  RotateCw,
  ScanSearch,
  StepForward,
  RefreshCw,
  Search,
  Package,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { GRAPH_NODE_LIBRARY, type GraphDefinition, type GraphNodeDefinition, type GraphNodeSpec, type GraphVariableDefinition } from "@engine/runtime";
import type { ContentTreeNode, EditorToolMode } from "../shared/types";

const GRAPH_ZOOM_SENSITIVITY = 2.5;

export type DebuggerStatusCardView = {
  title: string;
  fields: Array<{ label: string; value: string }>;
};

export type DebuggerEntityItemView = {
  entity: number;
  title: string;
  tag: string;
  selected: boolean;
};

export type DebuggerFieldView = {
  label: string;
  value: string;
  editable?: boolean;
  componentId?: string;
  editKey?: string;
  entity?: number;
  selectEntity?: number;
  selectEntities?: number[];
};

export type DebuggerInspectorCardView = {
  id: string;
  title: string;
  collapsed: boolean;
  fields: DebuggerFieldView[];
};

export type DebuggerSnapshotView = {
  index: number;
  frame: number;
  entityCount: number;
};

export type DebuggerSystemView = {
  index: number;
  label: string;
  enabled: boolean;
  timing: string;
};

export type DebuggerLogEntryView = {
  cat: string;
  text: string;
  count: number;
};

type BottomDrawerTab = "content" | "systems" | "snapshots" | "logs";

export type DebuggerUiProps = {
  fps: string;
  frameMs: string;
  playbackState: "playing" | "paused" | "stopped";
  zoomLabel: string;
  showGrid: boolean;
  showPhysics: boolean;
  showLabels: boolean;
  showSprites: boolean;
  cameraZoomSensitivity: number;
  cameraLocked: boolean;
  debugMenuOpen: boolean;
  toolMode: EditorToolMode;
  entityQuery: string;
  inspectorQuery: string;
  statusCards: DebuggerStatusCardView[];
  entities: DebuggerEntityItemView[];
  inspectorCards: DebuggerInspectorCardView[];
  snapshots: DebuggerSnapshotView[];
  systems: DebuggerSystemView[];
  logs: DebuggerLogEntryView[];
  logFilters: Array<{ cat: string; active: boolean }>;
  logPaused: boolean;
  onToggleDebugMenu: () => void;
  onCloseMenus: () => void;
  onToggleGrid: () => void;
  onTogglePhysics: () => void;
  onToggleLabels: () => void;
  onToggleSprites: () => void;
  onToggleCameraLock: () => void;
  onSetToolMode: (mode: EditorToolMode) => void;
  onPlaybackAction: (action: "play" | "pause" | "step" | "stop") => void;
  onZoomAction: (action: "zoom-in" | "zoom-out" | "zoom-100" | "zoom-fit" | "camera-reset") => void;
  onSetZoomSensitivity: (value: number) => void;
  onEntityQueryChange: (value: string) => void;
  onInspectorQueryChange: (value: string) => void;
  onSelectEntity: (entity: number) => void;
  onToggleComponentCollapse: (id: string) => void;
  onInspectorEdit: (entity: number, componentId: string, key: string, value: string) => void;
  onSaveSnapshot: () => void;
  onRestoreSnapshot: (index: number) => void;
  onToggleSystem: (index: number) => void;
  onToggleLogFilter: (cat: string) => void;
  onToggleLogPause: () => void;
  onOpenLevel?: () => void;
  contentDrawerOpen: boolean;
  contentTree: ContentTreeNode[];
  activeWorld?: string;
  activeSystems?: string[];
  onLoadWorld: (name: string) => void;
  onCreateFolder?: (path: string) => void;
  onCreateWorld: (path: string) => void;
  onCreateComponent?: (path: string) => void;
  onCreatePrefab?: (path: string) => void;
  onCreateGraph?: (path: string) => void;
  onImportContent?: (path: string, value: unknown) => void;
  onDeleteContent?: (path: string, kind: ContentTreeNode["kind"]) => void;
  onToggleContentDrawer: () => void;
};

export function DebuggerUi(props: DebuggerUiProps) {
  const selectedEntityRef = useRef<HTMLButtonElement | null>(null);
  const [stagePortal, setStagePortal] = useState<HTMLElement | null>(null);
  const [cameraTuningOpen, setCameraTuningOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<BottomDrawerTab>("content");
  const [zoomToastOpen, setZoomToastOpen] = useState(false);
  const zoomToastTimerRef = useRef<number | undefined>(undefined);
  const didMountRef = useRef(false);
  const isPlaying = props.playbackState === "playing";
  const selectedEntity = props.entities.find((entity) => entity.selected);

  useEffect(() => {
    selectedEntityRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [props.entities]);

  useEffect(() => {
    if (!isPlaying) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest(".debugger-root")) active.blur();
  }, [isPlaying]);

  useEffect(() => {
    if (!cameraTuningOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-camera-tuning-root]")) return;
      setCameraTuningOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [cameraTuningOpen]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    setZoomToastOpen(true);
    window.clearTimeout(zoomToastTimerRef.current);
    zoomToastTimerRef.current = window.setTimeout(() => {
      setZoomToastOpen(false);
    }, 2400);

    return () => {
      window.clearTimeout(zoomToastTimerRef.current);
    };
  }, [props.zoomLabel]);

  const zoomToast = zoomToastOpen && stagePortal
    ? createPortal(
      <div className="debugger-zoom-toast is-visible" aria-hidden="true">
        {props.zoomLabel}
      </div>,
      stagePortal,
    )
    : null;

  return (
    <>
      {zoomToast}
      <div className="debugger-viewport-hud">
        <div className="debugger-viewport-hud__item">
          <span className="debugger-viewport-hud__label">FPS:</span>
          <strong className="debugger-viewport-hud__value debugger-viewport-hud__value--fps">{props.fps}</strong>
        </div>
        <div className="debugger-viewport-hud__item">
          <span className="debugger-viewport-hud__label">MS:</span>
          <strong className="debugger-viewport-hud__value debugger-viewport-hud__value--ms">{props.frameMs}</strong>
        </div>
      </div>
      <div className={`debugger-layout${isPlaying ? " debugger-layout--playing" : ""}`} onClickCapture={props.onCloseMenus}>
        <main className="debugger-stage" ref={setStagePortal}>
          <div className="debugger-viewport-overlay" aria-label="Viewport controls">
            <div className="debugger-viewport-group debugger-viewport-group--left" aria-label="Selection tools">
              <button className={`debugger-viewport-button${props.toolMode === "select" ? " is-active" : ""}`} onClick={() => props.onSetToolMode("select")} title="Select Tool" aria-label="Select Tool">
                <MousePointer2 size={14} strokeWidth={2} />
              </button>
              <button className={`debugger-viewport-button${props.toolMode === "move" ? " is-active" : ""}`} onClick={() => props.onSetToolMode("move")} title="Move Tool" aria-label="Move Tool">
                <Crosshair size={14} strokeWidth={2} />
              </button>
              <button className={`debugger-viewport-button${props.toolMode === "scale" ? " is-active" : ""}`} onClick={() => props.onSetToolMode("scale")} title="Scale Tool" aria-label="Scale Tool">
                <Expand size={14} strokeWidth={2} />
              </button>
              <button className={`debugger-viewport-button${props.toolMode === "rotate" ? " is-active" : ""}`} onClick={() => props.onSetToolMode("rotate")} title="Rotate Tool" aria-label="Rotate Tool">
                <RotateCw size={14} strokeWidth={2} />
              </button>
            </div>
            <div className="debugger-viewport-group debugger-viewport-group--center" aria-label="Playback controls">
              <button className={`debugger-viewport-button${props.playbackState === "playing" ? " is-active" : ""}`} onClick={() => props.onPlaybackAction("play")} title="Play" aria-label="Play">
                <Play size={14} fill="currentColor" strokeWidth={2} />
              </button>
              <button className={`debugger-viewport-button${props.playbackState === "paused" ? " is-active" : ""}`} onClick={() => props.onPlaybackAction("pause")} title="Pause" aria-label="Pause">
                <Pause size={14} fill="currentColor" strokeWidth={2} />
              </button>
              <button className="debugger-viewport-button" onClick={() => props.onPlaybackAction("step")} title="Step Frame" aria-label="Step Frame">
                <StepForward size={14} strokeWidth={2} />
              </button>
              <button className={`debugger-viewport-button${props.playbackState === "stopped" ? " is-active" : ""}`} onClick={() => props.onPlaybackAction("stop")} title="Restart" aria-label="Restart">
                <Redo2 size={14} strokeWidth={2} />
              </button>
            </div>
            <div className="debugger-viewport-group debugger-viewport-group--right" aria-label="Camera tools">
              <div className="debugger-zoom-tuning-wrap debugger-viewport-group__stack" data-camera-tuning-root onClick={(event) => event.stopPropagation()}>
                <button
                  className={`debugger-viewport-button${props.cameraLocked ? " is-active" : ""}`}
                  onClick={props.onToggleCameraLock}
                  title="Lock Camera to Entity"
                  aria-label="Lock Camera to Entity"
                >
                  <Camera size={14} strokeWidth={2} />
                </button>
                <button className="debugger-viewport-button" onClick={() => props.onZoomAction("camera-reset")} title="Reset Camera" aria-label="Reset Camera">
                  <LocateFixed size={14} strokeWidth={2} />
                </button>
                <button className="debugger-viewport-button" onClick={() => props.onZoomAction("zoom-out")} title="Zoom Out" aria-label="Zoom Out">
                  <Minus size={14} strokeWidth={2} />
                </button>
                <button className="debugger-viewport-button" onClick={() => props.onZoomAction("zoom-in")} title="Zoom In" aria-label="Zoom In">
                  <Plus size={14} strokeWidth={2} />
                </button>
                <button className="debugger-viewport-button" onClick={() => props.onZoomAction("zoom-fit")} title="Fit game in viewport" aria-label="Fit game in viewport">
                  <ScanSearch size={14} strokeWidth={2} />
                </button>
                <button
                  className={`debugger-viewport-button debugger-zoom-tuning-toggle${cameraTuningOpen ? " is-active" : ""}`}
                  onClick={() => setCameraTuningOpen((open) => !open)}
                  title="Camera speed"
                  aria-label="Camera speed"
                  aria-expanded={cameraTuningOpen}
                  aria-haspopup="true"
                >
                  <Camera size={14} strokeWidth={2} />
                </button>
                {cameraTuningOpen && (
                  <div className="debugger-zoom-tuning" title="Camera speed">
                    <span className="debugger-zoom-tuning__label">Speed</span>
                    <input
                      className="debugger-zoom-tuning__slider"
                      type="range"
                      min="1"
                      max="8"
                      step="0.1"
                      value={props.cameraZoomSensitivity}
                      onChange={(event) => props.onSetZoomSensitivity(Number(event.target.value))}
                      aria-label="Camera speed"
                    />
                    <span className="debugger-zoom-tuning__value">{props.cameraZoomSensitivity.toFixed(1)}x</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <section className={`debugger-drawer${props.contentDrawerOpen ? " is-open" : ""}`}>
            <div className="debugger-drawer__chrome">
              <button className="debugger-drawer__toggle" onClick={props.onToggleContentDrawer}>
                {props.contentDrawerOpen ? "Collapse" : "Drawer"}
              </button>
              {props.onOpenLevel && (
                <button className="debugger-drawer__action" onClick={props.onOpenLevel} title="Open Level" aria-label="Open Level">
                  <FileJson size={13} strokeWidth={2} />
                </button>
              )}
              <div className="debugger-drawer__tabs" role="tablist" aria-label="Bottom drawer tabs">
                {[
                  { id: "content" as const, label: "Content" },
                  { id: "systems" as const, label: "Systems" },
                  { id: "snapshots" as const, label: "Snapshots" },
                  { id: "logs" as const, label: "Logs" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    className={`debugger-drawer__tab${drawerTab === tab.id ? " is-active" : ""}`}
                    onClick={() => setDrawerTab(tab.id)}
                    role="tab"
                    aria-selected={drawerTab === tab.id}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="debugger-drawer__body">
              {drawerTab === "content" ? (
                <ContentBrowser
                  tree={props.contentTree}
                  activeWorld={props.activeWorld}
                  activeSystems={props.activeSystems}
                  onLoadWorld={props.onLoadWorld}
                  onCreateFolder={props.onCreateFolder}
                  onCreateWorld={props.onCreateWorld}
                  onCreateComponent={props.onCreateComponent}
                  onCreatePrefab={props.onCreatePrefab}
                  onCreateGraph={props.onCreateGraph}
                  onImportContent={props.onImportContent}
                  onDeleteContent={props.onDeleteContent}
                  keyboardLocked={isPlaying}
                />
              ) : drawerTab === "systems" ? (
                <SystemsDrawer
                  statusCards={props.statusCards}
                  systems={props.systems}
                  onToggleSystem={props.onToggleSystem}
                />
              ) : drawerTab === "snapshots" ? (
                <SnapshotsDrawer
                  snapshots={props.snapshots}
                  onSaveSnapshot={props.onSaveSnapshot}
                  onRestoreSnapshot={props.onRestoreSnapshot}
                />
              ) : (
                <EventLogDrawer
                  logs={props.logs}
                  logFilters={props.logFilters}
                  logPaused={props.logPaused}
                  onToggleLogFilter={props.onToggleLogFilter}
                  onToggleLogPause={props.onToggleLogPause}
                />
              )}
            </div>
          </section>
        </main>
        <aside className="debugger-panel debugger-panel--right">
          <div className="debugger-panel__toolbar">
            <div className={`debugger-dropdown${props.debugMenuOpen ? " is-open" : ""}`} data-dropdown-root onClick={(event) => event.stopPropagation()}>
              <button className="debugger-dropdown__trigger" onClick={props.onToggleDebugMenu}>
                Debug <span aria-hidden="true">▾</span>
              </button>
              <div className="debugger-dropdown__panel debugger-dropdown__panel--compact">
                <button className={`debugger-dropdown__item${props.showGrid ? " is-active" : ""}`} onClick={props.onToggleGrid}>
                  <span className="debugger-dropdown__item-icon">#</span>Grid
                </button>
                <button className={`debugger-dropdown__item${props.showPhysics ? " is-active" : ""}`} onClick={props.onTogglePhysics}>
                  <span className="debugger-dropdown__item-icon">□</span>Physics
                </button>
                <button className={`debugger-dropdown__item${props.showLabels ? " is-active" : ""}`} onClick={props.onToggleLabels}>
                  <span className="debugger-dropdown__item-icon">T</span>Labels
                </button>
                <button className={`debugger-dropdown__item${props.showSprites ? " is-active" : ""}`} onClick={props.onToggleSprites}>
                  <span className="debugger-dropdown__item-icon">⊡</span>Sprite Bounds
                </button>
              </div>
            </div>
          </div>
          {isPlaying ? (
            <section className="debugger-section debugger-section--debug">
              <div className="debugger-section__title">Debug System</div>
              <div className="debugger-sidepanels">
                <RuntimeCard
                  title="Runtime"
                  fields={[
                    { label: "FPS", value: props.fps },
                    { label: "Frame", value: `${props.frameMs} ms` },
                    { label: "Playback", value: props.playbackState },
                    { label: "Camera", value: props.cameraLocked ? "locked" : "free" },
                    { label: "Selection", value: selectedEntity ? `#${selectedEntity.entity} ${selectedEntity.title}` : "none" },
                  ]}
                />
                {props.statusCards.map((card) => <RuntimeCard key={card.title} title={card.title} fields={card.fields} />)}
                <section className="debugger-section debugger-section--grow">
                  <div className="debugger-section__title">Systems</div>
                  <div className="debugger-systems">
                    {props.systems.length === 0 ? (
                      <div className="debugger-card"><div className="debugger-field"><span>systems</span><strong>waiting for frame</strong></div></div>
                    ) : props.systems.map((system) => (
                      <div className={`debugger-card debugger-system${system.enabled ? "" : " debugger-system--disabled"}`} key={system.index}>
                        <div className="debugger-field">
                          <button className="debugger-system__toggle" onClick={() => props.onToggleSystem(system.index)} title={system.enabled ? "Disable system" : "Enable system"}>
                            {system.enabled ? "●" : "○"}
                          </button>
                          <span className="debugger-system__label">{system.label}</span>
                          <strong className="debugger-system__timing">{system.timing}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </section>
          ) : (
            <>
              <section className="debugger-section debugger-section--entities">
                <div className="debugger-section__title">Entities</div>
                <input
                  className="debugger-input"
                  placeholder="search entity or tag"
                  value={props.entityQuery}
                  onChange={(event) => props.onEntityQueryChange(event.target.value)}
                />
                <div className="debugger-entity-list">
                  {props.entities.map((entity) => (
                    <button
                      key={entity.entity}
                      ref={entity.selected ? selectedEntityRef : null}
                      className={`debugger-entity${entity.selected ? " is-selected" : ""}`}
                      onClick={() => props.onSelectEntity(entity.entity)}
                    >
                      <span>{entity.title}</span>
                      <span className="debugger-pill">{entity.tag}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="debugger-section debugger-section--inspector">
                <div className="debugger-section__title">Inspector</div>
                <input
                  className="debugger-input"
                  placeholder="filter fields…"
                  value={props.inspectorQuery}
                  onChange={(event) => props.onInspectorQueryChange(event.target.value)}
                />
                <div className="debugger-inspector">
                  {props.inspectorCards.map((card) => (
                    <div className={`debugger-card${card.collapsed ? " debugger-card--collapsed" : ""}`} key={card.id}>
                      <div className="debugger-card__header">
                        <span className="debugger-card__title">{card.title}</span>
                        <button className="debugger-card__collapse" onClick={() => props.onToggleComponentCollapse(card.id)}>
                          {card.collapsed ? "▸" : "▾"}
                        </button>
                      </div>
                      {card.collapsed ? null : card.fields.map((field, index) => (
                        <InspectorField
                          key={`${card.id}-${field.label}-${index}`}
                          field={field}
                          onEdit={props.onInspectorEdit}
                          onSelectEntity={props.onSelectEntity}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

function SystemsDrawer(props: {
  statusCards: DebuggerStatusCardView[];
  systems: DebuggerSystemView[];
  onToggleSystem: (index: number) => void;
}) {
  return (
    <section className="debugger-drawer-panel debugger-drawer-panel--systems">
      <div className="debugger-drawer-panel__grid">
        <div className="debugger-sidepanels">
          {props.statusCards.map((card) => <RuntimeCard key={card.title} title={card.title} fields={card.fields} />)}
        </div>
        <section className="debugger-section debugger-section--grow">
          <div className="debugger-section__title">Systems</div>
          <div className="debugger-systems">
            {props.systems.length === 0 ? (
              <div className="debugger-card"><div className="debugger-field"><span>systems</span><strong>waiting for frame</strong></div></div>
            ) : props.systems.map((system) => (
              <div className={`debugger-card debugger-system${system.enabled ? "" : " debugger-system--disabled"}`} key={system.index}>
                <div className="debugger-field">
                  <button className="debugger-system__toggle" onClick={() => props.onToggleSystem(system.index)} title={system.enabled ? "Disable system" : "Enable system"}>
                    {system.enabled ? "●" : "○"}
                  </button>
                  <span className="debugger-system__label">{system.label}</span>
                  <strong className="debugger-system__timing">{system.timing}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function SnapshotsDrawer(props: {
  snapshots: DebuggerSnapshotView[];
  onSaveSnapshot: () => void;
  onRestoreSnapshot: (index: number) => void;
}) {
  return (
    <section className="debugger-drawer-panel debugger-drawer-panel--snapshots">
      <div className="debugger-snapshot-header">
        <div className="debugger-section__title" style={{ marginBottom: 0 }}>Snapshots</div>
        <button className="debugger-snapshot-save" onClick={props.onSaveSnapshot}>Save</button>
      </div>
      <div className="debugger-snapshot-list">
        {props.snapshots.length === 0 ? <span style={{ color: "#52525b", fontSize: 11 }}>none saved</span> : props.snapshots.map((snap) => (
          <div className="debugger-snapshot-row" key={snap.index}>
            <span className="debugger-snapshot-row__label">frame {snap.frame}</span>
            <span>{snap.entityCount} entities</span>
            <button className="debugger-snapshot-restore" onClick={() => props.onRestoreSnapshot(snap.index)}>Restore</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function EventLogDrawer(props: {
  logs: DebuggerLogEntryView[];
  logFilters: Array<{ cat: string; active: boolean }>;
  logPaused: boolean;
  onToggleLogFilter: (cat: string) => void;
  onToggleLogPause: () => void;
}) {
  return (
    <section className="debugger-drawer-panel debugger-drawer-panel--log">
      <div className="debugger-log-header">
        <div className="debugger-section__title">Event Log</div>
        <div className="debugger-log-controls">
          {props.logFilters.map((filter) => (
            <button
              key={filter.cat}
              className={`debugger-log-chip${filter.active ? " is-active" : ""}`}
              onClick={() => props.onToggleLogFilter(filter.cat)}
            >
              {filter.cat}
            </button>
          ))}
          <button className={`debugger-log-chip debugger-log-chip--pause${props.logPaused ? " is-active" : ""}`} onClick={props.onToggleLogPause}>
            {props.logPaused ? "resume" : "pause"}
          </button>
        </div>
      </div>
      <div className="debugger-log">
        {props.logs.length === 0
          ? <span className="debugger-log__empty">{props.logPaused ? "paused" : "no events"}</span>
          : props.logs.map((entry, index) => (
            <div className={`debugger-log__entry debugger-log__entry--${entry.cat}`} key={`${entry.cat}-${index}-${entry.text}`}>
              {entry.text}
              {entry.count > 1 ? <span className="debugger-log__count">×{entry.count}</span> : null}
            </div>
          ))}
      </div>
    </section>
  );
}

function ContentBrowser(props: {
  tree: ContentTreeNode[];
  activeWorld?: string;
  activeSystems?: string[];
  onLoadWorld: (name: string) => void;
  onCreateFolder?: (path: string) => void;
  onCreateWorld: (path: string) => void;
  onCreateComponent?: (path: string) => void;
  onCreatePrefab?: (path: string) => void;
  onCreateGraph?: (path: string) => void;
  onImportContent?: (path: string, value: unknown) => void;
  onDeleteContent?: (path: string, kind: ContentTreeNode["kind"]) => void;
  keyboardLocked: boolean;
}) {
  const [selectedFolderPath, setSelectedFolderPath] = useState("");
  const [selectedItemPath, setSelectedItemPath] = useState<string | undefined>();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set([""]));
  const [search, setSearch] = useState("");
  const [createKind, setCreateKind] = useState<"folder" | "world" | "component" | "prefab" | "graph" | undefined>();
  const [createBasePath, setCreateBasePath] = useState("");
  const [createName, setCreateName] = useState("");
  const [importDialogBasePath, setImportDialogBasePath] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | undefined>();
  const [importBusy, setImportBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContentTreeNode | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    folderPath: string;
    item?: ContentTreeNode;
  } | null>(null);
  const [previewPath, setPreviewPath] = useState<string | undefined>();
  const [previewValue, setPreviewValue] = useState<unknown>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | undefined>();
  const [openGraphPath, setOpenGraphPath] = useState<string | undefined>();
  const [openGraph, setOpenGraph] = useState<GraphAsset | null>(null);
  const [openGraphLoading, setOpenGraphLoading] = useState(false);
  const [openGraphError, setOpenGraphError] = useState<string | undefined>();
  const touchTapRef = useRef<{ path: string; time: number } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const nextFolder = parentContentPath(props.activeWorld);
    setSelectedFolderPath(nextFolder);
    setSelectedItemPath(undefined);
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      for (const crumb of breadcrumbPaths(nextFolder)) next.add(crumb.path);
      return next;
    });
  }, [props.activeWorld]);

  const currentFolder = findContentFolder(props.tree, selectedFolderPath);
  const currentChildren = currentFolder?.children ?? props.tree;
  const filteredChildren = search.trim()
    ? currentChildren.filter((node) => `${node.name} ${node.path}`.toLowerCase().includes(search.trim().toLowerCase()))
    : currentChildren;
  const currentBreadcrumbs = breadcrumbPaths(selectedFolderPath);
  const activeSystems = new Set(props.activeSystems ?? []);

  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-content-context-menu]")) return;
      setContextMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!previewPath) {
      setPreviewValue(null);
      setPreviewLoading(false);
      setPreviewError(undefined);
      return;
    }

    let alive = true;
    setPreviewLoading(true);
    setPreviewError(undefined);
    setPreviewValue(null);

    fetchContentFile(previewPath)
      .then((value) => {
        if (!alive) return;
        setPreviewValue(value);
        setPreviewError(value === null ? "file not found" : undefined);
      })
      .catch(() => {
        if (!alive) return;
        setPreviewError("failed to load file");
      })
      .finally(() => {
        if (!alive) return;
        setPreviewLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [previewPath]);

  useEffect(() => {
    if (!openGraphPath) {
      setOpenGraph(null);
      setOpenGraphError(undefined);
      setOpenGraphLoading(false);
      return;
    }

    let alive = true;
    setOpenGraphLoading(true);
    setOpenGraphError(undefined);
    setOpenGraph(null);

    fetchGraphAsset(openGraphPath)
      .then((graph) => {
        if (!alive) return;
        setOpenGraph(graph);
        setOpenGraphError(graph ? undefined : "graph not found");
      })
      .catch(() => {
        if (!alive) return;
        setOpenGraph(null);
        setOpenGraphError("failed to load graph");
      })
      .finally(() => {
        if (!alive) return;
        setOpenGraphLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [openGraphPath]);

  const triggerImport = (basePath = selectedFolderPath) => {
    setImportDialogBasePath(basePath);
    setImportFile(null);
    setImportError(undefined);
    setContextMenu(null);
  };

  const chooseImportFile = () => {
    importInputRef.current?.click();
  };

  const beginCreate = (kind: "folder" | "world" | "component" | "prefab" | "graph", basePath = selectedFolderPath) => {
    setCreateKind(kind);
    setCreateBasePath(basePath);
    setCreateName("");
    setContextMenu(null);
  };

  const confirmCreate = () => {
    const name = createName.trim();
    if (!name) return;
    if (currentChildren.some((node) => node.name === name)) return;

    const nextPath = joinContentPath(createBasePath, name);
    if (createKind === "folder") {
      props.onCreateFolder?.(nextPath);
    } else if (createKind === "component") {
      props.onCreateComponent?.(nextPath);
    } else if (createKind === "prefab") {
      props.onCreatePrefab?.(nextPath);
    } else if (createKind === "graph") {
      props.onCreateGraph?.(nextPath);
    } else {
      props.onCreateWorld(nextPath);
    }
    setCreateKind(undefined);
    setCreateBasePath("");
    setCreateName("");
  };

  const openNode = (node: ContentTreeNode) => {
    setSelectedItemPath(node.path);
    if (node.kind === "folder") {
      setSelectedFolderPath(node.path);
      setExpandedFolders((prev) => new Set(prev).add(node.path));
      return;
    }
    if (node.kind === "world") {
      props.onLoadWorld(node.path);
      return;
    }
    if (node.kind === "graph") {
      setPreviewPath(undefined);
      setOpenGraphPath(node.path);
      return;
    }
    setOpenGraphPath(undefined);
    setPreviewPath(node.path);
  };

  const selectNode = (node: ContentTreeNode) => {
    setSelectedItemPath(node.path);
  };

  const activateNode = (node: ContentTreeNode) => {
    openNode(node);
    setContextMenu(null);
  };

  const deleteNode = (node: ContentTreeNode) => {
    setContextMenu(null);
    setDeleteTarget(node);
  };

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportFile(file);
    setImportError(undefined);
  };

  const handlePointerUp = (node: ContentTreeNode, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "touch") return;
    const now = performance.now();
    const last = touchTapRef.current;
    if (last && last.path === node.path && now - last.time < 320) {
      touchTapRef.current = null;
      activateNode(node);
      return;
    }
    touchTapRef.current = { path: node.path, time: now };
  };

  const openContextMenu = (event: React.MouseEvent | React.PointerEvent, item?: ContentTreeNode) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedItemPath(item?.path ?? selectedItemPath);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      item,
      folderPath: item?.kind === "folder" ? item.path : selectedFolderPath,
    });
  };

  const openCreateMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setContextMenu({
      x: rect.left,
      y: rect.bottom + 8,
      folderPath: selectedFolderPath,
    });
  };

  const contextFolderPath = contextMenu?.folderPath ?? selectedFolderPath;

  return (
    <section className="debugger-section debugger-section--content">
      <div className="debugger-content-header">
        <div className="debugger-content-header__titleblock">
          <div className="debugger-section__title" style={{ marginBottom: 4 }}>Content</div>
          <div className="debugger-content-breadcrumbs">
            {currentBreadcrumbs.map((crumb, index) => (
              <button
                key={crumb.path || "root"}
                className={`debugger-content-breadcrumb${index === currentBreadcrumbs.length - 1 ? " is-active" : ""}`}
                onClick={() => setSelectedFolderPath(crumb.path)}
              >
                {crumb.label}
              </button>
            ))}
          </div>
        </div>
        <div className="debugger-content-actions">
          <button
            className="debugger-content-action"
            onClick={openCreateMenu}
            onContextMenu={openCreateMenu}
            title="Create"
            aria-label="Create"
            disabled={props.keyboardLocked}
          >
            <Plus size={13} strokeWidth={2} />
          </button>
          <button className="debugger-content-action" onClick={() => setSearch("")} title="Clear search" aria-label="Clear search" disabled={props.keyboardLocked}>
            <RefreshCw size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="debugger-content-search">
        <Search size={13} strokeWidth={2} />
        <input
          className="debugger-input debugger-content-search__input"
          placeholder="search content"
          value={search}
          disabled={props.keyboardLocked}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={handleImportChange}
      />
      <div className="debugger-content-body debugger-content-body--browser">
        <aside className="debugger-content-sidebar">
          <div className="debugger-content-sidebar__header">Folders</div>
          <div className="debugger-content-tree">
            {renderFolderTree(props.tree, selectedFolderPath, expandedFolders, setExpandedFolders, setSelectedFolderPath, props.onLoadWorld)}
          </div>
        </aside>
        <section className="debugger-content-browser">
          <div className="debugger-content-browser__header">
            <div>
              <div className="debugger-section__title" style={{ marginBottom: 4 }}>Assets</div>
              <div className="debugger-content-browser__hint">
                {search.trim()
                  ? "filtered"
                  : selectedFolderPath === "systems"
                    ? `${[...activeSystems].filter((name) => currentChildren.some((node) => node.kind === "graph" && node.name === name)).length} active / ${currentChildren.length} total`
                    : `${currentChildren.length} item${currentChildren.length === 1 ? "" : "s"}`}
              </div>
            </div>
            <div className="debugger-content-browser__path">{selectedFolderPath || "Content"}</div>
          </div>
          <div
            className="debugger-content-grid"
            onContextMenu={(event) => openContextMenu(event)}
          >
            {filteredChildren.length === 0 ? (
              <div className="debugger-content-empty">{search.trim() ? "no matches" : "empty folder"}</div>
            ) : filteredChildren.map((node) => {
              const isSelected = selectedItemPath === node.path || (node.kind === "world" && node.path === props.activeWorld);
              const icon = renderContentIcon(node.kind);
              const kindLabel = node.kind === "graph" ? "system" : node.kind;
              return (
                <button
                  key={node.path}
                  className={`debugger-content-tile${isSelected ? " is-selected" : ""}${node.kind === "world" && node.path === props.activeWorld ? " is-active" : ""}`}
                  disabled={props.keyboardLocked}
                  onClick={() => selectNode(node)}
                  onDoubleClick={() => activateNode(node)}
                  onPointerUp={(event) => handlePointerUp(node, event)}
                  onContextMenu={(event) => openContextMenu(event, node)}
                >
                  <span className="debugger-content-tile__icon">{icon}</span>
                  <span className="debugger-content-tile__meta">
                    <strong className="debugger-content-tile__name">{node.name}</strong>
                    <span className="debugger-content-tile__path">{node.path || "root"}</span>
                  </span>
                  <span className={`debugger-pill${node.kind === "graph" && activeSystems.has(node.name) ? " is-active" : ""}`}>
                    {node.kind === "graph" ? (activeSystems.has(node.name) ? "active" : "system") : kindLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
      {contextMenu && createPortal(
        <div
          className="debugger-content-menu"
          data-content-context-menu
          style={{
            left: `${Math.max(8, Math.min(contextMenu.x, window.innerWidth - 232))}px`,
            top: `${Math.max(8, Math.min(contextMenu.y, window.innerHeight - 260))}px`,
          }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button className="debugger-content-menu__item" onClick={() => triggerImport(contextFolderPath)} disabled={!props.onImportContent || props.keyboardLocked}>
            Import
          </button>
          {contextMenu.item && (
            <button className="debugger-content-menu__item" onClick={() => activateNode(contextMenu.item!)}>
              {contextMenu.item.kind === "folder" ? "Enter folder" : contextMenu.item.kind === "world" ? "Load world" : contextMenu.item.kind === "graph" ? "Open system" : "Open file"}
            </button>
          )}
          <div className="debugger-content-menu__separator" />
          <button className="debugger-content-menu__item" onClick={() => beginCreate("folder", contextFolderPath)} disabled={!props.onCreateFolder || props.keyboardLocked}>
            New Folder
          </button>
          <button className="debugger-content-menu__item" onClick={() => beginCreate("world", contextFolderPath)} disabled={props.keyboardLocked}>
            New World
          </button>
          <button className="debugger-content-menu__item" onClick={() => beginCreate("component", contextFolderPath)} disabled={!props.onCreateComponent || props.keyboardLocked}>
            New Component
          </button>
          <button className="debugger-content-menu__item" onClick={() => beginCreate("prefab", contextFolderPath)} disabled={!props.onCreatePrefab || props.keyboardLocked}>
            New Prefab
          </button>
          <button className="debugger-content-menu__item" onClick={() => beginCreate("graph", contextFolderPath)} disabled={!props.onCreateGraph || props.keyboardLocked}>
            New System
          </button>
          <div className="debugger-content-menu__separator" />
          <button
            className="debugger-content-menu__item"
            onClick={() => {
              if (contextMenu.item) deleteNode(contextMenu.item);
              else setContextMenu(null);
            }}
            disabled={!contextMenu.item || !props.onDeleteContent || props.keyboardLocked}
          >
            Delete
          </button>
        </div>,
        document.body,
      )}
      {createKind && createPortal(
        <ContentCreateDialog
          kind={createKind}
          basePath={createBasePath}
          name={createName}
          currentChildren={currentChildren}
          keyboardLocked={props.keyboardLocked}
          onNameChange={setCreateName}
          onConfirm={confirmCreate}
          onClose={() => {
            setCreateKind(undefined);
            setCreateBasePath("");
            setCreateName("");
          }}
        />,
        document.body,
      )}
      {importDialogBasePath && createPortal(
        <ContentImportDialog
          basePath={importDialogBasePath}
          file={importFile}
          error={importError}
          busy={importBusy}
          keyboardLocked={props.keyboardLocked}
          onPickFile={chooseImportFile}
          onClose={() => {
            setImportDialogBasePath("");
            setImportFile(null);
            setImportError(undefined);
            setImportBusy(false);
          }}
          onImport={async () => {
            if (!props.onImportContent || !importFile) return;
            setImportBusy(true);
            setImportError(undefined);
            try {
              const text = await importFile.text();
              const value = JSON.parse(text) as unknown;
              const stem = importFile.name.replace(/\.json$/i, "");
              await Promise.resolve(props.onImportContent(joinContentPath(importDialogBasePath, stem), value));
              setImportDialogBasePath("");
              setImportFile(null);
              setImportError(undefined);
              setImportBusy(false);
            } catch {
              setImportBusy(false);
              setImportError("Import failed: JSON file could not be parsed or saved.");
            }
          }}
        />,
        document.body,
      )}
      {deleteTarget && createPortal(
        <DeleteContentDialog
          node={deleteTarget}
          keyboardLocked={props.keyboardLocked}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (!props.onDeleteContent) return;
            if (selectedItemPath === deleteTarget.path) setSelectedItemPath(undefined);
            if (previewPath === deleteTarget.path) setPreviewPath(undefined);
            if (openGraphPath === deleteTarget.path) setOpenGraphPath(undefined);
            props.onDeleteContent(deleteTarget.path, deleteTarget.kind);
            setDeleteTarget(null);
          }}
        />,
        document.body,
      )}
      {previewPath && createPortal(
        <ContentPreviewDialog
          path={previewPath}
          value={previewValue}
          loading={previewLoading}
          error={previewError}
          onClose={() => setPreviewPath(undefined)}
        />,
        document.body,
      )}
      {openGraphPath && createPortal(
        <GraphDialog
          graph={openGraph}
          loading={openGraphLoading}
          error={openGraphError}
          keyboardLocked={props.keyboardLocked}
          onClose={() => setOpenGraphPath(undefined)}
          onChange={(nextGraph) => setOpenGraph(nextGraph)}
          onSave={(nextGraph) => {
            setOpenGraph(nextGraph);
            void saveGraphAsset(openGraphPath, nextGraph);
          }}
        />,
        document.body,
      )}
    </section>
  );
}

function RuntimeCard(props: { title: string; fields: Array<{ label: string; value: string }> }) {
  return (
    <div className="debugger-card">
      <div className="debugger-card__title">{props.title}</div>
      {props.fields.map((field, index) => (
        <div className="debugger-field" key={`${field.label}-${index}`}>
          <span>{field.label}</span>
          <strong>{field.value}</strong>
        </div>
      ))}
    </div>
  );
}

function renderFolderTree(
  nodes: ContentTreeNode[],
  selectedFolderPath: string,
  expandedFolders: Set<string>,
  setExpandedFolders: (next: Set<string>) => void,
  setSelectedFolderPath: (path: string) => void,
  onLoadWorld: (name: string) => void,
  depth = 0,
) {
  return nodes
    .filter((node) => node.kind === "folder" || node.kind === "world")
    .map((node) => {
      const isFolder = node.kind === "folder";
      const isExpanded = expandedFolders.has(node.path);
      const isSelected = isFolder && node.path === selectedFolderPath;
      const hasChildren = isFolder && (node.children?.length ?? 0) > 0;

      return (
        <div key={node.path} className="debugger-content-tree__node">
          <button
            className={`debugger-content-tree__row${isSelected ? " is-selected" : ""}${node.kind === "world" ? " debugger-content-tree__row--world" : ""}`}
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
            onClick={() => {
              if (isFolder) {
                setSelectedFolderPath(node.path);
                const next = new Set(expandedFolders);
                if (next.has(node.path)) next.delete(node.path);
                else next.add(node.path);
                setExpandedFolders(next);
                return;
              }
              onLoadWorld(node.path);
            }}
            onContextMenu={(event) => {
              if (!isFolder) return;
              event.preventDefault();
              event.stopPropagation();
              setSelectedFolderPath(node.path);
              const next = new Set(expandedFolders);
              next.add(node.path);
              setExpandedFolders(next);
            }}
          >
            <span className="debugger-content-tree__toggle">
              {isFolder ? (hasChildren ? (isExpanded ? <ChevronRight size={12} strokeWidth={2.2} style={{ transform: "rotate(90deg)" }} /> : <ChevronRight size={12} strokeWidth={2.2} />) : <span className="debugger-content-tree__spacer" />) : <span className="debugger-content-tree__spacer" />}
            </span>
            <span className="debugger-content-tree__icon">{isFolder ? <Folder size={12} strokeWidth={2} /> : <Globe size={12} strokeWidth={2} />}</span>
            <span className="debugger-content-tree__name">{node.name}</span>
          </button>
          {isFolder && isExpanded && node.children?.length
            ? renderFolderTree(node.children, selectedFolderPath, expandedFolders, setExpandedFolders, setSelectedFolderPath, onLoadWorld, depth + 1)
            : null}
        </div>
      );
    });
}

function InspectorField(
  props: {
    field: DebuggerFieldView;
    onEdit: (entity: number, componentId: string, key: string, value: string) => void;
    onSelectEntity: (entity: number) => void;
  },
) {
  const { field } = props;

  if (field.editable && field.entity !== undefined && field.componentId && field.editKey) {
    return (
      <label className="debugger-field debugger-field--editable">
        <span>{field.label}</span>
        <input
          className="debugger-field__input"
          value={field.value}
          onChange={(event) => props.onEdit(field.entity!, field.componentId!, field.editKey!, event.target.value)}
        />
      </label>
    );
  }

  if (field.selectEntities && field.selectEntities.length > 0) {
    return (
      <div className="debugger-field">
        <span>{field.label}</span>
        <div className="debugger-field__links">
          {field.selectEntities.map((entity) => (
            <button className="debugger-field__link" key={entity} onClick={() => props.onSelectEntity(entity)}>#{entity}</button>
          ))}
        </div>
      </div>
    );
  }

  if (field.selectEntity !== undefined) {
    return (
      <div className="debugger-field">
        <span>{field.label}</span>
        <div className="debugger-field__links">
          <button className="debugger-field__link" onClick={() => props.onSelectEntity(field.selectEntity!)}>#{field.selectEntity}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="debugger-field">
      <span>{field.label}</span>
      <strong>{field.value}</strong>
    </div>
  );
}

function joinContentPath(parent: string, child: string) {
  const cleanChild = child.trim().replace(/^\/+|\/+$/g, "");
  if (!cleanChild) return parent;
  if (!parent) return cleanChild;
  return `${parent}/${cleanChild}`;
}

function parentContentPath(path?: string) {
  if (!path) return "";
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function breadcrumbPaths(path: string) {
  const parts = path.split("/").filter(Boolean);
  const crumbs = [{ label: "Content", path: "" }];
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    crumbs.push({ label: part, path: current });
  }
  return crumbs;
}

function findContentFolder(nodes: ContentTreeNode[], targetPath: string): ContentTreeNode | undefined {
  if (!targetPath) return { name: "Content", path: "", kind: "folder", children: nodes };
  for (const node of nodes) {
    if (node.kind !== "folder") continue;
    if (node.path === targetPath) return node;
    const found = findContentFolder(node.children ?? [], targetPath);
    if (found) return found;
  }
  return undefined;
}

type GraphAsset = GraphDefinition;

async function fetchContentFile(path: string): Promise<unknown | null> {
  const response = await fetch(`/api/content/file?path=${encodeURIComponent(path)}`);
  if (!response.ok) return null;
  return await response.json();
}

async function fetchGraphAsset(path: string): Promise<GraphAsset | null> {
  const raw = await fetchContentFile(path);
  if (raw === null) return null;
  return parseGraphAsset(raw);
}

async function saveGraphAsset(path: string, graph: GraphAsset): Promise<void> {
  await fetch(`/api/content/file?path=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(graph, null, 2),
  });
}

function parseGraphAsset(value: unknown): GraphAsset | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as {
    version?: unknown;
    name?: unknown;
    entrypoint?: unknown;
    variables?: unknown;
    nodes?: unknown;
    edges?: unknown;
    metadata?: unknown;
  };
  if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3) return null;
  if (typeof parsed.name !== "string" || typeof parsed.entrypoint !== "string" || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    return null;
  }
  const version = parsed.version;
  const nodes = version === 1 ? parsed.nodes.filter(isLegacyGraphNode) : parsed.nodes.filter(isGraphNode);
  const edges = parsed.edges.filter(isGraphEdge);
  const variables = version === 1 ? [] : Array.isArray(parsed.variables) ? parsed.variables.filter(isGraphVariable) : [];
  return {
    version: 3,
    name: parsed.name,
    entrypoint: parsed.entrypoint,
    variables,
    nodes,
    edges,
    metadata: typeof parsed.metadata === "object" && parsed.metadata !== null ? parsed.metadata as GraphAsset["metadata"] : undefined,
  };
}

function isGraphNode(value: unknown): value is GraphAsset["nodes"][number] {
  if (!value || typeof value !== "object") return false;
  const node = value as Partial<GraphAsset["nodes"][number]>;
  return typeof node.id === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(node.id)
    && typeof node.type === "string"
    && typeof node.position === "object"
    && node.position !== null
    && typeof (node.position as { x?: unknown }).x === "number"
    && typeof (node.position as { y?: unknown }).y === "number";
}

function isLegacyGraphNode(value: unknown): value is GraphAsset["nodes"][number] {
  if (!value || typeof value !== "object") return false;
  const node = value as Partial<GraphAsset["nodes"][number]>;
  return typeof node.id === "string"
    && typeof node.type === "string"
    && typeof node.position === "object"
    && node.position !== null
    && typeof (node.position as { x?: unknown }).x === "number"
    && typeof (node.position as { y?: unknown }).y === "number";
}

function isGraphVariable(value: unknown): value is GraphVariableDefinition {
  if (!value || typeof value !== "object") return false;
  const variable = value as Partial<GraphVariableDefinition> & { default?: unknown };
  return typeof variable.name === "string"
    && variable.name.trim() !== ""
    && (variable.scope === "private" || variable.scope === "public")
    && typeof variable.type === "string"
    && variable.type.trim() !== ""
    && Object.prototype.hasOwnProperty.call(variable, "default");
}

function isGraphEdge(value: unknown): value is GraphAsset["edges"][number] {
  if (!value || typeof value !== "object") return false;
  const edge = value as Partial<GraphAsset["edges"][number]>;
  return typeof edge.from === "object"
    && edge.from !== null
    && typeof edge.to === "object"
    && edge.to !== null
    && typeof edge.from.node === "string"
    && typeof edge.from.port === "string"
    && typeof edge.to.node === "string"
    && typeof edge.to.port === "string";
}

function GraphDialog(props: {
  graph: GraphAsset | null;
  loading: boolean;
  error?: string;
  keyboardLocked: boolean;
  onClose: () => void;
  onChange: (graph: GraphAsset) => void;
  onSave: (graph: GraphAsset) => void;
}) {
  const [graph, setGraph] = useState<GraphAsset | null>(props.graph);
  const graphRef = useRef<GraphAsset | null>(props.graph);
  const [bounds, setBounds] = useState(() => props.graph ? computeGraphBounds(props.graph) : { x: 0, y: 0, width: 960, height: 540 });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const portRefs = useRef(new Map<string, HTMLSpanElement>());
  const [portPoints, setPortPoints] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(props.graph?.entrypoint);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | undefined>();
  const [graphView, setGraphView] = useState(() => ({ x: 0, y: 0, zoom: 1 }));
  const graphViewRef = useRef(graphView);
  const nodeMap = new Map(graph?.nodes.map((node) => [node.id, node]) ?? []);
  const selectedNode = selectedNodeId ? graph?.nodes.find((node) => node.id === selectedNodeId) : undefined;
  const selectedEdge = selectedEdgeKey && graph ? graph.edges.find((edge) => edgeKey(edge) === selectedEdgeKey) : undefined;
  const panState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    viewX: number;
    viewY: number;
  } | null>(null);
  const dragState = useRef<{
    nodeId: string;
    pointerId: number;
    sourceGraph: GraphAsset;
    startPoint: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    setGraph(props.graph);
    graphRef.current = props.graph;
    setBounds(props.graph ? computeGraphBounds(props.graph) : { x: 0, y: 0, width: 960, height: 540 });
    setSelectedNodeId(props.graph?.entrypoint);
    setSelectedEdgeKey(undefined);
  }, [props.graph]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const currentGraph = graphRef.current;
    if (!viewport || !currentGraph) return;
    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    setGraphView(fitGraphView(rect.width, rect.height, bounds));
  }, [bounds]);

  useEffect(() => {
    graphViewRef.current = graphView;
  }, [graphView]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    const currentGraph = graphRef.current;
    if (!canvas || !currentGraph || !viewport) return;

    const measure = () => {
      const viewportRect = viewport.getBoundingClientRect();
      const { x: viewX, y: viewY, zoom } = graphViewRef.current;
      const next: Record<string, { x: number; y: number }> = {};
      for (const [key, element] of portRefs.current) {
        const rect = element.getBoundingClientRect();
        next[key] = {
          x: (rect.left - viewportRect.left + rect.width / 2 - viewX) / zoom,
          y: (rect.top - viewportRect.top + rect.height / 2 - viewY) / zoom,
        };
      }
      setPortPoints(next);
    };

    measure();
    const raf = requestAnimationFrame(measure);
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(canvas);
    for (const element of portRefs.current.values()) resizeObserver.observe(element);
    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, [graph, bounds, graphView]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const pan = panState.current;
      if (pan && event.pointerId === pan.pointerId) {
        const deltaX = event.clientX - pan.startX;
        const deltaY = event.clientY - pan.startY;
        setGraphView({
          x: pan.viewX + deltaX,
          y: pan.viewY + deltaY,
          zoom: graphViewRef.current.zoom,
        });
        return;
      }

      const drag = dragState.current;
      const currentGraph = graphRef.current;
      if (!drag || !currentGraph || event.pointerId !== drag.pointerId) return;

      const currentPoint = toGraphPoint(viewportRef.current, graphViewRef.current, event.clientX, event.clientY);
      if (!currentPoint) return;
      const deltaX = currentPoint.x - drag.startPoint.x;
      const deltaY = currentPoint.y - drag.startPoint.y;
      const nextGraph = moveGraphNode(drag.sourceGraph, drag.nodeId, deltaX, deltaY);
      graphRef.current = nextGraph;
      setGraph(nextGraph);
      props.onChange(nextGraph);
    };

    const finishDrag = (event: PointerEvent) => {
      const pan = panState.current;
      if (pan && event.pointerId === pan.pointerId) {
        panState.current = null;
        return;
      }

      const drag = dragState.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragState.current = null;
      const currentGraph = graphRef.current;
      if (currentGraph) props.onSave(currentGraph);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [props.onChange, props.onSave]);

  const handleGraphPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const currentGraph = graphRef.current;
    const target = event.target;
    if (!currentGraph || !(target instanceof Element)) return;
    if (target.closest(".debugger-graph-node, .debugger-graph-node *")) return;
    if (!(event.button === 1 || (event.button === 0 && (event.altKey || event.metaKey)))) return;

    event.preventDefault();
    panState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      viewX: graphViewRef.current.x,
      viewY: graphViewRef.current.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleGraphWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    const wx = (cx - graphViewRef.current.x) / graphViewRef.current.zoom;
    const wy = (cy - graphViewRef.current.y) / graphViewRef.current.zoom;
    const delta = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 240 : 1);
    const speed = Math.pow(GRAPH_ZOOM_SENSITIVITY, 1.2);
    const factor = Math.exp(-delta * 0.0015 * speed);
    const nextZoom = clamp(graphViewRef.current.zoom * factor, 0.2, 3);

    setGraphView({
      x: cx - wx * nextZoom,
      y: cy - wy * nextZoom,
      zoom: nextZoom,
    });
  };

  const zoomGraph = (factor: number, focus?: { x: number; y: number }) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const cx = focus?.x ?? rect.width / 2;
    const cy = focus?.y ?? rect.height / 2;
    const wx = (cx - graphViewRef.current.x) / graphViewRef.current.zoom;
    const wy = (cy - graphViewRef.current.y) / graphViewRef.current.zoom;
    const nextZoom = clamp(graphViewRef.current.zoom * factor, 0.2, 3);
    setGraphView({
      x: cx - wx * nextZoom,
      y: cy - wy * nextZoom,
      zoom: nextZoom,
    });
  };

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>, nodeId: string) => {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const startPoint = toGraphPoint(viewportRef.current, graphViewRef.current, event.clientX, event.clientY);
    if (!startPoint) return;
    setSelectedNodeId(nodeId);
    dragState.current = {
      nodeId,
      pointerId: event.pointerId,
      sourceGraph: currentGraph,
      startPoint,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const updateGraph = (nextGraph: GraphAsset) => {
    graphRef.current = nextGraph;
    setGraph(nextGraph);
    props.onChange(nextGraph);
  };

  const deleteNode = (nodeId: string) => {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const nextNodes = currentGraph.nodes.filter((node) => node.id !== nodeId);
    const nextEdges = currentGraph.edges.filter((edge) => edge.from.node !== nodeId && edge.to.node !== nodeId);
    const nextGraph = {
      ...currentGraph,
      nodes: nextNodes,
      edges: nextEdges,
      entrypoint: currentGraph.entrypoint === nodeId ? (nextNodes[0]?.id ?? currentGraph.entrypoint) : currentGraph.entrypoint,
    };
    updateGraph(nextGraph);
    setSelectedNodeId((current) => {
      if (current !== nodeId) return current;
      return nextGraph.nodes.some((node) => node.id === nextGraph.entrypoint)
        ? nextGraph.entrypoint
        : nextGraph.nodes[0]?.id;
    });
    setSelectedEdgeKey(undefined);
  };

  const deleteEdge = (edgeId: string) => {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const nextGraph = {
      ...currentGraph,
      edges: currentGraph.edges.filter((edge) => edgeKey(edge) !== edgeId),
    };
    updateGraph(nextGraph);
    setSelectedEdgeKey((current) => (current === edgeId ? undefined : current));
  };

  const addNode = (spec: GraphNodeSpec) => {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const node = createGraphNode(spec, {
      x: bounds.x + 180 + currentGraph.nodes.length * 18,
      y: bounds.y + 160 + currentGraph.nodes.length * 12,
    });
    const nextGraph = {
      ...currentGraph,
      nodes: [...currentGraph.nodes, node],
    };
    updateGraph(nextGraph);
    setSelectedNodeId(node.id);
  };

  const updateNodeData = (nodeId: string, field: string, nextValue: string, type: GraphNodeSpec["fields"][number]["type"]) => {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const parsedValue = parseEditableValue(nextValue, type);
    const nextGraph = {
      ...currentGraph,
      nodes: currentGraph.nodes.map((node) => node.id === nodeId
        ? {
            ...node,
            data: {
              ...(node.data ?? {}),
              [field]: parsedValue,
            },
          }
        : node),
    };
    updateGraph(nextGraph);
  };

  const updateVariable = (index: number, patch: Partial<GraphVariableDefinition>) => {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const nextVariables = currentGraph.variables.map((variable, variableIndex) => variableIndex === index ? { ...variable, ...patch } : variable);
    updateGraph({ ...currentGraph, variables: nextVariables });
  };

  return (
    <div className="debugger-graph-dialog" role="dialog" aria-modal="true" onClick={props.onClose}>
      <div className="debugger-graph-dialog__panel" onClick={(event) => event.stopPropagation()}>
        <div className="debugger-graph-dialog__header">
          <div>
            <div className="debugger-section__title" style={{ marginBottom: 4 }}>System Graph</div>
            <div className="debugger-graph-dialog__subtitle">
              {graph ? graph.name : "loading..."}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="debugger-graph-zoom-controls">
              <button className="debugger-content-action" onClick={() => zoomGraph(1 / 1.18)} aria-label="Zoom out">
                <Minus size={13} strokeWidth={2.5} />
              </button>
              <button className="debugger-content-action" onClick={() => setGraphView(fitGraphView(viewportRef.current?.clientWidth ?? 1400, viewportRef.current?.clientHeight ?? 900, bounds))} aria-label="Fit graph">
                <ScanSearch size={13} strokeWidth={2.5} />
              </button>
              <button className="debugger-content-action" onClick={() => zoomGraph(1.18)} aria-label="Zoom in">
                <Plus size={13} strokeWidth={2.5} />
              </button>
              <button className="debugger-content-action" onClick={() => setGraphView(fitGraphView(viewportRef.current?.clientWidth ?? 1400, viewportRef.current?.clientHeight ?? 900, bounds))} aria-label="Reset graph view">
                <LocateFixed size={13} strokeWidth={2.5} />
              </button>
            </div>
            <button className="debugger-content-action" onClick={props.onClose} aria-label="Close graph dialog">
              <X size={13} strokeWidth={2.5} />
            </button>
          </div>
        </div>
        {props.loading && <div className="debugger-content-empty">loading graph…</div>}
        {props.error && <div className="debugger-content-empty">{props.error}</div>}
        {graph && !props.loading && !props.error && (
          <div style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr) 320px", gap: 12, alignItems: "start" }}>
            <aside className="debugger-panel" style={{ minHeight: 0 }}>
              <div className="debugger-graph-side-title">Palette</div>
              <div style={{ display: "grid", gap: 6 }}>
                {GRAPH_NODE_LIBRARY.map((spec) => (
                  <button
                    key={spec.type}
                    className="debugger-content-action"
                    style={{ justifyContent: "space-between", width: "100%", padding: "8px 10px", display: "flex" }}
                    disabled={props.keyboardLocked}
                    onClick={() => addNode(spec)}
                  >
                    <span>{spec.label}</span>
                    <span style={{ color: "#94a3b8" }}>{spec.type}</span>
                  </button>
                ))}
              </div>
              <div className="debugger-graph-side-title" style={{ marginTop: 12 }}>Variables</div>
              <div style={{ display: "grid", gap: 8 }}>
                {graph.variables.length === 0 ? <div className="debugger-content-empty">no variables</div> : graph.variables.map((variable, index) => (
                  <div key={`${variable.name}-${index}`} className="debugger-graph-variable">
                    <input className="debugger-input" value={variable.name} disabled={props.keyboardLocked} onChange={(event) => updateVariable(index, { name: event.target.value })} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <select className="debugger-input" value={variable.scope} disabled={props.keyboardLocked} onChange={(event) => updateVariable(index, { scope: event.target.value as GraphVariableDefinition["scope"] })}>
                        <option value="private">private</option>
                        <option value="public">public</option>
                      </select>
                      <input className="debugger-input" value={variable.type} disabled={props.keyboardLocked} onChange={(event) => updateVariable(index, { type: event.target.value })} />
                    </div>
                    <textarea
                      className="debugger-input"
                      rows={3}
                      value={formatJsonValue(variable.default)}
                      disabled={props.keyboardLocked}
                      onChange={(event) => updateVariable(index, { default: parseJsonInput(event.target.value, variable.default) })}
                    />
                  </div>
                ))}
              </div>
            </aside>
            <section style={{ minWidth: 0 }}>
              <div className="debugger-graph-meta">
                <span>entrypoint: <strong>{graph.entrypoint}</strong></span>
                <span>nodes: <strong>{graph.nodes.length}</strong></span>
                <span>edges: <strong>{graph.edges.length}</strong></span>
                <span>order: <strong>{graph.metadata?.order ?? "n/a"}</strong></span>
              </div>
              {typeof graph.metadata?.description === "string" && <div className="debugger-graph-description">{graph.metadata.description}</div>}
              <div className="debugger-graph-canvas__scroll">
                <div
                  ref={viewportRef}
                  className="debugger-graph-canvas__viewport"
                  onPointerDown={handleGraphPointerDown}
                  onWheel={handleGraphWheel}
                >
                  <div
                    ref={canvasRef}
                    className="debugger-graph-canvas"
                    style={{
                      width: `${bounds.width}px`,
                      height: `${bounds.height}px`,
                      transform: `translate(${graphView.x}px, ${graphView.y}px) scale(${graphView.zoom})`,
                    }}
                  >
                  <svg className="debugger-graph-canvas__edges" width={bounds.width} height={bounds.height} viewBox={`0 0 ${bounds.width} ${bounds.height}`}>
                    <defs>
                      <marker id="graph-edge-end" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="strokeWidth">
                        <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#93c5fd" />
                      </marker>
                      <marker id="graph-edge-start" markerWidth="12" markerHeight="12" refX="6" refY="6" orient="auto" markerUnits="strokeWidth">
                        <circle cx="6" cy="6" r="3.4" fill="#38bdf8" />
                      </marker>
                      <marker id="graph-edge-terminal" markerWidth="12" markerHeight="12" refX="6" refY="6" orient="auto" markerUnits="strokeWidth">
                        <circle cx="6" cy="6" r="4" fill="#e0f2fe" stroke="#0f172a" strokeWidth="1.5" />
                      </marker>
                    </defs>
                    {graph.edges.map((edge, index) => {
                      const from = nodeMap.get(edge.from.node);
                      const to = nodeMap.get(edge.to.node);
                      if (!from || !to) return null;
                      const id = edgeKey(edge);
                      const isSelected = selectedEdgeKey === id;
                      const fromPoint = portPoints[`${edge.from.node}:output:${edge.from.port}`] ?? getGraphPortPoint(from, edge.from.port, "output", bounds);
                      const toPoint = portPoints[`${edge.to.node}:input:${edge.to.port}`] ?? getGraphPortPoint(to, edge.to.port, "input", bounds);
                      const mid = (fromPoint.x + toPoint.x) / 2;
                      const path = `M ${fromPoint.x} ${fromPoint.y} C ${mid} ${fromPoint.y}, ${mid} ${toPoint.y}, ${toPoint.x} ${toPoint.y}`;
                      return (
                        <g key={`${edge.from.node}-${edge.to.node}-${index}`}>
                          <path
                            d={path}
                            className={`debugger-graph-edge${isSelected ? " is-selected" : ""}`}
                            markerEnd="url(#graph-edge-end)"
                            markerStart="url(#graph-edge-start)"
                            onClick={() => setSelectedEdgeKey(id)}
                          />
                          <circle cx={fromPoint.x} cy={fromPoint.y} r={4.5} className="debugger-graph-edge__start" />
                          <circle cx={toPoint.x} cy={toPoint.y} r={5.5} className="debugger-graph-edge__end" />
                          <text x={fromPoint.x + 8} y={fromPoint.y - 8} className="debugger-graph-edge-label debugger-graph-edge-label--from">out</text>
                          <text x={toPoint.x - 8} y={toPoint.y + 14} className="debugger-graph-edge-label debugger-graph-edge-label--to">in</text>
                        </g>
                      );
                    })}
                  </svg>
                    {graph.nodes.map((node) => {
                      const spec = GRAPH_NODE_LIBRARY.find((entry) => entry.type === node.type);
                      const isSelected = node.id === selectedNodeId;
                      return (
                        <div
                          key={node.id}
                          className={`debugger-graph-node${node.id === graph.entrypoint ? " is-entrypoint" : ""}${isSelected ? " is-selected" : ""}`}
                          onPointerDown={(event) => beginDrag(event, node.id)}
                          onClick={() => setSelectedNodeId(node.id)}
                          style={{
                            left: `${node.position.x - bounds.x}px`,
                            top: `${node.position.y - bounds.y}px`,
                          }}
                        >
                          <div className="debugger-graph-node__title-row">
                            <div>
                              <div className="debugger-graph-node__title">{spec?.label ?? node.type}</div>
                              <div className="debugger-graph-node__type">{node.id}</div>
                            </div>
                          <button
                            className="debugger-graph-node__delete"
                            title="Delete node"
                            aria-label="Delete node"
                            disabled={props.keyboardLocked}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteNode(node.id);
                            }}
                            >
                              <Trash2 size={11} strokeWidth={2.5} />
                            </button>
                          </div>
                          <div className="debugger-graph-node__flow-row">
                            <div className="debugger-graph-node__flow-slot debugger-graph-node__flow-slot--input">
                              {spec?.inputs.filter((port) => port.kind === "flow").map((port) => (
                                <span
                                  key={`${node.id}-in-${port.name}`}
                                  className="debugger-graph-port debugger-graph-port--input debugger-graph-port--flow"
                                  data-port-direction="in"
                                  data-port-kind={port.kind}
                                >
                                  <span
                                    className="debugger-graph-port__anchor"
                                    ref={(element) => {
                                      const key = `${node.id}:input:${port.name}`;
                                      if (element) portRefs.current.set(key, element);
                                      else portRefs.current.delete(key);
                                    }}
                                  >
                                    <ChevronRight size={10} strokeWidth={2.6} className="debugger-graph-port__icon" />
                                  </span>
                                  <span className="debugger-graph-port__label">{port.label ?? port.name}</span>
                                </span>
                              ))}
                            </div>
                            <div className="debugger-graph-node__flow-slot debugger-graph-node__flow-slot--output">
                              {spec?.outputs.filter((port) => port.kind === "flow").map((port) => (
                                <span
                                  key={`${node.id}-out-${port.name}`}
                                  className="debugger-graph-port debugger-graph-port--output debugger-graph-port--flow"
                                  data-port-direction="out"
                                  data-port-kind={port.kind}
                                >
                                  <span className="debugger-graph-port__label">{port.label ?? port.name}</span>
                                  <span
                                    className="debugger-graph-port__anchor"
                                    ref={(element) => {
                                      const key = `${node.id}:output:${port.name}`;
                                      if (element) portRefs.current.set(key, element);
                                      else portRefs.current.delete(key);
                                    }}
                                  >
                                    <ChevronRight size={10} strokeWidth={2.6} className="debugger-graph-port__icon" />
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="debugger-graph-node__ports">
                            <div className="debugger-graph-node__ports-col">
                              {spec?.inputs.filter((port) => port.kind !== "flow").map((port) => (
                                <span
                                  key={`${node.id}-in-${port.name}`}
                                  className="debugger-graph-port debugger-graph-port--input"
                                  data-port-direction="in"
                                  data-port-kind={port.kind}
                                >
                                  <span
                                    className="debugger-graph-port__anchor"
                                    ref={(element) => {
                                      const key = `${node.id}:input:${port.name}`;
                                      if (element) portRefs.current.set(key, element);
                                      else portRefs.current.delete(key);
                                    }}
                                  />
                                  <span className="debugger-graph-port__label">{port.label ?? port.name}</span>
                                </span>
                              ))}
                            </div>
                            <div className="debugger-graph-node__ports-col debugger-graph-node__ports-col--right">
                              {spec?.outputs.filter((port) => port.kind !== "flow").map((port) => (
                                <span
                                  key={`${node.id}-out-${port.name}`}
                                  className="debugger-graph-port debugger-graph-port--output"
                                  data-port-direction="out"
                                  data-port-kind={port.kind}
                                >
                                  <span className="debugger-graph-port__label">{port.label ?? port.name}</span>
                                  <span
                                    className="debugger-graph-port__anchor"
                                    ref={(element) => {
                                      const key = `${node.id}:output:${port.name}`;
                                      if (element) portRefs.current.set(key, element);
                                      else portRefs.current.delete(key);
                                    }}
                                  />
                                </span>
                              ))}
                            </div>
                          </div>
                          {node.data && Object.keys(node.data).length > 0 && (
                            <div className="debugger-graph-node__data">
                              {Object.entries(node.data).map(([key, value]) => (
                                <div key={key} className="debugger-graph-node__row">
                                  <span>{key}</span>
                                  <strong>{formatGraphValue(value)}</strong>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
            <aside className="debugger-panel" style={{ minHeight: 0 }}>
              <div className="debugger-graph-side-title">Inspector</div>
              <div className="debugger-graph-meta" style={{ marginTop: 0 }}>
                <span>selected: <strong>{selectedNode?.id ?? "none"}</strong></span>
                <span>version: <strong>{graph.version}</strong></span>
              </div>
              {selectedNode ? (
                <>
                  <div className="debugger-graph-description" style={{ marginBottom: 8 }}>{selectedNode.type}</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div className="debugger-field"><span>UUID</span><strong>{selectedNode.id}</strong></div>
                      {GRAPH_NODE_LIBRARY.find((spec) => spec.type === selectedNode.type)?.fields.map((field) => (
                        <label key={field.name} className="debugger-field debugger-field--editable">
                          <span>{field.label}</span>
                          <input
                            className="debugger-field__input"
                            value={formatEditableValue(selectedNode.data?.[field.name], field.type)}
                            disabled={props.keyboardLocked}
                            onChange={(event) => updateNodeData(selectedNode.id, field.name, event.target.value, field.type)}
                          />
                        </label>
                      ))}
                    <div className="debugger-field">
                      <span>Ports</span>
                      <strong>{describeNodePorts(selectedNode.type)}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <div className="debugger-content-empty">select a node</div>
              )}
              <div className="debugger-graph-side-title" style={{ marginTop: 14 }}>Connections</div>
              <div className="debugger-graph-connection-list">
                {graph.edges.length === 0 ? (
                  <div className="debugger-content-empty">no connections</div>
                ) : graph.edges.map((edge) => {
                  const id = edgeKey(edge);
                  const from = nodeMap.get(edge.from.node);
                  const to = nodeMap.get(edge.to.node);
                  const isSelected = selectedEdgeKey === id;
                  return (
                    <div
                      key={id}
                      className={`debugger-graph-connection${isSelected ? " is-selected" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedEdgeKey(id)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setSelectedEdgeKey(id);
                      }}
                    >
                      <span className="debugger-graph-connection__flow">
                        {from ? `${from.type}.${edge.from.port}` : edge.from.node}
                        <strong>→</strong>
                        {to ? `${to.type}.${edge.to.port}` : edge.to.node}
                      </span>
                      <span className="debugger-graph-connection__actions">
                        <span className={`debugger-pill${isSelected ? " is-active" : ""}`}>wire</span>
                        <button
                          className="debugger-graph-connection__delete"
                          aria-label="Delete connection"
                          title="Delete connection"
                          disabled={props.keyboardLocked}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteEdge(id);
                          }}
                        >
                          <Trash2 size={11} strokeWidth={2.5} />
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function ContentPreviewDialog(props: {
  path: string;
  value: unknown;
  loading: boolean;
  error?: string;
  onClose: () => void;
}) {
  return createPortal(
    <div className="debugger-content-preview" role="dialog" aria-modal="true" onClick={props.onClose}>
      <div className="debugger-content-preview__panel" onClick={(event) => event.stopPropagation()}>
        <div className="debugger-content-preview__header">
          <div>
            <div className="debugger-section__title" style={{ marginBottom: 4 }}>File Preview</div>
            <div className="debugger-content-preview__subtitle">{props.path}</div>
          </div>
          <button className="debugger-content-action" onClick={props.onClose} aria-label="Close preview">
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>
        {props.loading ? (
          <div className="debugger-content-empty">loading file…</div>
        ) : props.error ? (
          <div className="debugger-content-empty">{props.error}</div>
        ) : (
          <pre className="debugger-content-preview__json">{JSON.stringify(props.value, null, 2)}</pre>
        )}
      </div>
    </div>,
    document.body,
  );
}

function ContentCreateDialog(props: {
  kind: "folder" | "world" | "component" | "prefab" | "graph";
  basePath: string;
  name: string;
  currentChildren: ContentTreeNode[];
  keyboardLocked: boolean;
  onNameChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const exists = props.currentChildren.some((node) => node.name === props.name.trim());
  return createPortal(
    <div className="debugger-content-dialog" role="dialog" aria-modal="true" onClick={props.onClose}>
      <div className="debugger-content-dialog__panel" onClick={(event) => event.stopPropagation()}>
        <div className="debugger-content-dialog__header">
          <div>
            <div className="debugger-section__title" style={{ marginBottom: 4 }}>Create {props.kind}</div>
            <div className="debugger-content-dialog__subtitle">{props.basePath || "root"}</div>
          </div>
          <button className="debugger-content-action" onClick={props.onClose} aria-label="Close dialog">
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>
        <div className="debugger-content-dialog__body">
          <label className="debugger-field debugger-field--editable">
            <span>Name</span>
            <input
              className="debugger-input"
              autoFocus
              placeholder={props.kind === "folder" ? "folder name…" : props.kind === "component" ? "component name…" : props.kind === "prefab" ? "prefab name…" : props.kind === "graph" ? "system name…" : "world name…"}
              value={props.name}
              disabled={props.keyboardLocked}
              onChange={(event) => props.onNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") props.onConfirm();
                if (event.key === "Escape") props.onClose();
              }}
            />
          </label>
          {exists && props.name.trim() && !props.keyboardLocked ? <div className="debugger-content-dialog__error">already exists</div> : null}
        </div>
        <div className="debugger-content-dialog__footer">
          <button className="debugger-content-action" onClick={props.onClose}>Cancel</button>
          <button className="debugger-content-action debugger-content-action--primary" onClick={props.onConfirm} disabled={!props.name.trim() || exists || props.keyboardLocked}>
            Create
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ContentImportDialog(props: {
  basePath: string;
  file: File | null;
  error?: string;
  busy: boolean;
  keyboardLocked: boolean;
  onPickFile: () => void;
  onClose: () => void;
  onImport: () => void;
}) {
  return createPortal(
    <div className="debugger-content-dialog" role="dialog" aria-modal="true" onClick={props.onClose}>
      <div className="debugger-content-dialog__panel" onClick={(event) => event.stopPropagation()}>
        <div className="debugger-content-dialog__header">
          <div>
            <div className="debugger-section__title" style={{ marginBottom: 4 }}>Import content</div>
            <div className="debugger-content-dialog__subtitle">{props.basePath || "root"}</div>
          </div>
          <button className="debugger-content-action" onClick={props.onClose} aria-label="Close dialog">
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>
        <div className="debugger-content-dialog__body">
          <div className="debugger-content-dialog__hint">Choose a JSON file, then import it into the current folder.</div>
          <div className="debugger-content-dialog__filebox">
            <div className="debugger-content-dialog__filelabel">{props.file ? props.file.name : "No file chosen"}</div>
            <button className="debugger-content-action" onClick={props.onPickFile} disabled={props.keyboardLocked}>
              Choose File
            </button>
          </div>
          {props.error ? <div className="debugger-content-dialog__error">{props.error}</div> : null}
        </div>
        <div className="debugger-content-dialog__footer">
          <button className="debugger-content-action" onClick={props.onClose}>Cancel</button>
          <button className="debugger-content-action debugger-content-action--primary" onClick={props.onImport} disabled={!props.file || props.keyboardLocked || props.busy}>
            {props.busy ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DeleteContentDialog(props: {
  node: ContentTreeNode;
  keyboardLocked: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return createPortal(
    <div className="debugger-content-dialog" role="dialog" aria-modal="true" onClick={props.onClose}>
      <div className="debugger-content-dialog__panel" onClick={(event) => event.stopPropagation()}>
        <div className="debugger-content-dialog__header">
          <div>
            <div className="debugger-section__title" style={{ marginBottom: 4 }}>Delete {props.node.kind}</div>
            <div className="debugger-content-dialog__subtitle">{props.node.path || "root"}</div>
          </div>
          <button className="debugger-content-action" onClick={props.onClose} aria-label="Close dialog">
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>
        <div className="debugger-content-dialog__body">
          <div className="debugger-content-dialog__hint">This action cannot be undone.</div>
        </div>
        <div className="debugger-content-dialog__footer">
          <button className="debugger-content-action" onClick={props.onClose}>Cancel</button>
          <button className="debugger-content-action debugger-content-action--danger" onClick={props.onConfirm} disabled={props.keyboardLocked}>
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function renderContentIcon(kind: ContentTreeNode["kind"]) {
  switch (kind) {
    case "folder":
      return <Folder size={14} strokeWidth={2} />;
    case "world":
      return <Globe size={14} strokeWidth={2} />;
    case "component":
      return <Puzzle size={14} strokeWidth={2} />;
    case "prefab":
      return <Package size={14} strokeWidth={2} />;
    case "graph":
      return <Workflow size={14} strokeWidth={2} />;
    case "file":
      return <FileJson size={14} strokeWidth={2} />;
  }
}

function createGraphNode(spec: GraphNodeSpec, position: { x: number; y: number }): GraphAsset["nodes"][number] {
  return {
    id: crypto.randomUUID(),
    type: spec.type,
    position: {
      x: Math.round(position.x),
      y: Math.round(position.y),
    },
    data: {},
  };
}

function parseEditableValue(value: string, type: GraphNodeSpec["fields"][number]["type"]) {
  if (type === "number") {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? 0 : numeric;
  }
  if (type === "boolean") return value.trim().toLowerCase() === "true";
  if (type === "json") {
    if (value.trim() === "") return undefined;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function formatEditableValue(value: unknown, type: GraphNodeSpec["fields"][number]["type"]) {
  if (value === undefined) return "";
  if (type === "json") return JSON.stringify(value, null, 2);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseJsonInput(input: string, fallback: unknown) {
  if (input.trim() === "") return fallback;
  try {
    return JSON.parse(input);
  } catch {
    return fallback;
  }
}

function formatJsonValue(value: unknown) {
  if (value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function describeNodePorts(type: GraphNodeDefinition["type"]) {
  const spec = GRAPH_NODE_LIBRARY.find((entry) => entry.type === type);
  if (!spec) return "flow";
  const inputs = spec.inputs.map((port) => port.name).join(", ") || "-";
  const outputs = spec.outputs.map((port) => port.name).join(", ") || "-";
  return `in: ${inputs} | out: ${outputs}`;
}

function edgeKey(edge: GraphAsset["edges"][number]) {
  return `${edge.from.node}:${edge.from.port}->${edge.to.node}:${edge.to.port}`;
}

function moveGraphNode(graph: GraphAsset, nodeId: string, deltaX: number, deltaY: number): GraphAsset {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => (
      node.id === nodeId
        ? {
            ...node,
            position: {
              x: Math.round(node.position.x + deltaX),
              y: Math.round(node.position.y + deltaY),
            },
          }
        : node
    )),
  };
}

function fitGraphView(viewportWidth: number, viewportHeight: number, bounds: { x: number; y: number; width: number; height: number }) {
  const padding = 56;
  const usableWidth = Math.max(1, viewportWidth - padding * 2);
  const usableHeight = Math.max(1, viewportHeight - padding * 2);
  const zoom = clamp(Math.min(usableWidth / bounds.width, usableHeight / bounds.height), 0.2, 2);
  return {
    zoom,
    x: (viewportWidth - bounds.width * zoom) / 2,
    y: (viewportHeight - bounds.height * zoom) / 2,
  };
}

function toGraphPoint(
  viewport: HTMLDivElement | null,
  graphView: { x: number; y: number; zoom: number },
  clientX: number,
  clientY: number,
) {
  if (!viewport) return null;
  const rect = viewport.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  return {
    x: (x - graphView.x) / graphView.zoom,
    y: (y - graphView.y) / graphView.zoom,
  };
}

function computeGraphBounds(graph: GraphAsset) {
  const padX = 112;
  const padY = 96;
  const cardWidth = 246;
  const cardHeight = 176;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of graph.nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + cardWidth);
    maxY = Math.max(maxY, node.position.y + cardHeight);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { x: 0, y: 0, width: 1400, height: 900 };
  }

  return {
    x: minX - padX,
    y: minY - padY,
    width: Math.max(1400, maxX - minX + padX * 2),
    height: Math.max(900, maxY - minY + padY * 2),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getGraphNodeCenter(node: GraphAsset["nodes"][number], bounds: { x: number; y: number }) {
  return {
    x: node.position.x - bounds.x + 123,
    y: node.position.y - bounds.y + 88,
  };
}

function getGraphPortPoint(
  node: GraphAsset["nodes"][number],
  portName: string,
  direction: "input" | "output",
  bounds: { x: number; y: number },
) {
  const spec = GRAPH_NODE_LIBRARY.find((entry) => entry.type === node.type);
  const ports = direction === "input" ? spec?.inputs ?? [] : spec?.outputs ?? [];
  const portIndex = Math.max(0, ports.findIndex((port) => port.name === portName));
  const center = getGraphNodeCenter(node, bounds);
  const xOffset = direction === "input" ? -116 : 116;
  const yOffset = -42 + Math.min(portIndex, 4) * 20;
  return {
    x: center.x + xOffset,
    y: center.y + yOffset,
  };
}

function formatGraphValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map((entry) => formatGraphValue(entry)).join(", ")}]`;
  if (value && typeof value === "object") return "{…}";
  return String(value);
}
