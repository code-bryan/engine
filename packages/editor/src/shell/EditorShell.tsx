// The editor's composition root: top header + menus, world/doc tab bar, the
// viewport chrome (Show menu, tool rail, snap tools, camera controls), the
// content drawer, the right-hand Outliner + Details panels, doc overlays
// (blueprint / component editors) and the Window/project modals. It owns only
// transient UI-chrome state (open menus, which window panel, zoom toast); all
// durable state comes in as props from the view-model, and every heavy feature
// is a component under features/*. Extracted verbatim from the old debugger-ui.

import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type DragEvent as ReactDragEvent } from "react";
import type { ContentBookmark, ContentTreeNode, EditorToolMode, EngineAsset } from "../shared/types";
import type {
  DebuggerEntityItemView,
  DebuggerInspectorCardView,
  DebuggerLogEntryView,
  DebuggerOutlineNodeView,
  DebuggerSnapshotView,
  DebuggerStatusCardView,
  DebuggerSystemView,
} from "./view-types";
import { ContentBrowser } from "../features/content/ContentBrowser";
import { SceneSystemsPanel } from "../features/systems/SceneSystemsPanel";
import { SystemsDrawer } from "../features/systems/SystemsDrawer";
import { SnapshotsDrawer } from "../features/snapshots/SnapshotsDrawer";
import { EventLogDrawer } from "../features/log/EventLogDrawer";
import { ProjectPathDialog } from "../features/project/ProjectPathDialog";
import { StartScreen } from "../features/project/StartScreen";
import { ComponentView } from "../features/components/ComponentView";
import { BlueprintView } from "../features/blueprint/BlueprintView";
import { InspectorField } from "../components/InspectorField";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, ContextMenuSub } from "../components/ContextMenu";
import { DIALOG_BTN, DIALOG_BTN_PRIMARY, DIALOG_BTN_DANGER } from "../components/ui-kit";
import { Toasts } from "../components/Toasts";
import type { EditorToast } from "../state/types";

type BottomDrawerTab = "content" | "systems" | "snapshots" | "logs";

// Right-click context in the outliner: an entity row, a folder header, or empty
// space / the world root. Drives which context-menu items apply and where Add lands.
type OutlinerTarget =
  | { kind: "entity"; entity: number }
  | { kind: "folder"; folder: string }
  | { kind: "root" };

// Drag-over highlight sentinel for the ungrouped/root drop region (folder names
// are always trimmed non-empty, so an empty string never collides with one).
const ROOT_DROP = "";

export type EditorShellProps = {
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
  outline: DebuggerOutlineNodeView[];
  folders: string[];
  onCreateEntity: (folder?: string) => void;
  onRemoveEntity: (entity: number) => void;
  onRenameEntity: (entity: number, name: string) => void;
  onAddFolder: (name: string) => void;
  onRemoveFolder: (name: string) => void;
  onMoveEntity: (entity: number, folder?: string) => void;
  inspectorCards: DebuggerInspectorCardView[];
  snapshots: DebuggerSnapshotView[];
  systems: DebuggerSystemView[];
  logs: DebuggerLogEntryView[];
  logFilters: Array<{ cat: string; active: boolean }>;
  logPaused: boolean;
  worldDirty: boolean;
  onSave: () => void;
  toasts: EditorToast[];
  onDismissToast: (id: number) => void;
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
  engineAssets: EngineAsset[];
  contentHighlightPath?: string;
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
  onRename?: (from: string, to: string, kind: ContentTreeNode["kind"]) => void;
  bookmarks: ContentBookmark[];
  onBookmarksChange?: (bookmarks: ContentBookmark[]) => void;
  onToggleContentDrawer: () => void;
  projectName: string | null;
  recentProjects: string[];
  onOpenProject: (path: string) => void;
  onCreateProject: (path: string) => void;
  onCloseProject: () => void;
  onBrowseProject: (mode: "open" | "create") => Promise<string | null>;
};

export function EditorShell(props: EditorShellProps) {
  const selectedEntityRef = useRef<HTMLButtonElement | null>(null);
  const [stagePortal, setStagePortal] = useState<HTMLElement | null>(null);
  const [cameraTuningOpen, setCameraTuningOpen] = useState(false);
  // Collapsed outliner folders (default expanded — a folder is collapsed only if present here).
  const [collapsedEntityFolders, setCollapsedEntityFolders] = useState<Set<string>>(() => new Set());
  const [windowPanel, setWindowPanel] = useState<BottomDrawerTab | null>(null);
  const [windowMenuOpen, setWindowMenuOpen] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [projectDialog, setProjectDialog] = useState<"open" | "create" | null>(null);
  const [snapMenu, setSnapMenu] = useState<"grid" | "rot" | null>(null);
  const [zoomToastOpen, setZoomToastOpen] = useState(false);
  // Outliner authoring: right-click menu target, folder-name dialog, folder-delete
  // confirm, and the in-flight drag source (a ref so onDrop reads it synchronously).
  const [outlinerMenu, setOutlinerMenu] = useState<{ x: number; y: number; target: OutlinerTarget } | null>(null);
  const [folderDialogName, setFolderDialogName] = useState<string | null>(null);
  const [deleteFolderName, setDeleteFolderName] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ entity: number; value: string } | null>(null);
  const dragEntityRef = useRef<number | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const zoomToastTimerRef = useRef<number | undefined>(undefined);
  const didMountRef = useRef(false);
  const isPlaying = props.playbackState === "playing";
  const selectedEntity = props.entities.find((entity) => entity.selected);
  const activeDocEntry = props.openDocs.find((doc) => doc.path === props.activeDoc);

  // ── Outliner authoring handlers ────────────────────────────────────────────
  const closeOutlinerMenu = () => setOutlinerMenu(null);
  const openOutlinerMenu = (event: ReactMouseEvent, target: OutlinerTarget) => {
    event.preventDefault();
    event.stopPropagation();
    if (target.kind === "entity") props.onSelectEntity(target.entity);
    setOutlinerMenu({ x: event.clientX, y: event.clientY, target });
  };
  const outlinerAddEntity = (target: OutlinerTarget) => {
    props.onCreateEntity(target.kind === "folder" ? target.folder : undefined);
    closeOutlinerMenu();
  };
  const outlinerAddFolder = () => {
    setFolderDialogName("");
    closeOutlinerMenu();
  };
  const confirmAddFolder = () => {
    const name = (folderDialogName ?? "").trim();
    if (name) props.onAddFolder(name);
    setFolderDialogName(null);
  };
  const outlinerDelete = (target: OutlinerTarget) => {
    if (target.kind === "entity") props.onRemoveEntity(target.entity);
    else if (target.kind === "folder") {
      const count = props.entities.filter((entity) => entity.folder === target.folder).length;
      if (count === 0) props.onRemoveFolder(target.folder);
      else setDeleteFolderName(target.folder);
    }
    closeOutlinerMenu();
  };
  const outlinerRename = (entity: number) => {
    const current = props.entities.find((row) => row.entity === entity);
    setRenameTarget({ entity, value: current?.title ?? "" });
    closeOutlinerMenu();
  };
  const confirmRename = () => {
    if (!renameTarget) return;
    props.onRenameEntity(renameTarget.entity, renameTarget.value.trim());
    setRenameTarget(null);
  };
  const handleEntityDragStart = (event: ReactDragEvent, entity: number) => {
    dragEntityRef.current = entity;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(entity));
  };
  // folder === undefined drops to the ungrouped root.
  const handleDropToFolder = (folder?: string) => {
    const entity = dragEntityRef.current;
    dragEntityRef.current = null;
    setDragOverFolder(null);
    if (entity !== null) props.onMoveEntity(entity, folder);
  };

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
    if (!fileMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-file-menu-root]")) return;
      setFileMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [fileMenuOpen]);

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

  // Close the active tab with Cmd/Ctrl+D — the active doc if one is open, else the
  // active world (kept open if it's the last world). preventDefault suppresses the
  // browser's bookmark dialog.
  const { activeDoc, activeWorld, onCloseDoc, onCloseWorld } = props;
  const worldCount = props.worlds.length;
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "d" || !(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      if (activeDoc !== null) onCloseDoc(activeDoc);
      else if (activeWorld && worldCount > 1) onCloseWorld(activeWorld);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeDoc, activeWorld, worldCount, onCloseDoc, onCloseWorld]);

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
      <Toasts toasts={props.toasts} onDismiss={props.onDismissToast} />
      <div className="absolute inset-0 flex flex-col text-xs pointer-events-none">
        {/* TOP HEADER BAR */}
        <header className="pointer-events-auto relative h-12 bg-[#181818] border-b border-[#303030] flex items-center justify-between px-3 select-none flex-shrink-0 z-30">
          <div className="flex items-center space-x-4">
            <div className="text-white font-bold text-sm tracking-wide flex items-center gap-2">
              <i className="ph-fill ph-hexagon text-[#0070e0] text-lg" />
              NEXUS
            </div>
            <nav className="flex space-x-1 text-[#cccccc]" data-window-menu-root onClick={(event) => event.stopPropagation()}>
              <div className="relative" data-file-menu-root>
                <div
                  className={`px-2 py-1 rounded cursor-pointer transition-colors${fileMenuOpen ? " bg-[#2d2d2d] text-white" : " hover:bg-[#2d2d2d]"}`}
                  onClick={() => setFileMenuOpen((open) => !open)}
                >
                  File
                </div>
                {fileMenuOpen && (
                  <div className="absolute left-0 top-full mt-1 w-44 bg-[#1e1e1e] border border-[#303030] rounded shadow-xl py-1 z-40">
                    <button
                      className="w-full text-left px-3 py-1.5 text-[#ccc] hover:bg-[#2d2d2d] hover:text-white transition-colors"
                      onClick={() => { setProjectDialog("open"); setFileMenuOpen(false); }}
                    >
                      Open Project…
                    </button>
                    <button
                      className="w-full text-left px-3 py-1.5 text-[#ccc] hover:bg-[#2d2d2d] hover:text-white transition-colors"
                      onClick={() => { setProjectDialog("create"); setFileMenuOpen(false); }}
                    >
                      New Project…
                    </button>
                    <div className="my-1 border-t border-[#303030]" />
                    <button
                      className="w-full text-left px-3 py-1.5 text-[#ccc] hover:bg-[#2d2d2d] hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-between gap-4"
                      disabled={!props.worldDirty}
                      onClick={() => { props.onSave(); setFileMenuOpen(false); }}
                    >
                      Save World
                      <span className="text-[10px] text-[#888]">⌘S</span>
                    </button>
                    <div className="my-1 border-t border-[#303030]" />
                    <button
                      className="w-full text-left px-3 py-1.5 text-[#ccc] hover:bg-[#2d2d2d] hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                      disabled={!props.projectName}
                      onClick={() => { props.onCloseProject(); setFileMenuOpen(false); }}
                    >
                      Close Project
                    </button>
                  </div>
                )}
              </div>
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
                onAuxClick={(event) => { if (event.button === 1 && props.worlds.length > 1) { event.preventDefault(); props.onCloseWorld(world.path); } }}
              >
                <i className={`ph-fill ph-globe-hemisphere-west ${active ? "text-[#0070e0]" : "text-[#888]"}`} /> {world.name}
                {active && props.worldDirty && <span className="text-[#0070e0] text-[8px] leading-none" title="Unsaved changes" aria-label="Unsaved changes">●</span>}
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
                onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); props.onCloseDoc(doc.path); } }}
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
                    engineAssets={props.engineAssets}
                    highlightPath={props.contentHighlightPath}
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
                    onRename={props.onRename}
                    bookmarks={props.bookmarks}
                    onBookmarksChange={props.onBookmarksChange}
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
                <button
                  className="text-[#888] hover:text-white transition-colors disabled:opacity-40 disabled:hover:text-[#888]"
                  title="Add entity"
                  disabled={isPlaying}
                  onClick={() => props.onCreateEntity()}
                >
                  <i className="ph ph-plus" />
                </button>
              </div>
              <div className="px-2 py-1.5 border-b border-[#303030]">
                <input
                  className="engine-input w-full px-2 py-1 rounded text-[11px]"
                  placeholder="search entity or tag"
                  value={props.entityQuery}
                  onChange={(event) => props.onEntityQueryChange(event.target.value)}
                />
              </div>
              <div
                className={`flex-1 overflow-y-auto py-1 select-none ${dragOverFolder === ROOT_DROP ? "bg-[#0070e0]/10" : ""}`}
                onContextMenu={(event) => { if (!isPlaying) openOutlinerMenu(event, { kind: "root" }); }}
                onDragOver={(event) => { if (dragEntityRef.current !== null) { event.preventDefault(); setDragOverFolder(ROOT_DROP); } }}
                onDrop={(event) => { event.preventDefault(); handleDropToFolder(undefined); }}
              >
                <button
                  className={`w-full flex items-center px-3 py-1 cursor-pointer text-left ${props.sceneSelected ? "bg-[#2d2d2d] border-l-2 border-[#0070e0] text-white" : "text-[#ccc] hover:bg-[#2d2d2d]"}`}
                  onClick={props.onSelectScene}
                >
                  <i className="ph ph-caret-down text-[10px] mr-1 text-[#888]" />
                  <i className={`ph-fill ph-globe-hemisphere-west mr-2 ${props.sceneSelected ? "text-[#0070e0]" : "text-[#888]"}`} />
                  <span className="truncate">{props.worldName}</span>
                </button>
                {(() => {
                  const renderEntityRow = (entity: DebuggerEntityItemView, padLeft: string) => (
                    <button
                      key={entity.entity}
                      ref={entity.selected ? selectedEntityRef : null}
                      draggable={!isPlaying}
                      onDragStart={(event) => handleEntityDragStart(event, entity.entity)}
                      onDragEnd={() => setDragOverFolder(null)}
                      className={`w-full flex items-center ${padLeft} pr-3 py-1 cursor-pointer text-left ${entity.selected ? "bg-[#2d2d2d] border-l-2 border-[#0070e0] text-white" : "text-[#ccc] hover:bg-[#2d2d2d]"}`}
                      onClick={() => props.onSelectEntity(entity.entity)}
                      onContextMenu={(event) => openOutlinerMenu(event, { kind: "entity", entity: entity.entity })}
                    >
                      <i className="ph-fill ph-cube text-[#888] mr-2" />
                      <span className="truncate flex-1">{entity.title}</span>
                      <span className="text-[10px] text-[#666] ml-2">{entity.tag}</span>
                    </button>
                  );
                  const toggleFolder = (folder: string) => {
                    setCollapsedEntityFolders((prev) => {
                      const next = new Set(prev);
                      if (next.has(folder)) next.delete(folder); else next.add(folder);
                      return next;
                    });
                  };
                  // Render the ordered outliner tree: folders and loose entities are
                  // top-level nodes in world-order; foldered entities nest under them.
                  return (
                    <>
                      {props.outline.map((node) => {
                        if (node.kind === "entity") return renderEntityRow(node.entity, "pl-7");
                        const collapsed = collapsedEntityFolders.has(node.name);
                        return (
                          <div
                            key={`folder:${node.name}`}
                            className={dragOverFolder === node.name ? "bg-[#0070e0]/10" : ""}
                            onDragOver={(event) => { if (dragEntityRef.current !== null) { event.preventDefault(); event.stopPropagation(); setDragOverFolder(node.name); } }}
                            onDrop={(event) => { event.preventDefault(); event.stopPropagation(); handleDropToFolder(node.name); }}
                          >
                            <button
                              className="w-full flex items-center pl-7 pr-3 py-1 cursor-pointer text-left text-[#ccc] hover:bg-[#2d2d2d]"
                              onClick={() => toggleFolder(node.name)}
                              onContextMenu={(event) => openOutlinerMenu(event, { kind: "folder", folder: node.name })}
                            >
                              <i className={`ph ph-caret-${collapsed ? "right" : "down"} text-[10px] mr-1 text-[#888]`} />
                              <i className={`ph-fill ph-${collapsed ? "folder" : "folder-open"} text-[#888] mr-2`} />
                              <span className="truncate flex-1">{node.name}</span>
                              <span className="text-[10px] text-[#666] ml-2">{node.children.length}</span>
                            </button>
                            {collapsed ? null : node.children.map((entity) => renderEntityRow(entity, "pl-12"))}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
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
                        <input
                          type="text"
                          key={selectedEntity.entity}
                          defaultValue={selectedEntity.title}
                          readOnly={isPlaying}
                          title="Rename entity (Enter to apply; blank resets to default)"
                          className="engine-input px-2 py-1 w-full rounded font-medium"
                          onBlur={(event) => props.onRenameEntity(selectedEntity.entity, event.target.value.trim())}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") event.currentTarget.blur();
                            if (event.key === "Escape") { event.currentTarget.value = selectedEntity.title; event.currentTarget.blur(); }
                          }}
                        />
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

      {projectDialog && (
        <ProjectPathDialog
          mode={projectDialog}
          recentProjects={props.recentProjects}
          onBrowse={() => props.onBrowseProject(projectDialog)}
          onSubmit={(path) => {
            if (projectDialog === "open") props.onOpenProject(path);
            else props.onCreateProject(path);
            setProjectDialog(null);
          }}
          onClose={() => setProjectDialog(null)}
        />
      )}

      {!props.projectName && (
        <StartScreen
          recentProjects={props.recentProjects}
          onOpen={() => setProjectDialog("open")}
          onCreate={() => setProjectDialog("create")}
          onPickRecent={(path) => props.onOpenProject(path)}
        />
      )}

      {/* Outliner right-click menu: Add ▸ (Entity / Folder) + Delete. */}
      {outlinerMenu && (
        <ContextMenu x={outlinerMenu.x} y={outlinerMenu.y} onClose={closeOutlinerMenu}>
          <ContextMenuSub label="Add" icon={<i className="ph ph-plus" />}>
            <ContextMenuItem icon={<i className="ph-fill ph-cube" />} disabled={isPlaying} onClick={() => outlinerAddEntity(outlinerMenu.target)}>
              Entity
            </ContextMenuItem>
            <ContextMenuItem icon={<i className="ph-fill ph-folder" />} disabled={isPlaying} onClick={outlinerAddFolder}>
              Folder
            </ContextMenuItem>
          </ContextMenuSub>
          {outlinerMenu.target.kind === "entity" && (
            <ContextMenuItem
              icon={<i className="ph ph-pencil-simple" />}
              disabled={isPlaying}
              onClick={() => { if (outlinerMenu.target.kind === "entity") outlinerRename(outlinerMenu.target.entity); }}
            >
              Rename
            </ContextMenuItem>
          )}
          {outlinerMenu.target.kind !== "root" && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem danger icon={<i className="ph ph-trash" />} disabled={isPlaying} onClick={() => outlinerDelete(outlinerMenu.target)}>
                Delete
              </ContextMenuItem>
            </>
          )}
        </ContextMenu>
      )}

      {/* New-folder name dialog (flat folders; created at the world root). */}
      {folderDialogName !== null && (() => {
        const trimmed = folderDialogName.trim();
        const collides = props.folders.includes(trimmed);
        const submit = () => { if (trimmed && !collides) confirmAddFolder(); };
        return createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm text-xs" role="dialog" aria-modal="true" onClick={() => setFolderDialogName(null)}>
            <div className="w-[360px] max-w-[90vw] flex flex-col bg-[#1e1e1e] border border-[#303030] rounded-lg shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
              <div className="h-9 bg-[#252526] flex items-center justify-between px-3 border-b border-[#303030]">
                <span className="text-white font-medium flex items-center gap-1"><i className="ph-fill ph-folder text-[#0070e0]" /> New folder</span>
                <button className="text-[#888] hover:text-white transition-colors" onClick={() => setFolderDialogName(null)} aria-label="Close dialog">
                  <i className="ph ph-x" />
                </button>
              </div>
              <div className="p-3 space-y-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[#888]">Name</span>
                  <input
                    className="engine-input px-2 py-1 rounded"
                    autoFocus
                    placeholder="folder name…"
                    value={folderDialogName}
                    onChange={(event) => setFolderDialogName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") submit();
                      if (event.key === "Escape") setFolderDialogName(null);
                    }}
                  />
                </label>
                {collides && trimmed ? <div className="text-[#f87171]">already exists</div> : null}
              </div>
              <div className="flex justify-end gap-2 p-3 border-t border-[#303030]">
                <button className={DIALOG_BTN} onClick={() => setFolderDialogName(null)}>Cancel</button>
                <button className={DIALOG_BTN_PRIMARY} onClick={submit} disabled={!trimmed || collides}>Create</button>
              </div>
            </div>
          </div>,
          document.body,
        );
      })()}

      {/* Rename an entity (custom display name; blank clears back to the tag default). */}
      {renameTarget !== null && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm text-xs" role="dialog" aria-modal="true" onClick={() => setRenameTarget(null)}>
          <div className="w-[360px] max-w-[90vw] flex flex-col bg-[#1e1e1e] border border-[#303030] rounded-lg shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
            <div className="h-9 bg-[#252526] flex items-center justify-between px-3 border-b border-[#303030]">
              <span className="text-white font-medium flex items-center gap-1"><i className="ph ph-pencil-simple text-[#0070e0]" /> Rename entity</span>
              <button className="text-[#888] hover:text-white transition-colors" onClick={() => setRenameTarget(null)} aria-label="Close dialog">
                <i className="ph ph-x" />
              </button>
            </div>
            <div className="p-3 space-y-2">
              <label className="flex flex-col gap-1">
                <span className="text-[#888]">Name</span>
                <input
                  className="engine-input px-2 py-1 rounded"
                  autoFocus
                  placeholder="entity name…"
                  value={renameTarget.value}
                  onChange={(event) => setRenameTarget((prev) => (prev ? { ...prev, value: event.target.value } : prev))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") confirmRename();
                    if (event.key === "Escape") setRenameTarget(null);
                  }}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 p-3 border-t border-[#303030]">
              <button className={DIALOG_BTN} onClick={() => setRenameTarget(null)}>Cancel</button>
              <button className={DIALOG_BTN_PRIMARY} onClick={confirmRename}>Rename</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Confirm deleting a non-empty folder: removes the folder AND its entities. */}
      {deleteFolderName !== null && (() => {
        const count = props.entities.filter((entity) => entity.folder === deleteFolderName).length;
        const confirm = () => { props.onRemoveFolder(deleteFolderName); setDeleteFolderName(null); };
        return createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm text-xs" role="dialog" aria-modal="true" onClick={() => setDeleteFolderName(null)}>
            <div className="w-[360px] max-w-[90vw] flex flex-col bg-[#1e1e1e] border border-[#303030] rounded-lg shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
              <div className="h-9 bg-[#252526] flex items-center justify-between px-3 border-b border-[#303030]">
                <div className="flex flex-col">
                  <span className="text-white font-medium">Delete folder</span>
                  <span className="text-[#888] text-[10px]">{deleteFolderName}</span>
                </div>
                <button className="text-[#888] hover:text-white transition-colors" onClick={() => setDeleteFolderName(null)} aria-label="Close dialog">
                  <i className="ph ph-x" />
                </button>
              </div>
              <div className="p-3">
                <div className="text-[#ccc]">Delete “{deleteFolderName}” and its {count} {count === 1 ? "entity" : "entities"}?</div>
                <div className="text-[#888] mt-1">This action cannot be undone.</div>
              </div>
              <div className="flex justify-end gap-2 p-3 border-t border-[#303030]">
                <button className={DIALOG_BTN} onClick={() => setDeleteFolderName(null)}>Cancel</button>
                <button className={DIALOG_BTN_DANGER} onClick={confirm}>Delete</button>
              </div>
            </div>
          </div>,
          document.body,
        );
      })()}
    </>
  );
}
