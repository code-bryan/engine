import {
  Camera,
  Check,
  Crosshair,
  ChevronDown,
  ChevronRight,
  Expand,
  FileJson,
  FilePlus2,
  FolderOpen,
  FolderPlus,
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
  Trash2,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react";
import { GRAPH_NODE_LIBRARY, type GraphDefinition, type GraphNodeDefinition, type GraphNodeSpec, type GraphVariableDefinition } from "@engine/runtime";
import type { ContentTreeNode, EditorToolMode } from "../shared/types";

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

export type DebuggerUiProps = {
  fps: string;
  frameMs: string;
  playbackState: "playing" | "paused" | "stopped";
  zoomLabel: string;
  showGrid: boolean;
  showPhysics: boolean;
  showLabels: boolean;
  showSprites: boolean;
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
  onToggleContentDrawer: () => void;
};

export function DebuggerUi(props: DebuggerUiProps) {
  const selectedEntityRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    selectedEntityRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [props.entities]);

  return (
    <>
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
      <div className="debugger-layout" onClickCapture={props.onCloseMenus}>
        <header className="debugger-toolbar">
          <div className="debugger-toolbar__left">
            <div className={`debugger-dropdown${props.debugMenuOpen ? " is-open" : ""}`} data-dropdown-root onClick={(event) => event.stopPropagation()}>
              <button className="debugger-dropdown__trigger" onClick={props.onToggleDebugMenu}>
                Debug <span aria-hidden="true">▾</span>
              </button>
              <div className="debugger-dropdown__panel">
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
            <div className="debugger-tool-group">
              <button className={props.contentDrawerOpen ? "is-active" : ""} onClick={props.onToggleContentDrawer} title="Content" aria-label="Content Drawer">
                <FolderOpen size={14} strokeWidth={2} />
              </button>
            </div>
            <div className="debugger-tool-group" aria-label="Editor tools">
              <button className={props.toolMode === "select" ? "is-active" : ""} onClick={() => props.onSetToolMode("select")} title="Select Tool" aria-label="Select Tool">
                <MousePointer2 size={14} strokeWidth={2} />
              </button>
              <button className={props.toolMode === "move" ? "is-active" : ""} onClick={() => props.onSetToolMode("move")} title="Move Tool" aria-label="Move Tool">
                <Crosshair size={14} strokeWidth={2} />
              </button>
              <button className={props.toolMode === "scale" ? "is-active" : ""} onClick={() => props.onSetToolMode("scale")} title="Scale Tool" aria-label="Scale Tool">
                <Expand size={14} strokeWidth={2} />
              </button>
              <button className={props.toolMode === "rotate" ? "is-active" : ""} onClick={() => props.onSetToolMode("rotate")} title="Rotate Tool" aria-label="Rotate Tool">
                <RotateCw size={14} strokeWidth={2} />
              </button>
            </div>
          {props.onOpenLevel && (
            <button onClick={props.onOpenLevel} title="Open Level" aria-label="Open Level">
              <FolderOpen size={14} strokeWidth={2} />
            </button>
          )}
          </div>
          <div className="debugger-toolbar__playback">
            <button className={props.playbackState === "playing" ? "is-active" : ""} onClick={() => props.onPlaybackAction("play")} title="Play" aria-label="Play"><Play size={14} fill="currentColor" strokeWidth={2} /></button>
            <button className={props.playbackState === "paused" ? "is-active" : ""} onClick={() => props.onPlaybackAction("pause")} title="Pause" aria-label="Pause"><Pause size={14} fill="currentColor" strokeWidth={2} /></button>
            <button onClick={() => props.onPlaybackAction("step")} title="Step Frame" aria-label="Step Frame"><StepForward size={14} strokeWidth={2} /></button>
            <button className={props.playbackState === "stopped" ? "is-active" : ""} onClick={() => props.onPlaybackAction("stop")} title="Restart" aria-label="Restart"><Redo2 size={14} strokeWidth={2} /></button>
          </div>
          <div className="debugger-toolbar__actions">
            <div className="debugger-zoom-group">
              <button onClick={() => props.onZoomAction("zoom-out")} title="Zoom Out" aria-label="Zoom Out"><Minus size={14} strokeWidth={2} /></button>
              <button className="debugger-zoom-value" onClick={() => props.onZoomAction("zoom-100")} title="Reset to 100%">{props.zoomLabel}</button>
              <button onClick={() => props.onZoomAction("zoom-in")} title="Zoom In" aria-label="Zoom In"><Plus size={14} strokeWidth={2} /></button>
              <button onClick={() => props.onZoomAction("zoom-fit")} title="Fit game in viewport" aria-label="Fit game in viewport"><ScanSearch size={14} strokeWidth={2} /></button>
              <div className="debugger-zoom-sep"></div>
              <button onClick={() => props.onZoomAction("camera-reset")} title="Reset Camera" aria-label="Reset Camera"><LocateFixed size={14} strokeWidth={2} /></button>
              <button className={props.cameraLocked ? "is-active" : ""} onClick={props.onToggleCameraLock} title="Lock Camera to Entity" aria-label="Lock Camera to Entity"><Camera size={14} strokeWidth={2} /></button>
            </div>
          </div>
        </header>
        <aside className="debugger-panel debugger-panel--left">
          <div className="debugger-sidepanels">
            {props.statusCards.map((card) => <RuntimeCard key={card.title} title={card.title} fields={card.fields} />)}
          </div>
          <section className="debugger-section">
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
        </aside>
        <aside className="debugger-panel debugger-panel--right">
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
        </aside>
        <section className={`debugger-panel debugger-panel--bottom${props.contentDrawerOpen ? " debugger-panel--bottom--content-open" : ""}`}>
          {props.contentDrawerOpen && (
            <ContentBrowser
              tree={props.contentTree}
              activeWorld={props.activeWorld}
              activeSystems={props.activeSystems}
              onLoadWorld={props.onLoadWorld}
              onCreateFolder={props.onCreateFolder}
              onCreateWorld={props.onCreateWorld}
            />
          )}
          <section className="debugger-section debugger-section--grow debugger-section--log">
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
        </section>
      </div>
    </>
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
}) {
  const [selectedFolderPath, setSelectedFolderPath] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set([""]));
  const [search, setSearch] = useState("");
  const [createKind, setCreateKind] = useState<"folder" | "world" | "component" | undefined>();
  const [createName, setCreateName] = useState("");
  const [openGraphName, setOpenGraphName] = useState<string | undefined>();
  const [openGraph, setOpenGraph] = useState<GraphAsset | null>(null);
  const [openGraphLoading, setOpenGraphLoading] = useState(false);
  const [openGraphError, setOpenGraphError] = useState<string | undefined>();

  useEffect(() => {
    const nextFolder = parentContentPath(props.activeWorld);
    setSelectedFolderPath(nextFolder);
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      for (const crumb of breadcrumbPaths(nextFolder)) next.add(crumb.path);
      return next;
    });
  }, [props.activeWorld]);

  useEffect(() => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      for (const crumb of breadcrumbPaths(selectedFolderPath)) next.add(crumb.path);
      return next;
    });
  }, [selectedFolderPath]);

  const currentFolder = findContentFolder(props.tree, selectedFolderPath);
  const currentChildren = currentFolder?.children ?? props.tree;
  const filteredChildren = search.trim()
    ? currentChildren.filter((node) => `${node.name} ${node.path}`.toLowerCase().includes(search.trim().toLowerCase()))
    : currentChildren;
  const currentBreadcrumbs = breadcrumbPaths(selectedFolderPath);
  const activeSystems = new Set(props.activeSystems ?? []);

  const canCreateComponent = Boolean(props.onCreateComponent) && (selectedFolderPath === "components" || selectedFolderPath.startsWith("components/"));

  const startCreate = (kind: "folder" | "world" | "component") => {
    setCreateKind(kind);
    setCreateName("");
  };

  const confirmCreate = () => {
    const name = createName.trim();
    if (!name) return;
    if (currentChildren.some((node) => node.name === name)) return;

    const nextPath = joinContentPath(selectedFolderPath, name);
    if (createKind === "folder") {
      props.onCreateFolder?.(nextPath);
    } else if (createKind === "component") {
      props.onCreateComponent?.(nextPath);
    } else {
      props.onCreateWorld(nextPath);
    }
    setCreateKind(undefined);
    setCreateName("");
  };

  useEffect(() => {
    if (!openGraphName) {
      setOpenGraph(null);
      setOpenGraphError(undefined);
      setOpenGraphLoading(false);
      return;
    }

    let alive = true;
    setOpenGraphLoading(true);
    setOpenGraphError(undefined);
    setOpenGraph(null);

    fetchGraphAsset(openGraphName)
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
  }, [openGraphName]);

  return (
    <section className="debugger-section debugger-section--content">
      <div className="debugger-content-header">
        <div>
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
          {props.onCreateFolder && (
            <button className="debugger-content-action" onClick={() => startCreate("folder")} title="New Folder" aria-label="New Folder">
              <FolderPlus size={13} strokeWidth={2} />
            </button>
          )}
          {canCreateComponent && (
            <button className="debugger-content-action" onClick={() => startCreate("component")} title="New Component" aria-label="New Component">
              <Puzzle size={13} strokeWidth={2} />
            </button>
          )}
          <button className="debugger-content-action" onClick={() => startCreate("world")} title="New World" aria-label="New World">
            <FilePlus2 size={13} strokeWidth={2} />
          </button>
          <button className="debugger-content-action" onClick={() => setSearch("")} title="Clear search" aria-label="Clear search">
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
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {createKind && (
        <div className="debugger-content-create">
          <input
            className="debugger-input debugger-content-create__input"
            autoFocus
            placeholder={createKind === "folder" ? "folder name…" : createKind === "component" ? "component name…" : "world name…"}
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") confirmCreate();
              if (event.key === "Escape") {
                setCreateKind(undefined);
                setCreateName("");
              }
            }}
          />
          <div className="debugger-content-create__actions">
            <button className="debugger-content-create__btn debugger-content-create__btn--confirm" onClick={confirmCreate} disabled={!createName.trim() || currentChildren.some((node) => node.name === createName.trim())}>
              <Check size={12} strokeWidth={2.5} />
            </button>
            <button
              className="debugger-content-create__btn debugger-content-create__btn--cancel"
              onClick={() => {
                setCreateKind(undefined);
                setCreateName("");
              }}
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
          {currentChildren.some((node) => node.name === createName.trim()) && createName.trim() && (
            <span className="debugger-content-create__error">already exists</span>
          )}
        </div>
      )}
      <div className="debugger-content-body">
        <aside className="debugger-content-tree">
          {props.tree.length === 0 ? (
            <div className="debugger-content-empty">no content</div>
          ) : (
            props.tree.map((node) => renderContentTreeNode(node, 0, selectedFolderPath, expandedFolders, setExpandedFolders, setSelectedFolderPath, props.onLoadWorld, activeSystems))
          )}
        </aside>
        <section className="debugger-content-browser">
          <div className="debugger-content-browser__header">
            <span className="debugger-section__title" style={{ marginBottom: 0 }}>Assets</span>
            <span className="debugger-content-browser__hint">
              {search.trim()
                ? "filtered"
                : selectedFolderPath === "systems"
                  ? `${[...activeSystems].filter((name) => currentChildren.some((node) => node.kind === "graph" && node.name === name)).length} active / ${currentChildren.length} total`
                  : `${currentChildren.length} item${currentChildren.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <div className="debugger-content-list">
            {filteredChildren.length === 0 ? (
              <div className="debugger-content-empty">{search.trim() ? "no matches" : "empty folder"}</div>
            ) : filteredChildren.map((node) => (
              <button
                key={node.path}
                className={`debugger-content-item${node.kind === "world" && node.path === props.activeWorld ? " is-active" : ""}`}
                onClick={() => {
                  if (node.kind === "folder") {
                    setSelectedFolderPath(node.path);
                    setExpandedFolders((prev) => new Set(prev).add(node.path));
                    return;
                  }
                  if (node.kind === "world") props.onLoadWorld(node.path);
                  if (node.kind === "graph") setOpenGraphName(node.name);
                }}
              >
                <span className="debugger-content-item__icon">
                  {node.kind === "folder" ? <FolderOpen size={13} strokeWidth={2} /> : node.kind === "component" || node.kind === "graph" ? <Puzzle size={13} strokeWidth={2} /> : <FileJson size={13} strokeWidth={2} />}
                </span>
                <span className="debugger-content-item__name">{node.name}</span>
                <span className="debugger-content-item__path">{node.path || "root"}</span>
                {node.kind === "graph" ? (
                  <span className={`debugger-pill${activeSystems.has(node.name) ? " is-active" : ""}`}>
                    {activeSystems.has(node.name) ? "loaded" : "available"}
                  </span>
                ) : node.kind !== "folder" ? <span className="debugger-pill">{node.kind}</span> : null}
              </button>
            ))}
          </div>
        </section>
      </div>
      {openGraphName && createPortal(
        <GraphDialog
          graph={openGraph}
          loading={openGraphLoading}
          error={openGraphError}
          onClose={() => setOpenGraphName(undefined)}
          onChange={(nextGraph) => setOpenGraph(nextGraph)}
          onSave={(nextGraph) => {
            setOpenGraph(nextGraph);
            void saveGraphAsset(nextGraph);
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

function renderContentTreeNode(
  node: ContentTreeNode,
  depth: number,
  selectedFolderPath: string,
  expandedFolders: Set<string>,
  setExpandedFolders: Dispatch<SetStateAction<Set<string>>>,
  setSelectedFolderPath: (path: string) => void,
  onLoadWorld: (path: string) => void,
  activeSystems: Set<string>,
) {
  const isFolder = node.kind === "folder";
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = isFolder && node.path === selectedFolderPath;
  const hasChildren = isFolder && (node.children?.length ?? 0) > 0;

  return (
    <div key={node.path} className="debugger-content-tree__node">
      <button
        className={`debugger-content-tree__row${isSelected ? " is-selected" : ""}`}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        onClick={() => {
          if (isFolder) {
            setSelectedFolderPath(node.path);
            const next = new Set(expandedFolders);
            if (next.has(node.path)) next.delete(node.path);
            else next.add(node.path);
            setExpandedFolders(next);
            return;
          }
          if (node.kind === "world") onLoadWorld(node.path);
        }}
      >
        <span className="debugger-content-tree__toggle">
          {isFolder ? (hasChildren ? (isExpanded ? <ChevronDown size={12} strokeWidth={2.2} /> : <ChevronRight size={12} strokeWidth={2.2} />) : <span className="debugger-content-tree__spacer" />) : <span className="debugger-content-tree__spacer" />}
        </span>
        <span className="debugger-content-tree__icon">
          {isFolder ? <FolderOpen size={12} strokeWidth={2} /> : node.kind === "component" || node.kind === "graph" ? <Puzzle size={12} strokeWidth={2} /> : <FileJson size={12} strokeWidth={2} />}
        </span>
        <span className="debugger-content-tree__name">{node.name}</span>
        {node.kind === "graph" ? (
          <span className={`debugger-pill${activeSystems.has(node.name) ? " is-active" : ""}`}>
            {activeSystems.has(node.name) ? "active" : "available"}
          </span>
        ) : node.kind !== "folder" ? <span className="debugger-pill">{node.kind}</span> : null}
      </button>
      {isFolder && isExpanded && node.children?.length
        ? node.children.map((child) => renderContentTreeNode(child, depth + 1, selectedFolderPath, expandedFolders, setExpandedFolders, setSelectedFolderPath, onLoadWorld, activeSystems))
        : null}
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

async function fetchGraphAsset(name: string): Promise<GraphAsset | null> {
  const response = await fetch(`/api/content/file?path=${encodeURIComponent(`systems/${name}`)}`);
  if (!response.ok) return null;
  const raw = await response.json();
  return parseGraphAsset(raw);
}

async function saveGraphAsset(graph: GraphAsset): Promise<void> {
  await fetch(`/api/content/file?path=${encodeURIComponent(`systems/${graph.name}`)}`, {
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
  onClose: () => void;
  onChange: (graph: GraphAsset) => void;
  onSave: (graph: GraphAsset) => void;
}) {
  const [graph, setGraph] = useState<GraphAsset | null>(props.graph);
  const graphRef = useRef<GraphAsset | null>(props.graph);
  const [bounds, setBounds] = useState(() => props.graph ? computeGraphBounds(props.graph) : { x: 0, y: 0, width: 960, height: 540 });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const portRefs = useRef(new Map<string, HTMLSpanElement>());
  const [portPoints, setPortPoints] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(props.graph?.entrypoint);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | undefined>();
  const nodeMap = new Map(graph?.nodes.map((node) => [node.id, node]) ?? []);
  const selectedNode = selectedNodeId ? graph?.nodes.find((node) => node.id === selectedNodeId) : undefined;
  const selectedEdge = selectedEdgeKey && graph ? graph.edges.find((edge) => edgeKey(edge) === selectedEdgeKey) : undefined;
  const dragState = useRef<{
    nodeId: string;
    pointerId: number;
    sourceGraph: GraphAsset;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    setGraph(props.graph);
    graphRef.current = props.graph;
    setBounds(props.graph ? computeGraphBounds(props.graph) : { x: 0, y: 0, width: 960, height: 540 });
    setSelectedNodeId(props.graph?.entrypoint);
    setSelectedEdgeKey(undefined);
  }, [props.graph]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const currentGraph = graphRef.current;
    if (!canvas || !currentGraph) return;

    const measure = () => {
      const canvasRect = canvas.getBoundingClientRect();
      const next: Record<string, { x: number; y: number }> = {};
      for (const [key, element] of portRefs.current) {
        const rect = element.getBoundingClientRect();
        next[key] = {
          x: rect.left - canvasRect.left + rect.width / 2,
          y: rect.top - canvasRect.top + rect.height / 2,
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
  }, [graph, bounds]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragState.current;
      const currentGraph = graphRef.current;
      if (!drag || !currentGraph || event.pointerId !== drag.pointerId) return;

      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      const nextGraph = moveGraphNode(drag.sourceGraph, drag.nodeId, deltaX, deltaY);
      graphRef.current = nextGraph;
      setGraph(nextGraph);
      props.onChange(nextGraph);
    };

    const finishDrag = (event: PointerEvent) => {
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

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>, nodeId: string) => {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    setSelectedNodeId(nodeId);
    dragState.current = {
      nodeId,
      pointerId: event.pointerId,
      sourceGraph: currentGraph,
      startX: event.clientX,
      startY: event.clientY,
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
          <button className="debugger-content-action" onClick={props.onClose} aria-label="Close graph dialog">
            <X size={13} strokeWidth={2.5} />
          </button>
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
                    <input className="debugger-input" value={variable.name} onChange={(event) => updateVariable(index, { name: event.target.value })} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <select className="debugger-input" value={variable.scope} onChange={(event) => updateVariable(index, { scope: event.target.value as GraphVariableDefinition["scope"] })}>
                        <option value="private">private</option>
                        <option value="public">public</option>
                      </select>
                      <input className="debugger-input" value={variable.type} onChange={(event) => updateVariable(index, { type: event.target.value })} />
                    </div>
                    <textarea
                      className="debugger-input"
                      rows={3}
                      value={formatJsonValue(variable.default)}
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
                <div ref={canvasRef} className="debugger-graph-canvas" style={{ width: `${bounds.width}px`, height: `${bounds.height}px` }}>
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
