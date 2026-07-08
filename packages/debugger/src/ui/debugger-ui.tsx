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
import { GRAPH_NODE_LIBRARY, getComponentDefinitions, type ComponentDefinition, type GraphDefinition, type GraphNodeDefinition, type GraphNodeSpec, type GraphVariableDefinition } from "@engine/runtime";
import type { ContentTreeNode, EditorToolMode } from "../shared/types";

const GRAPH_ZOOM_SENSITIVITY = 2.5;

const CONTENT_MENU_ITEM = "w-full text-left px-3 py-1.5 text-[#ccc] hover:bg-[#2d2d2d] hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#ccc]";
const DIALOG_BTN = "px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3a3a3a] border border-[#303030] rounded text-white transition-colors disabled:opacity-40";
const DIALOG_BTN_PRIMARY = "px-3 py-1.5 bg-[#0070e0] hover:bg-[#005bb5] border border-[#0070e0] rounded text-white transition-colors disabled:opacity-40";
const DIALOG_BTN_DANGER = "px-3 py-1.5 bg-[#b91c1c] hover:bg-[#dc2626] border border-[#b91c1c] rounded text-white transition-colors disabled:opacity-40";

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
  cur: number | null;
  avg: number | null;
  peak: number | null;
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
  snapGrid: boolean;
  snapGridSize: number;
  snapRotate: boolean;
  snapRotateDeg: number;
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
  onToggleGridSnap: () => void;
  onSetGridSnapSize: (value: number) => void;
  onCalcGridSnapSize: () => void;
  onToggleRotationSnap: () => void;
  onSetRotationSnapDeg: (value: number) => void;
  worlds: Array<{ path: string; name: string }>;
  worldName: string;
  sceneSelected: boolean;
  availableSystems: string[];
  onSelectScene: () => void;
  onAddSystem: (name: string) => void;
  onRemoveSystem: (name: string) => void;
  openDocs: Array<{ path: string; name: string; kind: "graph" | "component" }>;
  activeDoc: string | null;
  onOpenDoc: (path: string, kind: "graph" | "component") => void;
  onCloseDoc: (path: string) => void;
  onSelectDoc: (path: string) => void;
  onOpenWorld: (path: string) => void;
  onSelectWorld: (path: string) => void;
  onCloseWorld: (path: string) => void;
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
  const [windowPanel, setWindowPanel] = useState<BottomDrawerTab | null>(null);
  const [windowMenuOpen, setWindowMenuOpen] = useState(false);
  const [snapMenu, setSnapMenu] = useState<"grid" | "rot" | null>(null);
  const [zoomToastOpen, setZoomToastOpen] = useState(false);
  const zoomToastTimerRef = useRef<number | undefined>(undefined);
  const didMountRef = useRef(false);
  const isPlaying = props.playbackState === "playing";
  const selectedEntity = props.entities.find((entity) => entity.selected);
  const activeDocEntry = props.openDocs.find((doc) => doc.path === props.activeDoc);

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
    if (!windowMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-window-menu-root]")) return;
      setWindowMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [windowMenuOpen]);

  useEffect(() => {
    if (!snapMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-snap-menu-root]")) return;
      setSnapMenu(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [snapMenu]);

  useEffect(() => {
    if (!windowPanel) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWindowPanel(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [windowPanel]);

  const onToggleContentDrawer = props.onToggleContentDrawer;
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || !event.ctrlKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      onToggleContentDrawer();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onToggleContentDrawer]);

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
      <div className="absolute inset-0 flex flex-col text-xs pointer-events-none">
        {/* TOP HEADER BAR */}
        <header className="pointer-events-auto relative h-12 bg-[#181818] border-b border-[#303030] flex items-center justify-between px-3 select-none flex-shrink-0 z-30">
          <div className="flex items-center space-x-4">
            <div className="text-white font-bold text-sm tracking-wide flex items-center gap-2">
              <i className="ph-fill ph-hexagon text-[#0070e0] text-lg" />
              NEXUS
            </div>
            <nav className="flex space-x-1 text-[#cccccc]" data-window-menu-root onClick={(event) => event.stopPropagation()}>
              <div className="px-2 py-1 hover:bg-[#2d2d2d] rounded cursor-pointer transition-colors">File</div>
              <div className="px-2 py-1 hover:bg-[#2d2d2d] rounded cursor-pointer transition-colors">Edit</div>
              <div className="relative">
                <div
                  className={`px-2 py-1 rounded cursor-pointer transition-colors${windowMenuOpen ? " bg-[#2d2d2d] text-white" : " hover:bg-[#2d2d2d]"}`}
                  onClick={() => setWindowMenuOpen((open) => !open)}
                >
                  Window
                </div>
                {windowMenuOpen && (
                  <div className="absolute left-0 top-full mt-1 w-40 bg-[#1e1e1e] border border-[#303030] rounded shadow-xl py-1 z-40">
                    {([
                      { id: "systems", label: "Systems" },
                      { id: "snapshots", label: "Snapshots" },
                      { id: "logs", label: "Logs" },
                    ] as const).map((entry) => (
                      <button
                        key={entry.id}
                        className="w-full text-left px-3 py-1.5 text-[#ccc] hover:bg-[#2d2d2d] hover:text-white transition-colors"
                        onClick={() => {
                          setWindowPanel(entry.id);
                          setWindowMenuOpen(false);
                        }}
                      >
                        {entry.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-2 py-1 hover:bg-[#2d2d2d] rounded cursor-pointer transition-colors">Help</div>
            </nav>
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center space-x-1 bg-[#111111] border border-[#303030] p-1 rounded-md">
            <button className={`p-1.5 hover:bg-[#2d2d2d] rounded transition-colors ${props.playbackState === "playing" ? "text-[#4ade80]" : "text-[#888] hover:text-[#4ade80]"}`} onClick={() => props.onPlaybackAction("play")} title="Play">
              <i className="ph-fill ph-play text-sm" />
            </button>
            <button className={`p-1.5 hover:bg-[#2d2d2d] rounded transition-colors ${props.playbackState === "paused" ? "text-white" : "text-[#888] hover:text-white"}`} onClick={() => props.onPlaybackAction("pause")} title="Pause">
              <i className="ph-fill ph-pause text-sm" />
            </button>
            <button className={`p-1.5 hover:bg-[#2d2d2d] rounded transition-colors ${props.playbackState === "stopped" ? "text-[#f87171]" : "text-[#888] hover:text-[#f87171]"}`} onClick={() => props.onPlaybackAction("stop")} title="Stop / Restart">
              <i className="ph-fill ph-stop text-sm" />
            </button>
            <div className="w-px h-4 bg-[#303030] mx-1" />
            <button className="p-1.5 hover:bg-[#2d2d2d] rounded text-[#888] hover:text-[#60a5fa] transition-colors" onClick={() => props.onPlaybackAction("step")} title="Step Frame">
              <i className="ph-fill ph-skip-forward text-sm" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button className="px-3 py-1.5 bg-[#0070e0] hover:bg-[#005bb5] text-white rounded transition-colors flex items-center gap-2 font-medium" title="Build (coming soon)">
              <i className="ph-bold ph-export" /> Build
            </button>
            <button className="p-1.5 hover:bg-[#2d2d2d] rounded text-[#888] transition-colors" title="Settings" onClick={() => setCameraTuningOpen((open) => !open)}>
              <i className="ph ph-gear text-lg" />
            </button>
          </div>
        </header>

        {/* TAB BAR: open worlds + open docs */}
        <div className="pointer-events-auto h-8 bg-[#181818] border-b border-[#303030] flex items-center px-1 flex-shrink-0 select-none z-20 overflow-x-auto">
          {props.worlds.map((world) => {
            const active = props.activeDoc === null && world.path === props.activeWorld;
            return (
              <button
                key={world.path}
                className={`px-4 py-1.5 text-[11px] font-medium flex items-center gap-2 flex-shrink-0 border-t-2 transition-colors ${active ? "bg-[#1e1e1e] text-white border-[#0070e0]" : "text-[#888] hover:bg-[#1e1e1e] hover:text-[#ccc] border-transparent"}`}
                onClick={() => props.onSelectWorld(world.path)}
              >
                <i className={`ph-fill ph-globe-hemisphere-west ${active ? "text-[#0070e0]" : "text-[#888]"}`} /> {world.name}
                {props.worlds.length > 1 && (
                  <span
                    className="ml-2 p-0.5 rounded-full hover:bg-[#333] hover:text-white"
                    role="button"
                    aria-label="Close world tab"
                    onClick={(event) => { event.stopPropagation(); props.onCloseWorld(world.path); }}
                  >
                    <i className="ph ph-x" />
                  </span>
                )}
              </button>
            );
          })}
          {props.openDocs.map((doc) => {
            const active = props.activeDoc === doc.path;
            const icon = doc.kind === "component" ? "ph-puzzle-piece" : "ph-file-code";
            return (
              <button
                key={doc.path}
                className={`px-4 py-1.5 text-[11px] font-medium flex items-center gap-2 flex-shrink-0 border-t-2 transition-colors ${active ? "bg-[#1e1e1e] text-white border-[#0070e0]" : "text-[#888] hover:bg-[#1e1e1e] hover:text-[#ccc] border-transparent"}`}
                onClick={() => props.onSelectDoc(doc.path)}
              >
                <i className={`ph-fill ${icon} ${active ? "text-[#0070e0]" : "text-[#888]"}`} /> {doc.name}
                <span
                  className="ml-2 p-0.5 rounded-full hover:bg-[#333] hover:text-white"
                  role="button"
                  aria-label="Close tab"
                  onClick={(event) => { event.stopPropagation(); props.onCloseDoc(doc.path); }}
                >
                  <i className="ph ph-x" />
                </span>
              </button>
            );
          })}
        </div>

        {/* MAIN WORKSPACE */}
        <div className="flex-1 flex overflow-hidden min-h-0 relative">
          {/* CENTER: viewport + content drawer */}
          <div className="flex-1 flex flex-col relative min-w-0">
            <main className="debugger-stage flex-1 relative overflow-hidden pointer-events-none" ref={setStagePortal}>
              {/* Top-left: Show dropdown, with FPS/MS HUD to its right */}
              <div className="absolute top-3 left-3 flex items-stretch gap-2 z-20">
                <div className="pointer-events-auto relative" data-dropdown-root onClick={(event) => event.stopPropagation()}>
                  <button
                    className="px-2 py-1 bg-black/60 hover:bg-black/80 backdrop-blur text-[#ccc] hover:text-white rounded flex items-center gap-1 transition-all border border-white/10"
                    onClick={props.onToggleDebugMenu}
                  >
                    Show <i className="ph ph-caret-down text-[10px]" />
                  </button>
                  {props.debugMenuOpen && (
                    <div className="absolute left-0 top-full mt-2 w-40 bg-[#1e1e1e] border border-[#303030] rounded shadow-lg flex flex-col text-left z-50 overflow-hidden font-normal text-xs">
                      <div className="px-3 py-2 text-[10px] uppercase text-[#888] font-bold tracking-wider">Engine</div>
                      {([
                        { label: "Grid", active: props.showGrid, toggle: props.onToggleGrid },
                        { label: "Collision", active: props.showPhysics, toggle: props.onTogglePhysics },
                        { label: "Bounds", active: props.showSprites, toggle: props.onToggleSprites },
                      ]).map((item) => (
                        <button
                          key={item.label}
                          className="px-3 py-1.5 hover:bg-[#2d2d2d] cursor-pointer text-[#ccc] flex items-center justify-between w-full"
                          onClick={item.toggle}
                        >
                          {item.label}
                          {item.active ? <i className="ph-bold ph-check text-[#0070e0]" /> : null}
                        </button>
                      ))}
                      <div className="h-px bg-[#303030] my-1" />
                      <div className="px-3 py-2 text-[10px] uppercase text-[#888] font-bold tracking-wider">Game</div>
                      <button
                        className="px-3 py-1.5 hover:bg-[#2d2d2d] cursor-pointer text-[#ccc] flex items-center justify-between w-full"
                        onClick={props.onToggleLabels}
                      >
                        Labels
                        {props.showLabels ? <i className="ph-bold ph-check text-[#0070e0]" /> : null}
                      </button>
                    </div>
                  )}
                </div>
                <div className="pointer-events-none flex items-center gap-3 px-3 py-1 rounded bg-black/70 border border-white/10 backdrop-blur font-mono text-[10px]">
                  <span><span className="text-[#71717a]">FPS </span><strong className="text-[#4ade80]">{props.fps}</strong></span>
                  <span><span className="text-[#71717a]">MS </span><strong className="text-[#facc15]">{props.frameMs}</strong></span>
                </div>
              </div>

              {/* Selection tool rail — below the Show row (like camera sits below the snap tools) */}
              <div className="pointer-events-auto absolute top-14 left-3 flex flex-col bg-black/60 backdrop-blur border border-white/10 rounded overflow-hidden shadow-lg z-10">
                {([
                  { mode: "select", icon: "ph-cursor", title: "Select" },
                  { mode: "move", icon: "ph-arrows-out-cardinal", title: "Move" },
                  { mode: "rotate", icon: "ph-arrows-clockwise", title: "Rotate" },
                  { mode: "scale", icon: "ph-corners-out", title: "Scale" },
                ] as const).map((tool, index, all) => (
                  <button
                    key={tool.mode}
                    className={`w-8 h-8 flex items-center justify-center transition-all ${index < all.length - 1 ? "border-b border-white/10" : ""} ${props.toolMode === tool.mode ? "text-[#0070e0] bg-[#2d2d2d] shadow-inner" : "text-[#888] hover:text-white hover:bg-black/80"}`}
                    onClick={() => props.onSetToolMode(tool.mode)}
                    title={tool.title}
                    aria-label={tool.title}
                  >
                    <i className={`ph ${tool.icon} text-lg`} />
                  </button>
                ))}
              </div>

              {/* Top-right snap tools */}
              <div className="pointer-events-auto absolute top-3 right-3 flex items-stretch bg-black/60 backdrop-blur border border-white/10 rounded z-30" data-snap-menu-root onClick={(event) => event.stopPropagation()}>
                <button
                  className={`p-1.5 border-r border-white/10 rounded-l transition-all ${props.snapGrid ? "text-[#0070e0] bg-[#2d2d2d]" : "text-[#888] hover:text-white hover:bg-black/80"}`}
                  onClick={props.onToggleGridSnap}
                  title={props.snapGrid ? "Grid snap: on" : "Grid snap: off"}
                >
                  <i className="ph-fill ph-grid-four text-sm" />
                </button>
                <div className="relative">
                  <button
                    className={`px-2 py-1.5 h-full border-r border-white/10 text-[10px] font-bold transition-all hover:text-white hover:bg-black/80 ${props.snapGrid ? "text-[#ccc]" : "text-[#666]"}`}
                    onClick={() => setSnapMenu((cur) => (cur === "grid" ? null : "grid"))}
                    title="Grid snap size"
                  >
                    {props.snapGridSize}px
                  </button>
                  {snapMenu === "grid" && (
                    <div className="absolute top-full mt-2 right-0 w-20 bg-[#1e1e1e] border border-[#303030] rounded shadow-lg flex flex-col text-left z-50 overflow-hidden font-normal text-xs">
                      {[8, 16, 32, 64].map((size) => (
                        <button
                          key={size}
                          className={`px-3 py-1.5 text-left transition-colors ${props.snapGridSize === size ? "bg-[#2d2d2d] text-[#0070e0]" : "text-[#ccc] hover:bg-[#2d2d2d]"}`}
                          onClick={() => { props.onSetGridSnapSize(size); setSnapMenu(null); }}
                        >
                          {size}px
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className={`p-1.5 border-r border-white/10 transition-all ${props.snapRotate ? "text-[#0070e0] bg-[#2d2d2d]" : "text-[#888] hover:text-white hover:bg-black/80"}`}
                  onClick={props.onToggleRotationSnap}
                  title={props.snapRotate ? "Rotation snap: on" : "Rotation snap: off"}
                >
                  <i className="ph ph-arrow-arc-right text-sm" />
                </button>
                <div className="relative">
                  <button
                    className={`px-2 py-1.5 h-full rounded-r text-[10px] font-bold transition-all hover:text-white hover:bg-black/80 ${props.snapRotate ? "text-[#ccc]" : "text-[#666]"}`}
                    onClick={() => setSnapMenu((cur) => (cur === "rot" ? null : "rot"))}
                    title="Rotation snap angle"
                  >
                    {props.snapRotateDeg}°
                  </button>
                  {snapMenu === "rot" && (
                    <div className="absolute top-full mt-2 right-0 w-20 bg-[#1e1e1e] border border-[#303030] rounded shadow-lg flex flex-col text-left z-50 overflow-hidden font-normal text-xs">
                      {[5, 10, 15, 45, 90].map((deg) => (
                        <button
                          key={deg}
                          className={`px-3 py-1.5 text-left transition-colors ${props.snapRotateDeg === deg ? "bg-[#2d2d2d] text-[#0070e0]" : "text-[#ccc] hover:bg-[#2d2d2d]"}`}
                          onClick={() => { props.onSetRotationSnapDeg(deg); setSnapMenu(null); }}
                        >
                          {deg}°
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Top-right camera controls (vertical, below snap) */}
              <div className="pointer-events-auto absolute top-14 right-3 z-10" data-camera-tuning-root onClick={(event) => event.stopPropagation()}>
                <div className="flex flex-col bg-black/60 backdrop-blur border border-white/10 rounded overflow-hidden shadow-lg">
                  <button className={`w-8 h-8 flex items-center justify-center border-b border-white/10 transition-all ${props.cameraLocked ? "text-[#0070e0] bg-[#2d2d2d]" : "text-[#888] hover:text-white hover:bg-black/80"}`} onClick={props.onToggleCameraLock} title="Lock Camera to Entity">
                    <i className="ph ph-crosshair-simple text-base" />
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center border-b border-white/10 text-[#888] hover:text-white hover:bg-black/80 transition-all" onClick={() => props.onZoomAction("camera-reset")} title="Reset Camera">
                    <i className="ph ph-arrow-counter-clockwise text-base" />
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center border-b border-white/10 text-[#888] hover:text-white hover:bg-black/80 transition-all" onClick={() => props.onZoomAction("zoom-fit")} title="Fit game in viewport">
                    <i className="ph ph-arrows-in text-base" />
                  </button>
                  <button
                    className={`w-8 h-8 flex items-center justify-center transition-all ${cameraTuningOpen ? "text-[#0070e0] bg-[#2d2d2d]" : "text-[#888] hover:text-white hover:bg-black/80"}`}
                    onClick={() => setCameraTuningOpen((open) => !open)}
                    title={`Camera Speed (${props.cameraZoomSensitivity.toFixed(1)})`}
                    aria-expanded={cameraTuningOpen}
                  >
                    <i className="ph-fill ph-video-camera text-base" />
                  </button>
                </div>
                {cameraTuningOpen && (
                  <div className="absolute right-full mr-2 top-0 w-48 bg-[#1e1e1e] border border-[#303030] rounded shadow-lg flex flex-col p-3 z-50 cursor-default">
                    <div className="text-[#888] mb-2 font-medium flex justify-between items-center">
                      Camera Speed
                      <span className="text-white font-mono">{props.cameraZoomSensitivity.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="8"
                      step="0.1"
                      value={props.cameraZoomSensitivity}
                      onChange={(event) => props.onSetZoomSensitivity(Number(event.target.value))}
                      className="w-full accent-[#0070e0] cursor-pointer"
                      aria-label="Camera speed"
                    />
                    <div className="flex justify-between text-[#555] mt-1 text-[9px] font-bold">
                      <span>1</span>
                      <span>8</span>
                    </div>
                  </div>
                )}
              </div>
            </main>

            {/* CONTENT DRAWER (assets only) */}
            <section
              id="content-drawer"
              className="pointer-events-auto absolute bottom-0 left-0 w-full bg-[#1e1e1e] flex flex-col z-30 border-t border-[#303030] shadow-[0_-4px_15px_rgba(0,0,0,0.5)] overflow-hidden"
              style={{ height: props.contentDrawerOpen ? 350 : 36 }}
            >
              <div className="h-[36px] min-h-[36px] flex items-center px-4 bg-[#181818] cursor-pointer hover:bg-[#222] transition-colors group select-none" onClick={props.onToggleContentDrawer}>
                <div className="flex items-center gap-2 text-[#ccc] group-hover:text-white transition-colors">
                  <i className={`ph text-lg ${props.contentDrawerOpen ? "ph-caret-down" : "ph-folder-open"}`} />
                  <span className="font-medium text-[13px]">Content Drawer</span>
                </div>
                <div className="ml-auto text-[#888] text-[10px]">Ctrl+Space</div>
              </div>
              {props.contentDrawerOpen && (
                <div className="flex-1 flex overflow-hidden">
                  <ContentBrowser
                    tree={props.contentTree}
                    activeWorld={props.activeWorld}
                    activeSystems={props.activeSystems}
                    onOpenWorld={props.onOpenWorld}
                    onCreateFolder={props.onCreateFolder}
                    onCreateWorld={props.onCreateWorld}
                    onCreateComponent={props.onCreateComponent}
                    onCreatePrefab={props.onCreatePrefab}
                    onCreateGraph={props.onCreateGraph}
                    onImportContent={props.onImportContent}
                    onDeleteContent={props.onDeleteContent}
                    onOpenDoc={props.onOpenDoc}
                    keyboardLocked={isPlaying}
                  />
                </div>
              )}
            </section>
          </div>

          {/* RIGHT PANEL: Outliner + Details */}
          <aside className="pointer-events-auto w-72 bg-[#1e1e1e] border-l border-[#303030] flex flex-col flex-shrink-0 z-10 shadow-xl">
            {/* Outliner */}
            <div className="flex-1 flex flex-col border-b border-[#303030] min-h-[30%]">
              <div className="h-8 bg-[#252526] flex items-center px-3 border-b border-[#303030] justify-between text-white font-medium select-none">
                Outliner
                <i className="ph ph-magnifying-glass text-[#888]" />
              </div>
              <div className="px-2 py-1.5 border-b border-[#303030]">
                <input
                  className="engine-input w-full px-2 py-1 rounded text-[11px]"
                  placeholder="search entity or tag"
                  value={props.entityQuery}
                  onChange={(event) => props.onEntityQueryChange(event.target.value)}
                />
              </div>
              <div className="flex-1 overflow-y-auto py-1 select-none">
                <button
                  className={`w-full flex items-center px-3 py-1 cursor-pointer text-left ${props.sceneSelected ? "bg-[#2d2d2d] border-l-2 border-[#0070e0] text-white" : "text-[#ccc] hover:bg-[#2d2d2d]"}`}
                  onClick={props.onSelectScene}
                >
                  <i className="ph ph-caret-down text-[10px] mr-1 text-[#888]" />
                  <i className={`ph-fill ph-globe-hemisphere-west mr-2 ${props.sceneSelected ? "text-[#0070e0]" : "text-[#888]"}`} />
                  <span className="truncate">{props.worldName}</span>
                </button>
                {props.entities.map((entity) => (
                  <button
                    key={entity.entity}
                    ref={entity.selected ? selectedEntityRef : null}
                    className={`w-full flex items-center pl-7 pr-3 py-1 cursor-pointer text-left ${entity.selected ? "bg-[#2d2d2d] border-l-2 border-[#0070e0] text-white" : "text-[#ccc] hover:bg-[#2d2d2d]"}`}
                    onClick={() => props.onSelectEntity(entity.entity)}
                  >
                    <i className="ph-fill ph-cube text-[#888] mr-2" />
                    <span className="truncate flex-1">{entity.title}</span>
                    <span className="text-[10px] text-[#666] ml-2">{entity.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="flex-1 flex flex-col min-h-[40%]">
              <div className="h-8 bg-[#252526] flex items-center px-3 border-b border-[#303030] text-white font-medium select-none justify-between">
                Details
                <i className="ph ph-funnel text-[#888]" />
              </div>
              {!props.sceneSelected && (
                <div className="px-2 py-1.5 border-b border-[#303030]">
                  <input
                    className="engine-input w-full px-2 py-1 rounded text-[11px]"
                    placeholder="filter fields…"
                    value={props.inspectorQuery}
                    onChange={(event) => props.onInspectorQueryChange(event.target.value)}
                  />
                </div>
              )}
              <div className="flex-1 overflow-y-auto">
                {props.sceneSelected ? (
                  <SceneSystemsPanel
                    worldName={props.worldName}
                    systems={props.systems}
                    frameMs={props.frameMs}
                    availableSystems={props.availableSystems}
                    onToggleSystem={props.onToggleSystem}
                    onAddSystem={props.onAddSystem}
                    onRemoveSystem={props.onRemoveSystem}
                  />
                ) : (
                  <>
                    {selectedEntity ? (
                      <div className="p-3 border-b border-[#303030] flex items-center gap-2">
                        <i className="ph-fill ph-cube text-[#0070e0] text-lg" />
                        <input type="text" value={selectedEntity.title} readOnly className="engine-input px-2 py-1 w-full rounded font-medium" />
                      </div>
                    ) : (
                      <div className="p-3 text-[#666]">Select the world or an entity</div>
                    )}
                    {selectedEntity && props.inspectorCards.map((card) => (
                      <div className="border-b border-[#303030]" key={card.id}>
                        <button
                          className="w-full px-3 py-2 bg-[#252526] flex items-center cursor-pointer select-none text-white hover:bg-[#2a2a2b] text-left"
                          onClick={() => props.onToggleComponentCollapse(card.id)}
                        >
                          <i className={`ph ${card.collapsed ? "ph-caret-right" : "ph-caret-down"} text-[10px] mr-2`} />
                          {card.title}
                        </button>
                        {card.collapsed ? null : (
                          <div className="p-3 space-y-2">
                            {card.fields.map((field, index) => (
                              <InspectorField
                                key={`${card.id}-${field.label}-${index}`}
                                field={field}
                                onEdit={props.onInspectorEdit}
                                onSelectEntity={props.onSelectEntity}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {selectedEntity && (
                      <div className="p-3">
                        <button className="w-full py-1.5 bg-[#2d2d2d] hover:bg-[#3a3a3a] border border-[#303030] rounded text-white transition-colors flex justify-center items-center gap-2 cursor-default" title="Add Component (coming soon)">
                          <i className="ph ph-plus" /> Add Component
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </aside>

          {/* DOC VIEW — overlays the whole workspace (blueprint or component editor) */}
          {activeDocEntry && (
            activeDocEntry.kind === "component" ? (
              <ComponentView key={activeDocEntry.path} path={activeDocEntry.path} keyboardLocked={isPlaying} />
            ) : (
              <BlueprintView key={activeDocEntry.path} path={activeDocEntry.path} keyboardLocked={isPlaying} />
            )
          )}
        </div>
      </div>

      {/* Window overlay panels (Systems / Snapshots / Logs) */}
      {windowPanel && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setWindowPanel(null)}>
          <div className="w-[560px] max-w-[90vw] max-h-[80vh] flex flex-col bg-[#1e1e1e] border border-[#303030] rounded-lg shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
            <div className="h-9 bg-[#252526] flex items-center justify-between px-3 border-b border-[#303030] text-white font-medium select-none">
              <span className="capitalize">{windowPanel}</span>
              <button className="text-[#888] hover:text-white transition-colors" onClick={() => setWindowPanel(null)} aria-label="Close">
                <i className="ph ph-x" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {windowPanel === "systems" ? (
                <SystemsDrawer statusCards={props.statusCards} systems={props.systems} onToggleSystem={props.onToggleSystem} />
              ) : windowPanel === "snapshots" ? (
                <SnapshotsDrawer snapshots={props.snapshots} onSaveSnapshot={props.onSaveSnapshot} onRestoreSnapshot={props.onRestoreSnapshot} />
              ) : (
                <EventLogDrawer logs={props.logs} logFilters={props.logFilters} logPaused={props.logPaused} onToggleLogFilter={props.onToggleLogFilter} onToggleLogPause={props.onToggleLogPause} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SceneSystemsPanel(props: {
  worldName: string;
  systems: DebuggerSystemView[];
  frameMs: string;
  availableSystems: string[];
  onToggleSystem: (index: number) => void;
  onAddSystem: (name: string) => void;
  onRemoveSystem: (name: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const totalCur = props.systems.reduce((sum, s) => sum + (s.cur ?? 0), 0);
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-[#303030]">
        <i className="ph-fill ph-globe-hemisphere-west text-[#0070e0] text-lg" />
        <div className="font-medium text-white truncate">{props.worldName}</div>
      </div>

      <div className="space-y-1">
        <span className="text-[#888] text-[10px] uppercase font-bold tracking-wide">Systems ({props.systems.length})</span>
        <div className="space-y-1">
          {props.systems.length === 0 ? (
            <div className="text-[#666]">no systems — add one below</div>
          ) : props.systems.map((system) => (
            <div key={system.index} className={`flex items-center gap-2 px-2 py-1 rounded border border-[#303030] bg-[#111111] ${system.enabled ? "" : "opacity-50"}`}>
              <button className={`transition-colors ${system.enabled ? "text-[#4ade80]" : "text-[#666] hover:text-[#888]"}`} onClick={() => props.onToggleSystem(system.index)} title={system.enabled ? "Disable" : "Enable"}>
                <i className="ph-fill ph-circle text-[10px]" />
              </button>
              <span className="flex-1 text-[#ccc] truncate">{system.label}</span>
              <span className="text-[#888] font-mono text-[10px] shrink-0">
                {system.cur === null ? "—" : `${system.cur.toFixed(2)}/${system.avg?.toFixed(2) ?? "—"}/${system.peak?.toFixed(2) ?? "—"}`}
              </span>
              <button className="text-[#666] hover:text-[#f87171] shrink-0" title="Remove system" onClick={() => props.onRemoveSystem(system.label)}>
                <i className="ph ph-x" />
              </button>
            </div>
          ))}
        </div>
        <div className="text-[9px] text-[#666] text-right pr-1">cur / avg / peak (ms)</div>
      </div>

      <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#252526] border border-[#303030] text-[11px]">
        <span className="text-[#888] font-bold uppercase tracking-wide">Total</span>
        <span className="text-white font-mono">{totalCur.toFixed(2)} ms <span className="text-[#666]">· frame {props.frameMs} ms</span></span>
      </div>

      <div className="relative" data-add-system-root onClick={(event) => event.stopPropagation()}>
        <button
          className="w-full py-1.5 bg-[#2d2d2d] hover:bg-[#3a3a3a] border border-[#303030] rounded text-white transition-colors flex justify-center items-center gap-2 disabled:opacity-40"
          disabled={props.availableSystems.length === 0}
          onClick={() => setAddOpen((open) => !open)}
          title={props.availableSystems.length === 0 ? "No systems available to add" : "Add System"}
        >
          <i className="ph ph-plus" /> Add System
        </button>
        {addOpen && props.availableSystems.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 right-0 max-h-48 overflow-y-auto bg-[#1e1e1e] border border-[#303030] rounded shadow-lg flex flex-col py-1 z-50">
            {props.availableSystems.map((name) => (
              <button
                key={name}
                className="text-left px-3 py-1.5 text-[#ccc] hover:bg-[#2d2d2d] hover:text-white flex items-center gap-2"
                onClick={() => { props.onAddSystem(name); setAddOpen(false); }}
              >
                <i className="ph-fill ph-file-code text-[#0070e0]" /> {name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SystemsDrawer(props: {
  statusCards: DebuggerStatusCardView[];
  systems: DebuggerSystemView[];
  onToggleSystem: (index: number) => void;
}) {
  return (
    <div className="space-y-3">
      {props.statusCards.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {props.statusCards.map((card) => <RuntimeCard key={card.title} title={card.title} fields={card.fields} />)}
        </div>
      )}
      <div>
        <div className="text-white font-medium mb-2">Systems</div>
        <div className="space-y-1">
          {props.systems.length === 0 ? (
            <div className="text-[#888] px-2 py-1">waiting for frame</div>
          ) : props.systems.map((system) => (
            <div className={`flex items-center gap-2 px-2 py-1 rounded border border-[#303030] bg-[#111111] ${system.enabled ? "" : "opacity-50"}`} key={system.index}>
              <button className={`transition-colors ${system.enabled ? "text-[#4ade80]" : "text-[#666] hover:text-[#888]"}`} onClick={() => props.onToggleSystem(system.index)} title={system.enabled ? "Disable system" : "Enable system"}>
                <i className={`ph-fill ${system.enabled ? "ph-circle" : "ph-circle"} text-xs`} />
              </button>
              <span className="flex-1 text-[#ccc] truncate">{system.label}</span>
              <strong className="text-[#888] font-mono text-[11px]">{system.timing}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SnapshotsDrawer(props: {
  snapshots: DebuggerSnapshotView[];
  onSaveSnapshot: () => void;
  onRestoreSnapshot: (index: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-white font-medium">Snapshots</div>
        <button className="px-3 py-1 bg-[#2d2d2d] hover:bg-[#3a3a3a] border border-[#303030] rounded text-white transition-colors" onClick={props.onSaveSnapshot}>Save</button>
      </div>
      <div className="space-y-1">
        {props.snapshots.length === 0 ? <span className="text-[#666] text-[11px]">none saved</span> : props.snapshots.map((snap) => (
          <div className="flex items-center gap-2 px-2 py-1 bg-[#111111] border border-[#303030] rounded" key={snap.index}>
            <span className="text-[#ccc]">frame {snap.frame}</span>
            <span className="flex-1 text-[#888]">{snap.entityCount} entities</span>
            <button className="text-[#0070e0] hover:underline" onClick={() => props.onRestoreSnapshot(snap.index)}>Restore</button>
          </div>
        ))}
      </div>
    </div>
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
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="text-white font-medium mr-auto">Event Log</div>
        {props.logFilters.map((filter) => (
          <button
            key={filter.cat}
            className={`px-2 py-0.5 rounded text-[10px] border border-[#303030] transition-colors ${filter.active ? "bg-[#0070e0] text-white" : "text-[#888] hover:text-white"}`}
            onClick={() => props.onToggleLogFilter(filter.cat)}
          >
            {filter.cat}
          </button>
        ))}
        <button className={`px-2 py-0.5 rounded text-[10px] border border-[#303030] transition-colors ${props.logPaused ? "bg-[#f87171] text-white" : "text-[#888] hover:text-white"}`} onClick={props.onToggleLogPause}>
          {props.logPaused ? "resume" : "pause"}
        </button>
      </div>
      <div className="font-mono text-[11px] space-y-0.5 max-h-[52vh] overflow-y-auto">
        {props.logs.length === 0
          ? <span className="text-[#666]">{props.logPaused ? "paused" : "no events"}</span>
          : props.logs.map((entry, index) => (
            <div className="text-[#ccc] flex gap-2" key={`${entry.cat}-${index}-${entry.text}`}>
              <span className="text-[#666] shrink-0">[{entry.cat}]</span>
              <span className="flex-1">{entry.text}</span>
              {entry.count > 1 ? <span className="text-[#666]">×{entry.count}</span> : null}
            </div>
          ))}
      </div>
    </div>
  );
}

function ContentBrowser(props: {
  tree: ContentTreeNode[];
  activeWorld?: string;
  activeSystems?: string[];
  onOpenWorld: (name: string) => void;
  onCreateFolder?: (path: string) => void;
  onCreateWorld: (path: string) => void;
  onCreateComponent?: (path: string) => void;
  onCreatePrefab?: (path: string) => void;
  onCreateGraph?: (path: string) => void;
  onImportContent?: (path: string, value: unknown) => void;
  onDeleteContent?: (path: string, kind: ContentTreeNode["kind"]) => void;
  onOpenDoc: (path: string, kind: "graph" | "component") => void;
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
  const touchTapRef = useRef<{ path: string; time: number } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Default the browser to the Content root rather than the active world's folder.
    setSelectedFolderPath("");
    setSelectedItemPath(undefined);
    setExpandedFolders((prev) => new Set(prev).add(""));
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
      props.onOpenWorld(node.path);
      return;
    }
    if (node.kind === "graph" || node.kind === "component") {
      setPreviewPath(undefined);
      props.onOpenDoc(node.path, node.kind);
      return;
    }
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
    <div className="flex-1 flex overflow-hidden min-h-0">
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={handleImportChange}
      />
      {/* Left: Folder Tree */}
      <div className="w-48 border-r border-[#303030] bg-[#1a1a1a] p-2 overflow-y-auto flex-shrink-0">
        <button
          className={`w-full flex items-center pr-2 py-1 rounded cursor-pointer text-left transition-colors ${selectedFolderPath === "" ? "bg-[#2d2d2d] text-white" : "text-[#ccc] hover:bg-[#2d2d2d]"}`}
          style={{ paddingLeft: "8px" }}
          onClick={() => setSelectedFolderPath("")}
        >
          <span className="w-3 flex justify-center text-[#888]"><i className="ph ph-caret-down text-[10px]" /></span>
          <span className="mr-2 text-[#0070e0]"><i className="ph-fill ph-folder-open" /></span>
          <span className="truncate">Content</span>
        </button>
        <div style={{ paddingLeft: "8px" }}>
          {renderFolderTree(props.tree, selectedFolderPath, expandedFolders, setExpandedFolders, setSelectedFolderPath, props.onOpenWorld)}
        </div>
      </div>
      {/* Right: Asset area */}
      <div className="flex-1 bg-[#1e1e1e] flex flex-col min-w-0">
        <div className="h-8 border-b border-[#303030] flex items-center px-3 gap-2 text-[#888] flex-shrink-0">
          <i className="ph ph-house cursor-pointer hover:text-white" onClick={() => setSelectedFolderPath("")} />
          {currentBreadcrumbs.map((crumb, index) => (
            <span key={crumb.path || "root"} className="flex items-center gap-2">
              <i className="ph ph-caret-right text-[10px]" />
              <button
                className={index === currentBreadcrumbs.length - 1 ? "text-[#ccc] font-medium" : "hover:text-white hover:underline"}
                onClick={() => setSelectedFolderPath(crumb.path)}
              >
                {crumb.label}
              </button>
            </span>
          ))}
          <div className="ml-auto flex gap-2 items-center">
            <div className="bg-[#111111] border border-[#303030] rounded flex items-center px-2 py-1">
              <i className="ph ph-magnifying-glass mr-2 text-[#888]" />
              <input
                type="text"
                placeholder="Search Assets"
                className="bg-transparent border-none outline-none text-white w-32 placeholder-[#555]"
                value={search}
                disabled={props.keyboardLocked}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <button
              className="px-3 py-1 bg-[#2d2d2d] hover:bg-[#3a3a3a] border border-[#303030] rounded text-white flex items-center gap-1 transition-colors disabled:opacity-40"
              onClick={openCreateMenu}
              onContextMenu={openCreateMenu}
              disabled={props.keyboardLocked}
              title="Create"
            >
              <i className="ph ph-plus" /> Add
            </button>
          </div>
        </div>
        <div
          className="flex-1 p-4 grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-4 overflow-y-auto content-start"
          onContextMenu={(event) => openContextMenu(event)}
        >
          {filteredChildren.length === 0 ? (
            <div className="col-span-full text-[#666] py-6 text-center">{search.trim() ? "no matches" : "empty folder"}</div>
          ) : filteredChildren.map((node) => {
            const isSelected = selectedItemPath === node.path || (node.kind === "world" && node.path === props.activeWorld);
            const isActiveWorld = node.kind === "world" && node.path === props.activeWorld;
            const barColor = contentTypeBarColor(node.kind);
            return (
              <button
                key={node.path}
                className="flex flex-col items-center group cursor-pointer w-20 disabled:opacity-40"
                disabled={props.keyboardLocked}
                onClick={() => selectNode(node)}
                onDoubleClick={() => activateNode(node)}
                onPointerUp={(event) => handlePointerUp(node, event)}
                onContextMenu={(event) => openContextMenu(event, node)}
                title={node.path || "root"}
              >
                <div className={`w-16 h-16 rounded flex items-center justify-center mb-1 relative overflow-hidden shadow-md transition-colors border ${isSelected ? "border-[#0070e0] bg-[#333]" : "bg-[#2a2a2a] border-[#444] group-hover:border-[#0070e0] group-hover:bg-[#333]"}`}>
                  <span className={`text-3xl ${isSelected ? "text-[#0070e0]" : "text-[#aaa]"}`}>{renderContentIcon(node.kind)}</span>
                  <div className={`absolute bottom-0 w-full h-1 ${barColor}`} />
                </div>
                <span className={`text-center truncate w-full text-[11px] px-1 rounded ${isActiveWorld ? "bg-[#0070e0] text-white" : isSelected ? "text-white" : "text-[#ccc] group-hover:text-white"}`}>
                  {node.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {contextMenu && createPortal(
        <div
          className="fixed z-[60] w-52 bg-[#1e1e1e] border border-[#303030] rounded shadow-2xl py-1 text-xs"
          data-content-context-menu
          style={{
            left: `${Math.max(8, Math.min(contextMenu.x, window.innerWidth - 232))}px`,
            top: `${Math.max(8, Math.min(contextMenu.y, window.innerHeight - 260))}px`,
          }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button className={CONTENT_MENU_ITEM} onClick={() => triggerImport(contextFolderPath)} disabled={!props.onImportContent || props.keyboardLocked}>
            Import
          </button>
          {contextMenu.item && (
            <button className={CONTENT_MENU_ITEM} onClick={() => activateNode(contextMenu.item!)}>
              {contextMenu.item.kind === "folder" ? "Enter folder" : contextMenu.item.kind === "world" ? "Load world" : contextMenu.item.kind === "graph" ? "Open system" : "Open file"}
            </button>
          )}
          <div className="h-px my-1 bg-[#303030]" />
          <button className={CONTENT_MENU_ITEM} onClick={() => beginCreate("folder", contextFolderPath)} disabled={!props.onCreateFolder || props.keyboardLocked}>
            New Folder
          </button>
          <button className={CONTENT_MENU_ITEM} onClick={() => beginCreate("world", contextFolderPath)} disabled={props.keyboardLocked}>
            New World
          </button>
          <button className={CONTENT_MENU_ITEM} onClick={() => beginCreate("component", contextFolderPath)} disabled={!props.onCreateComponent || props.keyboardLocked}>
            New Component
          </button>
          <button className={CONTENT_MENU_ITEM} onClick={() => beginCreate("prefab", contextFolderPath)} disabled={!props.onCreatePrefab || props.keyboardLocked}>
            New Prefab
          </button>
          <button className={CONTENT_MENU_ITEM} onClick={() => beginCreate("graph", contextFolderPath)} disabled={!props.onCreateGraph || props.keyboardLocked}>
            New System
          </button>
          <div className="h-px my-1 bg-[#303030]" />
          <button
            className={CONTENT_MENU_ITEM}
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
    </div>
  );
}

function RuntimeCard(props: { title: string; fields: Array<{ label: string; value: string }> }) {
  return (
    <div className="bg-[#111111] border border-[#303030] rounded p-2 space-y-1">
      <div className="text-white font-medium mb-1">{props.title}</div>
      {props.fields.map((field, index) => (
        <div className="flex items-center justify-between gap-2" key={`${field.label}-${index}`}>
          <span className="text-[#888]">{field.label}</span>
          <strong className="text-[#ccc] font-mono text-[11px] truncate">{field.value}</strong>
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
    .filter((node) => node.kind === "folder")
    .map((node) => {
      const isFolder = node.kind === "folder";
      const isExpanded = expandedFolders.has(node.path);
      const isSelected = isFolder && node.path === selectedFolderPath;
      const hasChildren = isFolder && (node.children?.length ?? 0) > 0;

      return (
        <div key={node.path}>
          <button
            className={`w-full flex items-center pr-2 py-1 rounded cursor-pointer text-left transition-colors ${isSelected ? "bg-[#2d2d2d] text-white" : "text-[#ccc] hover:bg-[#2d2d2d]"}`}
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
            <span className="w-3 flex justify-center text-[#888]">
              {isFolder && hasChildren ? <i className={`ph ph-caret-${isExpanded ? "down" : "right"} text-[10px]`} /> : null}
            </span>
            <span className={`mr-2 ${isFolder ? "text-[#888]" : "text-[#0070e0]"}`}>
              {isFolder ? <i className={`ph-fill ph-${isExpanded ? "folder-open" : "folder"}`} /> : <i className="ph-fill ph-globe-hemisphere-west" />}
            </span>
            <span className="truncate">{node.name}</span>
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
      <label className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-[#888]">{field.label}</span>
        <input
          className="engine-input flex-1 px-2 py-1 rounded text-right"
          value={field.value}
          onChange={(event) => props.onEdit(field.entity!, field.componentId!, field.editKey!, event.target.value)}
        />
      </label>
    );
  }

  if (field.selectEntities && field.selectEntities.length > 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-[#888]">{field.label}</span>
        <div className="flex flex-wrap gap-1">
          {field.selectEntities.map((entity) => (
            <button className="text-[#0070e0] hover:underline" key={entity} onClick={() => props.onSelectEntity(entity)}>#{entity}</button>
          ))}
        </div>
      </div>
    );
  }

  if (field.selectEntity !== undefined) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-[#888]">{field.label}</span>
        <button className="text-[#0070e0] hover:underline" onClick={() => props.onSelectEntity(field.selectEntity!)}>#{field.selectEntity}</button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[#888]">{field.label}</span>
      <strong className="text-[#ccc] font-mono text-[11px] truncate">{field.value}</strong>
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

async function saveContentJson(path: string, value: unknown): Promise<void> {
  await fetch(`/api/content/file?path=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value, null, 2),
  });
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

type ComponentFieldType = "Float" | "Int" | "Bool" | "String" | "Vector2";
const COMPONENT_FIELD_TYPES: ComponentFieldType[] = ["Float", "Int", "Bool", "String", "Vector2"];
type ComponentField = { name: string; type: ComponentFieldType; value: unknown };

function inferComponentFieldType(value: unknown): ComponentFieldType {
  if (typeof value === "boolean") return "Bool";
  if (typeof value === "number") return Number.isInteger(value) ? "Int" : "Float";
  if (typeof value === "string") return "String";
  if (value && typeof value === "object" && "x" in value && "y" in value) return "Vector2";
  return "String";
}

function defaultForComponentType(type: ComponentFieldType): unknown {
  if (type === "Bool") return false;
  if (type === "String") return "";
  if (type === "Vector2") return { x: 0, y: 0 };
  return 0;
}

function componentFieldDotColor(type: ComponentFieldType): string {
  if (type === "Bool") return "bg-[#f87171] shadow-[0_0_5px_#f87171]";
  if (type === "String") return "bg-[#60a5fa] shadow-[0_0_5px_#60a5fa]";
  if (type === "Vector2") return "bg-[#eab308] shadow-[0_0_5px_#eab308]";
  return "bg-[#4ade80] shadow-[0_0_5px_#4ade80]";
}


type ComponentEditKind = "struct" | "scalar" | "enum";
type ComponentEditState = {
  id: string;
  label: string;
  kind: ComponentEditKind;
  fields: ComponentField[];
  scalarType: ComponentFieldType;
  scalarValue: unknown;
  values: string[];
  enumDefault: string;
};

function buildComponentDefinition(st: ComponentEditState): Record<string, unknown> {
  const base = { version: 1, id: st.id, label: st.label };
  if (st.kind === "enum") {
    const values = st.values.map((v) => v.trim()).filter((v) => v !== "");
    const defaultValue = values.includes(st.enumDefault) ? st.enumDefault : values[0] ?? "";
    return { ...base, kind: "enum", values, defaultValue };
  }
  if (st.kind === "scalar") {
    return { ...base, defaultValue: st.scalarValue };
  }
  return {
    ...base,
    defaultValue: Object.fromEntries(st.fields.filter((f) => f.name.trim() !== "").map((f) => [f.name, f.value])),
  };
}

function ComponentView(props: { path: string; keyboardLocked: boolean }) {
  const [st, setSt] = useState<ComponentEditState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(undefined);
    fetchContentFile(props.path)
      .then((raw) => {
        if (!alive) return;
        if (!raw || typeof raw !== "object") { setError("component not found"); return; }
        const parsed = raw as { id?: string; label?: string; kind?: string; values?: unknown; defaultValue?: unknown };
        const id = typeof parsed.id === "string" ? parsed.id : (props.path.split("/").filter(Boolean).at(-1) ?? "component");
        const label = typeof parsed.label === "string" ? parsed.label : id;
        const dv = parsed.defaultValue;
        let next: ComponentEditState;
        if (parsed.kind === "enum" || Array.isArray(parsed.values)) {
          const values = (Array.isArray(parsed.values) ? parsed.values : []).filter((v): v is string => typeof v === "string");
          const enumDefault = typeof dv === "string" && values.includes(dv) ? dv : values[0] ?? "";
          next = { id, label, kind: "enum", fields: [], scalarType: "String", scalarValue: enumDefault, values, enumDefault };
        } else if (dv && typeof dv === "object") {
          next = { id, label, kind: "struct", fields: Object.entries(dv as Record<string, unknown>).map(([name, value]) => ({ name, type: inferComponentFieldType(value), value })), scalarType: "Float", scalarValue: 0, values: [], enumDefault: "" };
        } else {
          const scalarType = dv === undefined ? "Float" : inferComponentFieldType(dv);
          next = { id, label, kind: "scalar", fields: [], scalarType: scalarType === "Vector2" ? "String" : scalarType, scalarValue: dv ?? 0, values: [], enumDefault: "" };
        }
        setSt(next);
      })
      .catch(() => { if (alive) setError("failed to load component"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [props.path]);

  const commit = (patch: Partial<ComponentEditState>) => {
    setSt((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      void saveContentJson(props.path, buildComponentDefinition(next));
      return next;
    });
  };

  const changeKind = (kind: ComponentEditKind) => {
    if (!st) return;
    if (kind === "enum" && st.values.length === 0) {
      const seed = typeof st.scalarValue === "string" && st.scalarValue.trim() !== "" ? [st.scalarValue] : ["value"];
      commit({ kind, values: seed, enumDefault: seed[0] });
    } else if (kind === "scalar" && st.scalarValue === undefined) {
      commit({ kind, scalarType: "Float", scalarValue: 0 });
    } else {
      commit({ kind });
    }
  };

  const valueInput = (type: ComponentFieldType, value: unknown, onChange: (next: unknown) => void, compact = false) => {
    const cls = compact ? "engine-input px-1 py-0.5 rounded text-[10px] text-center" : "engine-input px-2 py-1.5 rounded text-white text-xs";
    if (type === "Bool") return <input type="checkbox" className="accent-[#0070e0]" checked={value === true} disabled={props.keyboardLocked} onChange={(e) => onChange(e.target.checked)} />;
    if (type === "String") return <input type="text" className={`${cls} ${compact ? "w-20" : "w-full"}`} value={String(value ?? "")} disabled={props.keyboardLocked} onChange={(e) => onChange(e.target.value)} />;
    if (type === "Vector2") {
      const v = (value && typeof value === "object" ? value : {}) as { x?: number; y?: number };
      return (
        <div className="flex gap-1">
          <input type="number" className="w-12 engine-input px-1 py-0.5 rounded text-[10px] text-center" value={Number(v.x ?? 0)} disabled={props.keyboardLocked} onChange={(e) => onChange({ x: Number(e.target.value), y: Number(v.y ?? 0) })} />
          <input type="number" className="w-12 engine-input px-1 py-0.5 rounded text-[10px] text-center" value={Number(v.y ?? 0)} disabled={props.keyboardLocked} onChange={(e) => onChange({ x: Number(v.x ?? 0), y: Number(e.target.value) })} />
        </div>
      );
    }
    return <input type="number" className={`${cls} ${compact ? "w-20" : "w-full"}`} value={Number(value ?? 0)} disabled={props.keyboardLocked} onChange={(e) => onChange(type === "Int" ? Math.round(Number(e.target.value)) : Number(e.target.value))} />;
  };

  const definition = st ? buildComponentDefinition(st) : {};
  const json = JSON.stringify(definition, null, 2);
  const copyJson = () => { void navigator.clipboard?.writeText(json); setCopied(true); window.setTimeout(() => setCopied(false), 1200); };

  const previewValue = (field: ComponentField) => {
    if (field.type === "Vector2") {
      const v = (field.value && typeof field.value === "object" ? field.value : {}) as { x?: number; y?: number };
      return `(${v.x ?? 0}, ${v.y ?? 0})`;
    }
    return String(field.value);
  };

  return (
    <div className="absolute inset-0 z-40 flex pointer-events-auto text-xs">
      {/* Center: preview card + live JSON */}
      <div className="flex-1 flex bg-[#141414] p-6 gap-6 overflow-auto min-w-0">
        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          {loading ? <div className="text-[#666]">loading component…</div> : error ? <div className="text-[#666]">{error}</div> : st && (
            <div className="w-72 bg-[#1e1e1e] border border-black rounded-md shadow-2xl flex flex-col font-sans text-[11px]">
              <div className="h-8 bg-gradient-to-r from-purple-800 to-purple-700 rounded-t-md flex items-center justify-between px-3 text-white font-bold tracking-wide border-b border-black">
                <div className="flex items-center gap-1.5 min-w-0"><i className="ph-fill ph-puzzle-piece text-lg opacity-80" /><span className="truncate">{st.label || st.id}</span></div>
                <span className="text-[9px] bg-black/30 px-1.5 py-0.5 rounded shrink-0">v1</span>
              </div>
              <div className="p-3 py-4 space-y-2">
                {st.kind === "enum" ? (
                  <>
                    <div className="text-[#888] font-bold uppercase text-[9px] tracking-wider mb-1">Enum Values</div>
                    {st.values.length === 0 ? <div className="text-[#666]">no values</div> : st.values.map((v, i) => (
                      <div key={i} className="flex justify-between items-center bg-[#111] p-1.5 rounded border border-[#303030]">
                        <div className="flex items-center gap-2 min-w-0"><div className="w-3 h-3 rounded-full shrink-0 bg-purple-400 shadow-[0_0_5px_#a78bfa]" /><span className="text-white truncate">{v}</span></div>
                        {v === st.enumDefault && <span className="text-[#888] text-[10px] bg-[#222] px-1.5 rounded shrink-0">default</span>}
                      </div>
                    ))}
                  </>
                ) : st.kind === "scalar" ? (
                  <>
                    <div className="text-[#888] font-bold uppercase text-[9px] tracking-wider mb-1">Value</div>
                    <div className="flex justify-between items-center bg-[#111] p-1.5 rounded border border-[#303030]">
                      <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full shrink-0 ${componentFieldDotColor(st.scalarType)}`} /><span className="text-white">value</span></div>
                      <span className="text-[#888] text-[10px] bg-[#222] px-1.5 rounded shrink-0">{String(st.scalarValue)} ({st.scalarType})</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[#888] font-bold uppercase text-[9px] tracking-wider mb-1">Default Values Struct</div>
                    {st.fields.length === 0 ? <div className="text-[#666]">no fields</div> : st.fields.map((field, i) => (
                      <div key={i} className="flex justify-between items-center bg-[#111] p-1.5 rounded border border-[#303030]">
                        <div className="flex items-center gap-2 min-w-0"><div className={`w-3 h-3 rounded-full shrink-0 ${componentFieldDotColor(field.type)}`} /><span className="text-white truncate">{field.name}</span></div>
                        <span className="text-[#888] text-[10px] bg-[#222] px-1.5 rounded shrink-0">{previewValue(field)} ({field.type})</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="w-80 bg-[#1a1a1a] border border-[#303030] rounded flex flex-col shadow-xl flex-shrink-0">
          <div className="h-8 bg-[#252526] flex items-center justify-between px-3 border-b border-[#303030] text-white font-medium">
            Live JSON Output
            <i className={`ph ${copied ? "ph-check text-[#4ade80]" : "ph-copy text-[#888] hover:text-white"} cursor-pointer`} title="Copy JSON" onClick={copyJson} />
          </div>
          <pre className="flex-1 p-4 text-[#a3e635] text-[11px] overflow-auto font-mono bg-[#0f0f0f] leading-relaxed whitespace-pre">{json}</pre>
        </div>
      </div>

      {/* Right: metadata + shape editor */}
      <aside className="w-72 bg-[#1e1e1e] border-l border-[#303030] flex flex-col flex-shrink-0 shadow-xl">
        <div className="flex-1 flex flex-col border-b border-[#303030] min-h-[35%]">
          <div className="h-8 bg-[#252526] flex items-center px-3 border-b border-[#303030] text-white font-medium select-none">Component Metadata</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="space-y-1">
              <span className="text-[#888] text-[10px] uppercase font-bold tracking-wide">Label</span>
              <input type="text" className="w-full engine-input px-2 py-1.5 rounded text-white text-xs" value={st?.label ?? ""} disabled={props.keyboardLocked || !st} onChange={(e) => commit({ label: e.target.value })} />
            </div>
            <div className="space-y-1">
              <span className="text-[#888] text-[10px] uppercase font-bold tracking-wide">ID (Internal)</span>
              <input type="text" className="w-full engine-input px-2 py-1.5 rounded text-[#aaa] text-xs font-mono opacity-70 cursor-not-allowed" value={st?.id ?? ""} readOnly title="Auto-generated on creation" />
            </div>
            <div className="space-y-1">
              <span className="text-[#888] text-[10px] uppercase font-bold tracking-wide">Kind</span>
              <select className="w-full engine-input px-2 py-1.5 rounded text-white text-xs" value={st?.kind ?? "struct"} disabled={props.keyboardLocked || !st} onChange={(e) => changeKind(e.target.value as ComponentEditKind)}>
                <option value="struct">Struct</option>
                <option value="scalar">Scalar</option>
                <option value="enum">Enum</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-[45%]">
          {st?.kind === "enum" ? (
            <>
              <div className="h-8 bg-[#252526] flex items-center px-3 border-b border-[#303030] text-white font-medium select-none justify-between">
                Enum Values
                <i className="ph ph-plus text-[#888] hover:text-white cursor-pointer" title="Add value" onClick={() => commit({ values: [...st.values, `value${st.values.length + 1}`] })} />
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {st.values.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[#252526] rounded border border-[#303030] p-2">
                    <input type="radio" className="accent-[#0070e0]" title="Default" checked={st.enumDefault === v} disabled={props.keyboardLocked} onChange={() => commit({ enumDefault: v })} />
                    <input type="text" className="flex-1 min-w-0 bg-black border border-[#444] text-white px-1 py-0.5 text-xs rounded focus:border-[#0070e0] outline-none" value={v} disabled={props.keyboardLocked}
                      onChange={(e) => { const values = st.values.map((x, xi) => xi === i ? e.target.value : x); commit({ values, enumDefault: st.enumDefault === v ? e.target.value : st.enumDefault }); }} />
                    <i className="ph ph-trash text-[#f87171] hover:text-red-400 cursor-pointer" title="Remove" onClick={() => { if (!props.keyboardLocked) commit({ values: st.values.filter((_, xi) => xi !== i) }); }} />
                  </div>
                ))}
                {st.values.length === 0 && <div className="text-[#666] p-2">no values</div>}
              </div>
            </>
          ) : st?.kind === "scalar" ? (
            <>
              <div className="h-8 bg-[#252526] flex items-center px-3 border-b border-[#303030] text-white font-medium select-none">Value</div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <div className="space-y-1">
                  <span className="text-[#888] text-[10px] uppercase font-bold tracking-wide">Type</span>
                  <select className="w-full engine-input px-2 py-1.5 rounded text-white text-xs" value={st.scalarType} disabled={props.keyboardLocked}
                    onChange={(e) => { const type = e.target.value as ComponentFieldType; commit({ scalarType: type, scalarValue: defaultForComponentType(type) }); }}>
                    {COMPONENT_FIELD_TYPES.filter((t) => t !== "Vector2").map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[#888] text-[10px] uppercase font-bold tracking-wide">Default</span>
                  {valueInput(st.scalarType, st.scalarValue, (next) => commit({ scalarValue: next }))}
                </div>
              </div>
            </>
          ) : st ? (
            <>
              <div className="h-8 bg-[#252526] flex items-center px-3 border-b border-[#303030] text-white font-medium select-none justify-between">
                Schema / Fields
                <i className="ph ph-plus text-[#888] hover:text-white cursor-pointer" title="Add Field" onClick={() => commit({ fields: [...st.fields, { name: `field${st.fields.length + 1}`, type: "Float", value: 0 }] })} />
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {st.fields.map((field, index) => (
                  <div key={index} className="bg-[#252526] rounded border border-[#303030] p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <i className="ph ph-dots-six-vertical text-[#888]" />
                        <input type="text" className="w-20 bg-black border border-[#444] text-white px-1 text-xs rounded focus:border-[#0070e0] outline-none" value={field.name} disabled={props.keyboardLocked}
                          onChange={(e) => commit({ fields: st.fields.map((f, i) => i === index ? { ...f, name: e.target.value } : f) })} />
                      </div>
                      <i className="ph ph-trash text-[#f87171] hover:text-red-400 cursor-pointer" title="Remove field" onClick={() => { if (!props.keyboardLocked) commit({ fields: st.fields.filter((_, i) => i !== index) }); }} />
                    </div>
                    <div className="flex gap-2 items-center">
                      <select className="flex-1 engine-input px-1 py-1 rounded text-white text-xs" value={field.type} disabled={props.keyboardLocked}
                        onChange={(e) => { const type = e.target.value as ComponentFieldType; commit({ fields: st.fields.map((f, i) => i === index ? { ...f, type, value: defaultForComponentType(type) } : f) }); }}>
                        {COMPONENT_FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {valueInput(field.type, field.value, (next) => commit({ fields: st.fields.map((f, i) => i === index ? { ...f, value: next } : f) }), true)}
                    </div>
                  </div>
                ))}
                <button className="w-full py-1.5 mt-2 bg-[#2d2d2d] hover:bg-[#3a3a3a] border border-[#303030] rounded text-white transition-colors flex justify-center items-center gap-2 disabled:opacity-40" disabled={props.keyboardLocked} onClick={() => commit({ fields: [...st.fields, { name: `field${st.fields.length + 1}`, type: "Float", value: 0 }] })}>
                  <i className="ph ph-plus" /> Add Property
                </button>
              </div>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function blueprintNodeAccent(type: string): { grad: string; icon: string; text: string } {
  if (/^On[A-Z]/.test(type) || /Event|Update|Start|Tick/i.test(type)) {
    return { grad: "from-red-800 to-red-700", icon: "ph-fill ph-lightning", text: "text-red-500" };
  }
  if (/Filter|Has|Check|Query|If|Branch|Compare|Is[A-Z]/i.test(type)) {
    return { grad: "from-blue-800 to-blue-700", icon: "ph-fill ph-funnel", text: "text-blue-400" };
  }
  if (/Set|Add|Apply|Move|Spawn|Destroy|Write|Emit|Play|Change|Update/i.test(type)) {
    return { grad: "from-emerald-700 to-emerald-600", icon: "ph-fill ph-arrow-circle-right", text: "text-emerald-500" };
  }
  return { grad: "from-slate-700 to-slate-600", icon: "ph-fill ph-circle", text: "text-slate-400" };
}

function portDotClass(kind: string): string {
  if (kind === "flow") return "w-3 h-3 bg-white border border-black rotate-45 rounded-[2px]";
  if (kind === "signal") return "w-3 h-3 rounded-full bg-amber-500 border border-black";
  return "w-3 h-3 rounded-full bg-cyan-500 border border-black";
}

function wireColor(kind: string): string {
  if (kind === "flow") return "#ffffff";
  if (kind === "signal") return "#f59e0b";
  return "#06b6d4";
}

function variableDotColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("float") || t.includes("number") || t.includes("int")) return "bg-green-500";
  if (t.includes("bool")) return "bg-red-500";
  if (t.includes("vector") || t.includes("vec")) return "bg-yellow-500";
  return "bg-slate-500";
}

function BlueprintView(props: { path: string; keyboardLocked: boolean }) {
  const [graph, setGraphState] = useState<GraphAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [bounds, setBounds] = useState({ x: 0, y: 0, width: 960, height: 540 });
  const graphRef = useRef<GraphAsset | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const portRefs = useRef(new Map<string, HTMLSpanElement>());
  const [portPoints, setPortPoints] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | undefined>();
  const [graphView, setGraphView] = useState({ x: 0, y: 0, zoom: 1 });
  const graphViewRef = useRef(graphView);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const panState = useRef<{ pointerId: number; startX: number; startY: number; viewX: number; viewY: number } | null>(null);
  const dragState = useRef<{ nodeId: string; pointerId: number; sourceGraph: GraphAsset; startPoint: { x: number; y: number } } | null>(null);

  const setGraph = (next: GraphAsset | null) => { graphRef.current = next; setGraphState(next); };
  const updateGraph = (next: GraphAsset) => { setGraph(next); void saveGraphAsset(props.path, next); };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(undefined);
    setGraph(null);
    fetchGraphAsset(props.path)
      .then((g) => {
        if (!alive) return;
        setGraph(g);
        setError(g ? undefined : "graph not found");
        if (g) {
          setBounds(computeGraphBounds(g));
          setSelectedNodeId(g.entrypoint);
        }
      })
      .catch(() => { if (alive) { setGraph(null); setError("failed to load graph"); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [props.path]);

  useEffect(() => { graphViewRef.current = graphView; }, [graphView]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !graphRef.current) return;
    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    setGraphView(fitGraphView(rect.width, rect.height, bounds));
  }, [bounds]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !graphRef.current || !viewport) return;
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
    return () => { cancelAnimationFrame(raf); resizeObserver.disconnect(); };
  }, [graph, bounds, graphView]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const pan = panState.current;
      if (pan && event.pointerId === pan.pointerId) {
        setGraphView({ x: pan.viewX + (event.clientX - pan.startX), y: pan.viewY + (event.clientY - pan.startY), zoom: graphViewRef.current.zoom });
        return;
      }
      const drag = dragState.current;
      const currentGraph = graphRef.current;
      if (!drag || !currentGraph || event.pointerId !== drag.pointerId) return;
      const currentPoint = toGraphPoint(viewportRef.current, graphViewRef.current, event.clientX, event.clientY);
      if (!currentPoint) return;
      const nextGraph = moveGraphNode(drag.sourceGraph, drag.nodeId, currentPoint.x - drag.startPoint.x, currentPoint.y - drag.startPoint.y);
      setGraph(nextGraph);
    };
    const finishDrag = (event: PointerEvent) => {
      const pan = panState.current;
      if (pan && event.pointerId === pan.pointerId) { panState.current = null; return; }
      const drag = dragState.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragState.current = null;
      const g = graphRef.current;
      if (g) void saveGraphAsset(props.path, g);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [props.path]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const t = event.target;
      if (t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (selectedEdgeKey) { deleteEdge(selectedEdgeKey); return; }
      if (selectedNodeId) deleteNode(selectedNodeId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEdgeKey, selectedNodeId]);

  const nodeMap = new Map(graph?.nodes.map((node) => [node.id, node]) ?? []);
  const selectedNode = selectedNodeId ? graph?.nodes.find((node) => node.id === selectedNodeId) : undefined;
  const selectedSpec = selectedNode ? GRAPH_NODE_LIBRARY.find((s) => s.type === selectedNode.type) : undefined;

  const handleGraphPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!graphRef.current || !(target instanceof Element)) return;
    if (target.closest(".blueprint-node")) return;
    if (!(event.button === 1 || (event.button === 0 && (event.altKey || event.metaKey)))) return;
    event.preventDefault();
    panState.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, viewX: graphViewRef.current.x, viewY: graphViewRef.current.y };
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
    const factor = Math.exp(-delta * 0.0015 * Math.pow(GRAPH_ZOOM_SENSITIVITY, 1.2));
    const nextZoom = clamp(graphViewRef.current.zoom * factor, 0.2, 3);
    setGraphView({ x: cx - wx * nextZoom, y: cy - wy * nextZoom, zoom: nextZoom });
  };

  const zoomGraph = (factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const wx = (cx - graphViewRef.current.x) / graphViewRef.current.zoom;
    const wy = (cy - graphViewRef.current.y) / graphViewRef.current.zoom;
    const nextZoom = clamp(graphViewRef.current.zoom * factor, 0.2, 3);
    setGraphView({ x: cx - wx * nextZoom, y: cy - wy * nextZoom, zoom: nextZoom });
  };

  const fitView = () => {
    const viewport = viewportRef.current;
    setGraphView(fitGraphView(viewport?.clientWidth ?? 1400, viewport?.clientHeight ?? 900, bounds));
  };

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>, nodeId: string) => {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const startPoint = toGraphPoint(viewportRef.current, graphViewRef.current, event.clientX, event.clientY);
    if (!startPoint) return;
    setSelectedNodeId(nodeId);
    setSelectedEdgeKey(undefined);
    dragState.current = { nodeId, pointerId: event.pointerId, sourceGraph: currentGraph, startPoint };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  function deleteNode(nodeId: string) {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const nextNodes = currentGraph.nodes.filter((node) => node.id !== nodeId);
    const nextGraph = {
      ...currentGraph,
      nodes: nextNodes,
      edges: currentGraph.edges.filter((edge) => edge.from.node !== nodeId && edge.to.node !== nodeId),
      entrypoint: currentGraph.entrypoint === nodeId ? (nextNodes[0]?.id ?? currentGraph.entrypoint) : currentGraph.entrypoint,
    };
    updateGraph(nextGraph);
    setSelectedNodeId((current) => (current === nodeId ? nextGraph.nodes[0]?.id : current));
  }

  function deleteEdge(edgeId: string) {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    updateGraph({ ...currentGraph, edges: currentGraph.edges.filter((edge) => edgeKey(edge) !== edgeId) });
    setSelectedEdgeKey((current) => (current === edgeId ? undefined : current));
  }

  const addNode = (spec: GraphNodeSpec) => {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const node = createGraphNode(spec, { x: bounds.x + 180 + currentGraph.nodes.length * 18, y: bounds.y + 160 + currentGraph.nodes.length * 12 });
    updateGraph({ ...currentGraph, nodes: [...currentGraph.nodes, node] });
    setSelectedNodeId(node.id);
  };

  const updateNodeData = (nodeId: string, field: string, nextValue: string, type: GraphNodeSpec["fields"][number]["type"]) => {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    const parsed = parseEditableValue(nextValue, type);
    updateGraph({
      ...currentGraph,
      nodes: currentGraph.nodes.map((node) => node.id === nodeId ? { ...node, data: { ...(node.data ?? {}), [field]: parsed } } : node),
    });
  };

  const addVariable = () => {
    const currentGraph = graphRef.current;
    if (!currentGraph || props.keyboardLocked) return;
    updateGraph({ ...currentGraph, variables: [...currentGraph.variables, { name: `Var${currentGraph.variables.length + 1}`, scope: "private", type: "float", default: 0 }] });
  };

  const filteredLibrary = GRAPH_NODE_LIBRARY.filter((spec) => `${spec.label} ${spec.type}`.toLowerCase().includes(paletteQuery.trim().toLowerCase()));
  const componentDefs: ComponentDefinition[] = getComponentDefinitions();

  return (
    <div className="absolute inset-0 z-40 flex pointer-events-auto text-xs">
      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden blueprint-grid">
        {/* Toolbar */}
        <div className="absolute top-3 left-3 z-20 flex bg-black/60 backdrop-blur border border-white/10 rounded overflow-hidden">
          <button className="px-3 py-1.5 text-[#ccc] hover:text-white hover:bg-black/80 transition-all font-medium flex items-center gap-1" onClick={() => setPaletteOpen((open) => !open)} title="Find / add node">
            <i className="ph-fill ph-magnifying-glass text-[#888]" /> Find
          </button>
        </div>
        {/* Zoom controls */}
        <div className="absolute top-3 right-3 z-20 flex bg-black/60 backdrop-blur border border-white/10 rounded overflow-hidden">
          <button className="w-8 h-8 flex items-center justify-center text-[#888] hover:text-white hover:bg-black/80 border-r border-white/10" onClick={() => zoomGraph(1 / 1.18)} title="Zoom out"><i className="ph ph-minus" /></button>
          <button className="w-8 h-8 flex items-center justify-center text-[#888] hover:text-white hover:bg-black/80 border-r border-white/10" onClick={fitView} title="Fit"><i className="ph ph-arrows-in" /></button>
          <button className="w-8 h-8 flex items-center justify-center text-[#888] hover:text-white hover:bg-black/80" onClick={() => zoomGraph(1.18)} title="Zoom in"><i className="ph ph-plus" /></button>
        </div>
        {/* Find popover */}
        {paletteOpen && (
          <div className="absolute top-12 left-3 z-30 w-60 bg-[#1e1e1e] border border-[#303030] rounded shadow-lg flex flex-col overflow-hidden">
            <div className="p-2 border-b border-[#303030]">
              <input autoFocus className="engine-input w-full px-2 py-1 rounded" placeholder="search nodes" value={paletteQuery} onChange={(e) => setPaletteQuery(e.target.value)} />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredLibrary.map((spec) => (
                <button key={spec.type} className="w-full text-left px-3 py-1.5 text-[#ccc] hover:bg-[#2d2d2d] hover:text-white flex justify-between gap-2" onClick={() => { addNode(spec); setPaletteOpen(false); setPaletteQuery(""); }}>
                  <span className="truncate">{spec.label}</span><span className="text-[#666] shrink-0">{spec.type}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {loading && <div className="absolute inset-0 grid place-items-center text-[#666]">loading graph…</div>}
        {error && <div className="absolute inset-0 grid place-items-center text-[#666]">{error}</div>}
        {graph && !loading && !error && (
          <div ref={viewportRef} className="absolute inset-0 overflow-hidden" onPointerDown={handleGraphPointerDown} onWheel={handleGraphWheel}>
            <div ref={canvasRef} className="absolute top-0 left-0" style={{ width: `${bounds.width}px`, height: `${bounds.height}px`, transform: `translate(${graphView.x}px, ${graphView.y}px) scale(${graphView.zoom})`, transformOrigin: "0 0" }}>
              <svg className="absolute top-0 left-0 pointer-events-none" width={bounds.width} height={bounds.height} viewBox={`0 0 ${bounds.width} ${bounds.height}`}>
                {graph.edges.map((edge, index) => {
                  const from = nodeMap.get(edge.from.node);
                  const to = nodeMap.get(edge.to.node);
                  if (!from || !to) return null;
                  const id = edgeKey(edge);
                  const spec = GRAPH_NODE_LIBRARY.find((s) => s.type === from.type);
                  const kind = spec?.outputs.find((p) => p.name === edge.from.port)?.kind ?? "data";
                  const fromPoint = portPoints[`${edge.from.node}:output:${edge.from.port}`] ?? getGraphPortPoint(from, edge.from.port, "output", bounds);
                  const toPoint = portPoints[`${edge.to.node}:input:${edge.to.port}`] ?? getGraphPortPoint(to, edge.to.port, "input", bounds);
                  const mid = (fromPoint.x + toPoint.x) / 2;
                  return (
                    <path
                      key={`${id}-${index}`}
                      d={`M ${fromPoint.x} ${fromPoint.y} C ${mid} ${fromPoint.y}, ${mid} ${toPoint.y}, ${toPoint.x} ${toPoint.y}`}
                      fill="none"
                      stroke={wireColor(kind)}
                      strokeWidth={selectedEdgeKey === id ? 3.5 : 2.5}
                      opacity={selectedEdgeKey === id ? 1 : 0.85}
                      style={{ pointerEvents: "stroke", cursor: "pointer" }}
                      onClick={() => { setSelectedEdgeKey(id); setSelectedNodeId(undefined); }}
                    />
                  );
                })}
              </svg>
              {graph.nodes.map((node) => {
                const spec = GRAPH_NODE_LIBRARY.find((entry) => entry.type === node.type);
                const accent = blueprintNodeAccent(node.type);
                const isSelected = node.id === selectedNodeId;
                const flowFirst = <T extends { kind: string }>(ports: readonly T[]) =>
                  [...ports].sort((a, b) => (a.kind === "flow" ? 0 : 1) - (b.kind === "flow" ? 0 : 1));
                const inputs = flowFirst(spec?.inputs ?? []);
                const outputs = flowFirst(spec?.outputs ?? []);
                return (
                  <div
                    key={node.id}
                    className={`blueprint-node absolute w-48 bg-[#1e1e1e]/95 backdrop-blur-sm rounded-md shadow-2xl flex flex-col font-sans text-[11px] ${isSelected ? "ring-2 ring-[#0070e0]" : "border border-black"}`}
                    style={{ left: `${node.position.x - bounds.x}px`, top: `${node.position.y - bounds.y}px` }}
                    onPointerDown={(event) => beginDrag(event, node.id)}
                    onClick={() => { setSelectedNodeId(node.id); setSelectedEdgeKey(undefined); }}
                  >
                    <div className={`h-7 rounded-t-md flex items-center px-2 text-white font-bold tracking-wide border-b border-black bg-gradient-to-r ${accent.grad}`}>
                      <i className={`${accent.icon} mr-1 text-base opacity-80`} /> <span className="truncate flex-1">{spec?.label ?? node.type}</span>
                      <button
                        className="ml-1 text-white/70 hover:text-white"
                        title="Delete node"
                        disabled={props.keyboardLocked}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => { event.stopPropagation(); deleteNode(node.id); }}
                      >
                        <i className="ph ph-x text-xs" />
                      </button>
                    </div>
                    <div className="p-2 py-3 flex justify-between gap-2">
                      <div className="space-y-2">
                        {inputs.map((port) => (
                          <div key={`in-${port.name}`} className="flex items-center gap-1.5 group">
                            <span
                              className={portDotClass(port.kind)}
                              ref={(el) => { const k = `${node.id}:input:${port.name}`; if (el) portRefs.current.set(k, el); else portRefs.current.delete(k); }}
                            />
                            <span className="text-[#ccc] group-hover:text-white">{port.label ?? port.name}</span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2 text-right">
                        {outputs.map((port) => (
                          <div key={`out-${port.name}`} className="flex items-center justify-end gap-1.5 group">
                            <span className="text-[#ccc] group-hover:text-white">{port.label ?? port.name}</span>
                            <span
                              className={portDotClass(port.kind)}
                              ref={(el) => { const k = `${node.id}:output:${port.name}`; if (el) portRefs.current.set(k, el); else portRefs.current.delete(k); }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    {spec && spec.fields.length > 0 && (
                      <div className="px-2 pb-2 space-y-1.5">
                        {spec.fields.map((field) => {
                          const selectCls = "flex-1 min-w-0 bg-[#000] border border-[#303030] text-[9px] px-1 py-0.5 rounded text-[#ccc]";
                          const targetDef = componentDefs.find((d) => d.id === String(node.data?.component ?? ""));
                          const isComponentField = field.name === "component";
                          const isEnumValueField = node.type === "SetComponent" && field.name === "value" && targetDef?.kind === "enum" && (targetDef.values?.length ?? 0) > 0;
                          return (
                          <div key={field.name} className="flex items-center gap-1.5">
                            <span className="text-[#888] w-14 truncate">{field.label}</span>
                            {isComponentField ? (
                              <select
                                className={selectCls}
                                value={String(node.data?.component ?? "")}
                                disabled={props.keyboardLocked}
                                onPointerDown={(event) => event.stopPropagation()}
                                onChange={(event) => updateNodeData(node.id, field.name, event.target.value, field.type)}
                              >
                                <option value="">—</option>
                                {componentDefs.map((d) => <option key={d.id} value={d.id}>{d.id}</option>)}
                                {Boolean(node.data?.component) && !componentDefs.some((d) => d.id === node.data?.component) && <option value={String(node.data?.component)}>{String(node.data?.component)}</option>}
                              </select>
                            ) : isEnumValueField ? (
                              <select
                                className={selectCls}
                                value={String(node.data?.value ?? "")}
                                disabled={props.keyboardLocked}
                                onPointerDown={(event) => event.stopPropagation()}
                                onChange={(event) => updateNodeData(node.id, field.name, event.target.value, field.type)}
                              >
                                {(targetDef?.values ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
                              </select>
                            ) : field.type === "boolean" ? (
                              <input
                                type="checkbox"
                                className="accent-[#0070e0]"
                                checked={String(node.data?.[field.name] ?? "") === "true"}
                                disabled={props.keyboardLocked}
                                onPointerDown={(event) => event.stopPropagation()}
                                onChange={(event) => updateNodeData(node.id, field.name, String(event.target.checked), field.type)}
                              />
                            ) : (
                              <input
                                type="text"
                                className="flex-1 min-w-0 bg-[#000] border border-[#303030] text-[9px] px-1 py-0.5 rounded text-center text-[#888]"
                                value={formatEditableValue(node.data?.[field.name], field.type)}
                                disabled={props.keyboardLocked}
                                onPointerDown={(event) => event.stopPropagation()}
                                onChange={(event) => updateNodeData(node.id, field.name, event.target.value, field.type)}
                              />
                            )}
                          </div>
                        );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right panel: System Variables + Node Details */}
      <aside className="w-72 bg-[#1e1e1e] border-l border-[#303030] flex flex-col flex-shrink-0 shadow-xl">
        <div className="flex-1 flex flex-col border-b border-[#303030] min-h-[40%]">
          <div className="h-8 bg-[#252526] flex items-center px-3 border-b border-[#303030] justify-between text-white font-medium select-none">
            System Variables
            <i className="ph ph-plus text-[#888] hover:text-white cursor-pointer" title="Add Variable" onClick={addVariable} />
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-2 select-none space-y-1">
            {graph && graph.variables.length > 0 ? graph.variables.map((variable, index) => (
              <div key={`${variable.name}-${index}`} className="flex items-center justify-between px-2 py-1 hover:bg-[#2d2d2d] cursor-pointer rounded text-[#ccc] group">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${variableDotColor(variable.type)}`} />
                  {variable.name}
                </div>
                <span className="text-[10px] text-[#888] bg-[#111] px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">{variable.type}</span>
              </div>
            )) : <div className="text-[#666] px-2 py-1">no variables</div>}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-[40%]">
          <div className="h-8 bg-[#252526] flex items-center px-3 border-b border-[#303030] text-white font-medium select-none">Node Details</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {selectedNode ? (
              <>
                <div className="flex items-center gap-2 pb-2 border-b border-[#303030]">
                  <i className={`${blueprintNodeAccent(selectedNode.type).icon} ${blueprintNodeAccent(selectedNode.type).text} text-lg`} />
                  <div className="font-medium text-white">{selectedSpec?.label ?? selectedNode.type}</div>
                </div>
                <div className="space-y-3">
                  {selectedSpec && selectedSpec.fields.length > 0 ? selectedSpec.fields.map((field) => (
                    <div key={field.name} className="space-y-1">
                      <span className="text-[#888] text-[10px] uppercase font-bold tracking-wide">{field.label}</span>
                      {field.type === "boolean" ? (
                        <input
                          type="checkbox"
                          className="accent-[#0070e0] w-3.5 h-3.5"
                          checked={String(selectedNode.data?.[field.name] ?? "") === "true"}
                          disabled={props.keyboardLocked}
                          onChange={(event) => updateNodeData(selectedNode.id, field.name, String(event.target.checked), field.type)}
                        />
                      ) : (
                        <input
                          className="w-full engine-input px-2 py-1.5 rounded text-white text-xs"
                          value={formatEditableValue(selectedNode.data?.[field.name], field.type)}
                          disabled={props.keyboardLocked}
                          onChange={(event) => updateNodeData(selectedNode.id, field.name, event.target.value, field.type)}
                        />
                      )}
                    </div>
                  )) : <div className="text-[#666]">no settings</div>}
                  <div className="text-[10px] text-[#666] pt-1 break-all">id: {selectedNode.id}</div>
                </div>
              </>
            ) : <div className="text-[#666]">select a node</div>}
          </div>
        </div>
      </aside>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm text-xs" role="dialog" aria-modal="true" onClick={props.onClose}>
      <div className="w-[560px] max-w-[90vw] max-h-[80vh] flex flex-col bg-[#1e1e1e] border border-[#303030] rounded-lg shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="h-9 bg-[#252526] flex items-center justify-between px-3 border-b border-[#303030]">
          <div className="flex flex-col">
            <span className="text-white font-medium">File Preview</span>
            <span className="text-[#888] text-[10px]">{props.path}</span>
          </div>
          <button className="text-[#888] hover:text-white transition-colors" onClick={props.onClose} aria-label="Close preview">
            <i className="ph ph-x" />
          </button>
        </div>
        {props.loading ? (
          <div className="p-4 text-[#666]">loading file…</div>
        ) : props.error ? (
          <div className="p-4 text-[#666]">{props.error}</div>
        ) : (
          <pre className="flex-1 overflow-auto p-3 font-mono text-[11px] text-[#ccc]">{JSON.stringify(props.value, null, 2)}</pre>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm text-xs" role="dialog" aria-modal="true" onClick={props.onClose}>
      <div className="w-[360px] max-w-[90vw] flex flex-col bg-[#1e1e1e] border border-[#303030] rounded-lg shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="h-9 bg-[#252526] flex items-center justify-between px-3 border-b border-[#303030]">
          <div className="flex flex-col">
            <span className="text-white font-medium capitalize">Create {props.kind}</span>
            <span className="text-[#888] text-[10px]">{props.basePath || "root"}</span>
          </div>
          <button className="text-[#888] hover:text-white transition-colors" onClick={props.onClose} aria-label="Close dialog">
            <i className="ph ph-x" />
          </button>
        </div>
        <div className="p-3 space-y-2">
          <label className="flex flex-col gap-1">
            <span className="text-[#888]">Name</span>
            <input
              className="engine-input px-2 py-1 rounded"
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
          {exists && props.name.trim() && !props.keyboardLocked ? <div className="text-[#f87171]">already exists</div> : null}
        </div>
        <div className="flex justify-end gap-2 p-3 border-t border-[#303030]">
          <button className={DIALOG_BTN} onClick={props.onClose}>Cancel</button>
          <button className={DIALOG_BTN_PRIMARY} onClick={props.onConfirm} disabled={!props.name.trim() || exists || props.keyboardLocked}>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm text-xs" role="dialog" aria-modal="true" onClick={props.onClose}>
      <div className="w-[360px] max-w-[90vw] flex flex-col bg-[#1e1e1e] border border-[#303030] rounded-lg shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="h-9 bg-[#252526] flex items-center justify-between px-3 border-b border-[#303030]">
          <div className="flex flex-col">
            <span className="text-white font-medium">Import content</span>
            <span className="text-[#888] text-[10px]">{props.basePath || "root"}</span>
          </div>
          <button className="text-[#888] hover:text-white transition-colors" onClick={props.onClose} aria-label="Close dialog">
            <i className="ph ph-x" />
          </button>
        </div>
        <div className="p-3 space-y-2">
          <div className="text-[#888]">Choose a JSON file, then import it into the current folder.</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate text-[#ccc] bg-[#111111] border border-[#303030] rounded px-2 py-1">{props.file ? props.file.name : "No file chosen"}</div>
            <button className={DIALOG_BTN} onClick={props.onPickFile} disabled={props.keyboardLocked}>
              Choose File
            </button>
          </div>
          {props.error ? <div className="text-[#f87171]">{props.error}</div> : null}
        </div>
        <div className="flex justify-end gap-2 p-3 border-t border-[#303030]">
          <button className={DIALOG_BTN} onClick={props.onClose}>Cancel</button>
          <button className={DIALOG_BTN_PRIMARY} onClick={props.onImport} disabled={!props.file || props.keyboardLocked || props.busy}>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm text-xs" role="dialog" aria-modal="true" onClick={props.onClose}>
      <div className="w-[360px] max-w-[90vw] flex flex-col bg-[#1e1e1e] border border-[#303030] rounded-lg shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="h-9 bg-[#252526] flex items-center justify-between px-3 border-b border-[#303030]">
          <div className="flex flex-col">
            <span className="text-white font-medium capitalize">Delete {props.node.kind}</span>
            <span className="text-[#888] text-[10px]">{props.node.path || "root"}</span>
          </div>
          <button className="text-[#888] hover:text-white transition-colors" onClick={props.onClose} aria-label="Close dialog">
            <i className="ph ph-x" />
          </button>
        </div>
        <div className="p-3">
          <div className="text-[#888]">This action cannot be undone.</div>
        </div>
        <div className="flex justify-end gap-2 p-3 border-t border-[#303030]">
          <button className={DIALOG_BTN} onClick={props.onClose}>Cancel</button>
          <button className={DIALOG_BTN_DANGER} onClick={props.onConfirm} disabled={props.keyboardLocked}>
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
      return <i className="ph-fill ph-folder" />;
    case "world":
      return <i className="ph-fill ph-globe-hemisphere-west" />;
    case "component":
      return <i className="ph-fill ph-puzzle-piece" />;
    case "prefab":
      return <i className="ph-fill ph-cube" />;
    case "graph":
      return <i className="ph-fill ph-graph" />;
    case "file":
      return <i className="ph-fill ph-file-code" />;
  }
}

function contentTypeBarColor(kind: ContentTreeNode["kind"]) {
  switch (kind) {
    case "folder":
      return "bg-[#666]";
    case "world":
      return "bg-orange-500";
    case "component":
      return "bg-purple-500";
    case "prefab":
      return "bg-cyan-500";
    case "graph":
      return "bg-green-500";
    case "file":
      return "bg-blue-500";
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
