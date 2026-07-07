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
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
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
  onToggleWorldSystem?: (name: string) => void;
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
  onToggleWorldSystem?: (name: string) => void;
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
      <div className="debugger-content-systems-header">
        <div className="debugger-section__title" style={{ marginBottom: 0 }}>World Systems</div>
        <span className="debugger-content-browser__hint">{props.activeSystems?.length ?? 0} loaded</span>
      </div>
      <div className="debugger-content-systems">
        {(props.activeSystems ?? []).length === 0 ? (
          <div className="debugger-content-empty">no systems loaded</div>
        ) : (props.activeSystems ?? []).map((name) => (
          <div className="debugger-content-system-row" key={name}>
            <button className="debugger-content-system" onClick={() => setOpenGraphName(name)}>
              <span className="debugger-content-system__name">{name}</span>
              <span className="debugger-pill is-active">loaded</span>
            </button>
            {props.onToggleWorldSystem && (
              <button
                className="debugger-content-system__toggle"
                onClick={() => props.onToggleWorldSystem?.(name)}
                title="Remove from world"
                aria-label={`Remove ${name} from world`}
              >
                <X size={12} strokeWidth={2.4} />
              </button>
            )}
          </div>
        ))}
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
          {selectedFolderPath === "systems" && props.onToggleWorldSystem && (
            <div className="debugger-content-systems">
              {currentChildren.filter((node) => node.kind === "graph").map((node) => (
                <button
                  key={node.path}
                  className={`debugger-content-system${activeSystems.has(node.name) ? " is-active" : ""}`}
                  onClick={() => props.onToggleWorldSystem?.(node.name)}
                >
                  <span className="debugger-content-system__name">{node.name}</span>
                  <span className={`debugger-pill${activeSystems.has(node.name) ? " is-active" : ""}`}>
                    {activeSystems.has(node.name) ? "loaded" : "disabled"}
                  </span>
                </button>
              ))}
            </div>
          )}
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
                  <button
                    className={`debugger-content-item__action${activeSystems.has(node.name) ? " is-active" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onToggleWorldSystem?.(node.name);
                    }}
                    title={activeSystems.has(node.name) ? "Remove from world" : "Add to world"}
                    aria-label={activeSystems.has(node.name) ? `Remove ${node.name}` : `Add ${node.name}`}
                  >
                    {activeSystems.has(node.name) ? "loaded" : "available"}
                  </button>
                ) : node.kind !== "folder" ? <span className="debugger-pill">{node.kind}</span> : null}
              </button>
            ))}
          </div>
        </section>
      </div>
      {openGraphName && (
        <GraphDialog
          graph={openGraph}
          loading={openGraphLoading}
          error={openGraphError}
          onClose={() => setOpenGraphName(undefined)}
        />
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

type GraphAsset = {
  version: 1;
  name: string;
  entrypoint: string;
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data?: Record<string, unknown>;
  }>;
  edges: Array<{
    from: { node: string; port: string };
    to: { node: string; port: string };
  }>;
  metadata?: {
    order?: number;
    description?: string;
  };
};

async function fetchGraphAsset(name: string): Promise<GraphAsset | null> {
  const response = await fetch(`/api/content/file?path=${encodeURIComponent(`systems/${name}`)}`);
  if (!response.ok) return null;
  const raw = await response.json();
  return parseGraphAsset(raw);
}

function parseGraphAsset(value: unknown): GraphAsset | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<GraphAsset>;
  if (parsed.version !== 1 || typeof parsed.name !== "string" || typeof parsed.entrypoint !== "string" || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    return null;
  }
  const nodes = parsed.nodes.filter(isGraphNode);
  const edges = parsed.edges.filter(isGraphEdge);
  return {
    version: 1,
    name: parsed.name,
    entrypoint: parsed.entrypoint,
    nodes,
    edges,
    metadata: typeof parsed.metadata === "object" && parsed.metadata !== null ? parsed.metadata as GraphAsset["metadata"] : undefined,
  };
}

function isGraphNode(value: unknown): value is GraphAsset["nodes"][number] {
  if (!value || typeof value !== "object") return false;
  const node = value as Partial<GraphAsset["nodes"][number]>;
  return typeof node.id === "string"
    && typeof node.type === "string"
    && typeof node.position === "object"
    && node.position !== null
    && typeof (node.position as { x?: unknown }).x === "number"
    && typeof (node.position as { y?: unknown }).y === "number";
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
}) {
  const graph = props.graph;
  const bounds = graph ? computeGraphBounds(graph) : { x: 0, y: 0, width: 960, height: 540 };
  const nodeMap = new Map(graph?.nodes.map((node) => [node.id, node]) ?? []);

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
          <>
            <div className="debugger-graph-meta">
              <span>entrypoint: <strong>{graph.entrypoint}</strong></span>
              <span>nodes: <strong>{graph.nodes.length}</strong></span>
              <span>edges: <strong>{graph.edges.length}</strong></span>
              <span>order: <strong>{graph.metadata?.order ?? "n/a"}</strong></span>
            </div>
            {graph.metadata?.description && <div className="debugger-graph-description">{graph.metadata.description}</div>}
            <div className="debugger-graph-canvas__scroll">
              <div className="debugger-graph-canvas" style={{ width: `${bounds.width}px`, height: `${bounds.height}px` }}>
                <svg className="debugger-graph-canvas__edges" width={bounds.width} height={bounds.height} viewBox={`0 0 ${bounds.width} ${bounds.height}`}>
                  {graph.edges.map((edge, index) => {
                    const from = nodeMap.get(edge.from.node);
                    const to = nodeMap.get(edge.to.node);
                    if (!from || !to) return null;
                    const fromPoint = getGraphNodeCenter(from, bounds);
                    const toPoint = getGraphNodeCenter(to, bounds);
                    const mid = (fromPoint.x + toPoint.x) / 2;
                    const path = `M ${fromPoint.x} ${fromPoint.y} C ${mid} ${fromPoint.y}, ${mid} ${toPoint.y}, ${toPoint.x} ${toPoint.y}`;
                    return <path key={`${edge.from.node}-${edge.to.node}-${index}`} d={path} />;
                  })}
                </svg>
                {graph.nodes.map((node) => (
                  <div
                    key={node.id}
                    className={`debugger-graph-node${node.id === graph.entrypoint ? " is-entrypoint" : ""}`}
                    style={{
                      left: `${node.position.x - bounds.x}px`,
                      top: `${node.position.y - bounds.y}px`,
                    }}
                  >
                    <div className="debugger-graph-node__title">{node.id}</div>
                    <div className="debugger-graph-node__type">{node.type}</div>
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
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function computeGraphBounds(graph: GraphAsset) {
  const padX = 72;
  const padY = 60;
  const cardWidth = 188;
  const cardHeight = 112;
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
    return { x: 0, y: 0, width: 960, height: 540 };
  }

  return {
    x: minX - padX,
    y: minY - padY,
    width: Math.max(960, maxX - minX + padX * 2),
    height: Math.max(540, maxY - minY + padY * 2),
  };
}

function getGraphNodeCenter(node: GraphAsset["nodes"][number], bounds: { x: number; y: number }) {
  return {
    x: node.position.x - bounds.x + 94,
    y: node.position.y - bounds.y + 56,
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
