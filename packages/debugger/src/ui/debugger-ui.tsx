import {
  Camera,
  Check,
  Crosshair,
  Expand,
  FolderOpen,
  Layers,
  LocateFixed,
  MousePointer2,
  Minus,
  Pause,
  Plus,
  Play,
  Redo2,
  RotateCw,
  ScanSearch,
  StepForward,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { EditorToolMode } from "../shared/types";

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
  worldsOpen: boolean;
  worlds: { name: string }[];
  activeWorld?: string;
  onToggleWorlds: () => void;
  onLoadWorld: (name: string) => void;
  newWorldName: string | undefined;
  onStartCreatingWorld: () => void;
  onCancelCreatingWorld: () => void;
  onSetNewWorldName: (value: string) => void;
  onConfirmCreateWorld: () => void;
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
              <button className={props.worldsOpen ? "is-active" : ""} onClick={props.onToggleWorlds} title="Worlds" aria-label="Worlds">
                <Layers size={14} strokeWidth={2} />
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
          {props.worldsOpen && (
            <section className="debugger-section debugger-section--worlds">
              <div className="debugger-worlds-header">
                <div className="debugger-section__title" style={{ marginBottom: 0 }}>Worlds</div>
                {props.newWorldName === undefined && (
                  <button className="debugger-worlds-new" onClick={props.onStartCreatingWorld} title="New World">+</button>
                )}
              </div>
              <div className="debugger-worlds-list">
                {props.worlds.map((w) => (
                  <button
                    key={w.name}
                    className={`debugger-world-item${w.name === props.activeWorld ? " is-active" : ""}`}
                    onClick={() => props.onLoadWorld(w.name)}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
              {props.newWorldName !== undefined && (
                <div className="debugger-worlds-create">
                  <input
                    className="debugger-input debugger-worlds-create__input"
                    placeholder="world name…"
                    value={props.newWorldName}
                    autoFocus
                    onChange={(e) => props.onSetNewWorldName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") props.onConfirmCreateWorld();
                      if (e.key === "Escape") props.onCancelCreatingWorld();
                    }}
                  />
                  <div className="debugger-worlds-create__actions">
                    <button
                      className="debugger-worlds-create__btn debugger-worlds-create__btn--confirm"
                      onClick={props.onConfirmCreateWorld}
                      title="Create"
                      disabled={
                        !props.newWorldName?.trim() ||
                        props.worlds.some((w) => w.name === props.newWorldName?.trim())
                      }
                    >
                      <Check size={12} strokeWidth={2.5} />
                    </button>
                    <button
                      className="debugger-worlds-create__btn debugger-worlds-create__btn--cancel"
                      onClick={props.onCancelCreatingWorld}
                      title="Cancel"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                  {props.worlds.some((w) => w.name === props.newWorldName?.trim()) && props.newWorldName?.trim() && (
                    <span className="debugger-worlds-create__error">already exists</span>
                  )}
                </div>
              )}
            </section>
          )}
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
        <section className="debugger-panel debugger-panel--bottom">
          <section className="debugger-section debugger-section--grow">
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
