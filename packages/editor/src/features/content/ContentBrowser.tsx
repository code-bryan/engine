import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { ContentBookmark, ContentTreeNode, EngineAsset } from "../../shared/types";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, ContextMenuSub } from "../../shell/ContextMenu";
import { breadcrumbPaths, findContentFolder, joinContentPath, parentContentPath } from "./paths";
import { fetchContentFile } from "./api";
import { contentTypeBarColor, renderContentIcon } from "./icons";
import { BookmarkNameDialog, ContentCreateDialog, ContentImportDialog, ContentPreviewDialog, DeleteContentDialog, RenameContentDialog } from "./dialogs";

export type ContentBrowserProps = {
  tree: ContentTreeNode[];
  engineAssets?: EngineAsset[];
  // Asset path to highlight (e.g. the prefab the selected entity extends).
  highlightPath?: string;
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
  onRename?: (from: string, to: string, kind: ContentTreeNode["kind"]) => void;
  bookmarks?: ContentBookmark[];
  onBookmarksChange?: (bookmarks: ContentBookmark[]) => void;
  onOpenDoc: (path: string, kind: "graph" | "component") => void;
  keyboardLocked: boolean;
};

export function ContentBrowser(props: ContentBrowserProps) {
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
  const [renameTarget, setRenameTarget] = useState<ContentTreeNode | null>(null);
  const [renameName, setRenameName] = useState("");
  const [bookmarks, setBookmarks] = useState<ContentBookmark[]>(() => props.bookmarks ?? []);
  const [activeBookmarkId, setActiveBookmarkId] = useState<string | null>(null);
  // New-bookmark name dialog. `seedItem` (when set) is added to the fresh bookmark.
  const [bookmarkDialog, setBookmarkDialog] = useState<{ seedItem?: string } | null>(null);
  const [bookmarkDialogName, setBookmarkDialogName] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    folderPath: string;
    item?: ContentTreeNode;
  } | null>(null);
  // Engine tab: read-only library of premade engine assets. Own expansion state
  // (root expanded by default) and an in-memory preview — these never touch disk.
  const [engineExpanded, setEngineExpanded] = useState<Set<string>>(() => new Set(["engine", "engine/component"]));
  const [enginePreview, setEnginePreview] = useState<{ label: string; value: unknown } | null>(null);
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
  const searchTerm = search.trim().toLowerCase();
  const activeBookmark = bookmarks.find((bookmark) => bookmark.id === activeBookmarkId) ?? null;
  // Bookmark active → its member items, gathered across the whole project.
  // Otherwise a text search recurses into the current folder's subtree; a plain
  // view shows only the direct children.
  const listing: ContentTreeNode[] = activeBookmark
    ? flattenTree(props.tree).filter((node) => activeBookmark.items.includes(node.path))
    : searchTerm
      ? flattenTree(currentChildren)
      : currentChildren;
  const filteredChildren = searchTerm
    ? listing.filter((node) => `${node.name} ${node.path}`.toLowerCase().includes(searchTerm))
    : listing;
  const currentBreadcrumbs = breadcrumbPaths(selectedFolderPath);
  const activeSystems = new Set(props.activeSystems ?? []);

  // Adopt bookmarks pushed from the host (e.g. after a rename remaps item paths).
  // Local edits keep the same `props.bookmarks` reference, so this won't clobber them.
  useEffect(() => {
    setBookmarks(props.bookmarks ?? []);
  }, [props.bookmarks]);

  const updateBookmarks = (next: ContentBookmark[]) => {
    setBookmarks(next);
    props.onBookmarksChange?.(next);
  };

  const addItemToBookmark = (bookmarkId: string, itemPath: string) => {
    updateBookmarks(bookmarks.map((bookmark) =>
      bookmark.id === bookmarkId && !bookmark.items.includes(itemPath)
        ? { ...bookmark, items: [...bookmark.items, itemPath] }
        : bookmark,
    ));
    setContextMenu(null);
  };

  const removeBookmark = (id: string) => {
    updateBookmarks(bookmarks.filter((bookmark) => bookmark.id !== id));
    if (activeBookmarkId === id) setActiveBookmarkId(null);
  };

  const openNewBookmarkDialog = (seedItem?: string) => {
    setContextMenu(null);
    setBookmarkDialogName("");
    setBookmarkDialog({ seedItem });
  };

  const confirmNewBookmark = () => {
    const name = bookmarkDialogName.trim();
    if (!name) return;
    const bookmark: ContentBookmark = {
      id: crypto.randomUUID(),
      name,
      items: bookmarkDialog?.seedItem ? [bookmarkDialog.seedItem] : [],
    };
    updateBookmarks([...bookmarks, bookmark]);
    setBookmarkDialog(null);
    setBookmarkDialogName("");
  };

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

  // Navigating the folder tree always exits any active bookmark filter.
  const goToFolder = (path: string) => {
    setActiveBookmarkId(null);
    setSelectedFolderPath(path);
  };

  const openNode = (node: ContentTreeNode) => {
    setSelectedItemPath(node.path);
    if (node.kind === "folder") {
      setActiveBookmarkId(null);
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

  const beginRename = (node: ContentTreeNode) => {
    setContextMenu(null);
    setRenameTarget(node);
    setRenameName(node.name);
  };

  const confirmRename = () => {
    if (!renameTarget || !props.onRename) return;
    const name = renameName.trim();
    if (!name || name === renameTarget.name) return;
    const nextPath = joinContentPath(parentContentPath(renameTarget.path), name);
    if (selectedItemPath === renameTarget.path) setSelectedItemPath(nextPath);
    if (previewPath === renameTarget.path) setPreviewPath(undefined);
    if (renameTarget.kind === "folder" && selectedFolderPath === renameTarget.path) setSelectedFolderPath(nextPath);
    props.onRename(renameTarget.path, nextPath, renameTarget.kind);
    setRenameTarget(null);
    setRenameName("");
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

  // Premade assets grouped into the Engine tab's sections; empty sections are
  // hidden so the tree only shows what actually ships.
  const engineGroups = (
    [
      { kind: "component" as const, label: "Components" },
      { kind: "system" as const, label: "Systems" },
      { kind: "prefab" as const, label: "Prefabs" },
    ]
  )
    .map((group) => ({ ...group, items: (props.engineAssets ?? []).filter((asset) => asset.kind === group.kind) }))
    .filter((group) => group.items.length > 0);

  const toggleEngine = (key: string) => {
    const next = new Set(engineExpanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setEngineExpanded(next);
  };

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
          className={`w-full flex items-center pr-2 py-1 rounded cursor-pointer text-left transition-colors ${selectedFolderPath === "" && !activeBookmark ? "bg-[#2d2d2d] text-white" : "text-[#ccc] hover:bg-[#2d2d2d]"}`}
          style={{ paddingLeft: "8px" }}
          onClick={() => goToFolder("")}
        >
          <span className="w-3 flex justify-center text-[#888]"><i className="ph ph-caret-down text-[10px]" /></span>
          <span className="mr-2 text-[#0070e0]"><i className="ph-fill ph-folder-open" /></span>
          <span className="truncate">Content</span>
        </button>
        <div style={{ paddingLeft: "8px" }}>
          {renderFolderTree(props.tree, selectedFolderPath, expandedFolders, setExpandedFolders, goToFolder, props.onOpenWorld, openContextMenu)}
        </div>
        {engineGroups.length > 0 ? (
          <div className="mt-2 pt-2 border-t border-[#303030]">
            <button
              className="w-full flex items-center pr-2 py-1 rounded cursor-pointer text-left transition-colors text-[#ccc] hover:bg-[#2d2d2d]"
              style={{ paddingLeft: "8px" }}
              onClick={() => toggleEngine("engine")}
              title="Premade engine assets — usable by id, read-only"
            >
              <span className="w-3 flex justify-center text-[#888]"><i className={`ph ph-caret-${engineExpanded.has("engine") ? "down" : "right"} text-[10px]`} /></span>
              <span className="mr-2 text-[#0070e0]"><i className="ph-fill ph-cube-focus" /></span>
              <span className="truncate">Engine</span>
            </button>
            {engineExpanded.has("engine") ? (
              <div style={{ paddingLeft: "8px" }}>
                {engineGroups.map((group) => {
                  const sectionKey = `engine/${group.kind}`;
                  const open = engineExpanded.has(sectionKey);
                  return (
                    <div key={sectionKey}>
                      <button
                        className="w-full flex items-center pr-2 py-1 rounded cursor-pointer text-left transition-colors text-[#ccc] hover:bg-[#2d2d2d]"
                        style={{ paddingLeft: "22px" }}
                        onClick={() => toggleEngine(sectionKey)}
                      >
                        <span className="w-3 flex justify-center text-[#888]"><i className={`ph ph-caret-${open ? "down" : "right"} text-[10px]`} /></span>
                        <span className="mr-2 text-[#888]"><i className={`ph-fill ph-${open ? "folder-open" : "folder"}`} /></span>
                        <span className="truncate">{group.label}</span>
                        <span className="ml-auto text-[10px] text-[#555]">{group.items.length}</span>
                      </button>
                      {open ? group.items.map((asset) => (
                        <button
                          key={`${sectionKey}/${asset.id}`}
                          className="w-full flex items-center pr-2 py-1 rounded cursor-pointer text-left transition-colors text-[#ccc] hover:bg-[#2d2d2d]"
                          style={{ paddingLeft: "44px" }}
                          onClick={() => setEnginePreview({ label: `engine · ${group.label.toLowerCase().replace(/s$/, "")} · ${asset.id}`, value: asset.body ?? { id: asset.id, label: asset.label } })}
                          title={`${asset.label} (${asset.id}) — read-only`}
                        >
                          <span className="w-3" />
                          <span className="mr-2 text-[#666]">{renderContentIcon(asset.kind === "system" ? "graph" : asset.kind)}</span>
                          <span className="truncate">{asset.label}</span>
                        </button>
                      )) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {/* Right: Asset area */}
      <div className="flex-1 bg-[#1e1e1e] flex flex-col min-w-0">
        <div className="h-8 border-b border-[#303030] flex items-center px-3 gap-2 text-[#888] flex-shrink-0">
          <i className="ph ph-house cursor-pointer hover:text-white" onClick={() => goToFolder("")} />
          {activeBookmark ? (
            <span className="flex items-center gap-2">
              <i className="ph ph-caret-right text-[10px]" />
              <span className="text-[#ccc] font-medium flex items-center gap-1">
                <i className="ph-fill ph-bookmark-simple text-[#0070e0]" />
                {activeBookmark.name}
                <span className="text-[#666]">· {activeBookmark.items.length} item{activeBookmark.items.length === 1 ? "" : "s"}</span>
              </span>
              <button className="text-[#666] hover:text-white ml-1" onClick={() => setActiveBookmarkId(null)} title="Clear bookmark">
                <i className="ph ph-x text-[10px]" />
              </button>
            </span>
          ) : currentBreadcrumbs.map((crumb, index) => (
            <span key={crumb.path || "root"} className="flex items-center gap-2">
              <i className="ph ph-caret-right text-[10px]" />
              <button
                className={index === currentBreadcrumbs.length - 1 ? "text-[#ccc] font-medium" : "hover:text-white hover:underline"}
                onClick={() => goToFolder(crumb.path)}
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
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[#303030] flex-shrink-0 text-[11px] flex-wrap">
          <span className="text-[#666] mr-1 flex items-center gap-1"><i className="ph ph-bookmark-simple" /> Bookmarks</span>
          {bookmarks.length === 0 ? (
            <span className="text-[#555] italic">none — right-click an asset to add one</span>
          ) : bookmarks.map((bookmark) => {
            const active = activeBookmarkId === bookmark.id;
            return (
              <button
                key={bookmark.id}
                className={`group flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${active ? "bg-[#0070e0] border-[#0070e0] text-white" : "bg-[#2a2a2a] border-[#303030] text-[#ccc] hover:border-[#0070e0]"}`}
                onClick={() => setActiveBookmarkId(active ? null : bookmark.id)}
                title={`${bookmark.name} · ${bookmark.items.length} item${bookmark.items.length === 1 ? "" : "s"}`}
              >
                <i className={`ph-fill ph-bookmark-simple ${active ? "text-white" : "text-[#888]"}`} />
                {bookmark.name}
                <span
                  role="button"
                  aria-label={`Delete bookmark ${bookmark.name}`}
                  className={`ml-0.5 rounded-full px-0.5 opacity-0 group-hover:opacity-100 ${active ? "hover:bg-white/20" : "hover:bg-[#444] hover:text-white"}`}
                  onClick={(event) => { event.stopPropagation(); removeBookmark(bookmark.id); }}
                >
                  <i className="ph ph-x text-[10px]" />
                </span>
              </button>
            );
          })}
        </div>
        <div
          className="flex-1 p-4 grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-4 overflow-y-auto content-start"
          onContextMenu={(event) => openContextMenu(event)}
        >
          {filteredChildren.length === 0 ? (
            <div className="col-span-full text-[#666] py-6 text-center">{search.trim() ? "no matches" : activeBookmark ? "bookmark is empty" : "empty folder"}</div>
          ) : filteredChildren.map((node) => {
            const isSelected = selectedItemPath === node.path || (node.kind === "world" && node.path === props.activeWorld);
            const isActiveWorld = node.kind === "world" && node.path === props.activeWorld;
            // Dark-yellow highlight when this asset is the prefab the selected entity extends.
            const isHighlighted = !!props.highlightPath && node.path === props.highlightPath;
            const barColor = contentTypeBarColor(node.kind);
            const boxClass = isHighlighted
              ? "border-[#b8860b] bg-[#332d0f]"
              : isSelected
                ? "border-[#0070e0] bg-[#333]"
                : "bg-[#2a2a2a] border-[#444] group-hover:border-[#0070e0] group-hover:bg-[#333]";
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
                <div className={`w-16 h-16 rounded flex items-center justify-center mb-1 relative overflow-hidden shadow-md transition-colors border ${boxClass}`}>
                  <span className={`text-3xl ${isHighlighted ? "text-[#d4a017]" : isSelected ? "text-[#0070e0]" : "text-[#aaa]"}`}>{renderContentIcon(node.kind)}</span>
                  <div className={`absolute bottom-0 w-full h-1 ${barColor}`} />
                </div>
                <span className={`text-center truncate w-full text-[11px] px-1 rounded ${isActiveWorld ? "bg-[#0070e0] text-white" : isHighlighted ? "text-[#d4a017]" : isSelected ? "text-white" : "text-[#ccc] group-hover:text-white"}`}>
                  {node.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
          {contextMenu.item && (
            <ContextMenuItem
              icon={<i className={`ph ${contextMenu.item.kind === "folder" ? "ph-folder-open" : "ph-arrow-square-out"} text-[#888]`} />}
              onClick={() => activateNode(contextMenu.item!)}
            >
              {contextMenu.item.kind === "folder" ? "Enter folder" : contextMenu.item.kind === "world" ? "Load world" : contextMenu.item.kind === "graph" ? "Open system" : "Open file"}
            </ContextMenuItem>
          )}
          {contextMenu.item && (
            <ContextMenuItem
              icon={<i className="ph ph-pencil-simple text-[#888]" />}
              onClick={() => beginRename(contextMenu.item!)}
              disabled={!props.onRename || props.keyboardLocked}
            >
              Rename
            </ContextMenuItem>
          )}
          {contextMenu.item && (
            <ContextMenuSub label="Add to" icon={<i className="ph ph-bookmark-simple text-[#888]" />}>
              <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-[#666]">Bookmarks</div>
              {bookmarks.length === 0 ? (
                <div className="px-3 py-1.5 text-[#555] italic">none yet</div>
              ) : bookmarks.map((bookmark) => {
                const already = bookmark.items.includes(contextMenu.item!.path);
                return (
                  <ContextMenuItem
                    key={bookmark.id}
                    icon={<i className="ph-fill ph-bookmark-simple text-[#888]" />}
                    onClick={() => addItemToBookmark(bookmark.id, contextMenu.item!.path)}
                    disabled={already}
                    trailing={already ? <i className="ph ph-check text-[10px] ml-auto text-[#0070e0]" /> : undefined}
                  >
                    <span className="truncate">{bookmark.name}</span>
                  </ContextMenuItem>
                );
              })}
              <ContextMenuSeparator />
              <ContextMenuItem icon={<i className="ph ph-plus text-[#888]" />} onClick={() => openNewBookmarkDialog(contextMenu.item!.path)}>
                New bookmark…
              </ContextMenuItem>
            </ContextMenuSub>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem icon={<i className="ph ph-download-simple text-[#888]" />} onClick={() => triggerImport(contextFolderPath)} disabled={!props.onImportContent || props.keyboardLocked}>
            Import
          </ContextMenuItem>
          <ContextMenuItem icon={<i className="ph ph-folder-plus text-[#888]" />} onClick={() => beginCreate("folder", contextFolderPath)} disabled={!props.onCreateFolder || props.keyboardLocked}>
            New Folder
          </ContextMenuItem>
          <ContextMenuItem icon={<i className="ph ph-globe-hemisphere-west text-[#888]" />} onClick={() => beginCreate("world", contextFolderPath)} disabled={props.keyboardLocked}>
            New World
          </ContextMenuItem>
          <ContextMenuItem icon={<i className="ph ph-puzzle-piece text-[#888]" />} onClick={() => beginCreate("component", contextFolderPath)} disabled={!props.onCreateComponent || props.keyboardLocked}>
            New Component
          </ContextMenuItem>
          <ContextMenuItem icon={<i className="ph ph-cube text-[#888]" />} onClick={() => beginCreate("prefab", contextFolderPath)} disabled={!props.onCreatePrefab || props.keyboardLocked}>
            New Prefab
          </ContextMenuItem>
          <ContextMenuItem icon={<i className="ph ph-graph text-[#888]" />} onClick={() => beginCreate("graph", contextFolderPath)} disabled={!props.onCreateGraph || props.keyboardLocked}>
            New System
          </ContextMenuItem>
          {!contextMenu.item && (
            <ContextMenuItem icon={<i className="ph ph-bookmark-simple text-[#888]" />} onClick={() => openNewBookmarkDialog()}>
              New bookmark
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            icon={<i className="ph ph-trash" />}
            danger
            onClick={() => { if (contextMenu.item) deleteNode(contextMenu.item); else setContextMenu(null); }}
            disabled={!contextMenu.item || !props.onDeleteContent || props.keyboardLocked}
          >
            Delete
          </ContextMenuItem>
        </ContextMenu>
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
      {renameTarget && createPortal(
        <RenameContentDialog
          node={renameTarget}
          currentChildren={findContentFolder(props.tree, parentContentPath(renameTarget.path))?.children ?? props.tree}
          name={renameName}
          keyboardLocked={props.keyboardLocked}
          onNameChange={setRenameName}
          onConfirm={confirmRename}
          onClose={() => {
            setRenameTarget(null);
            setRenameName("");
          }}
        />,
        document.body,
      )}
      {bookmarkDialog && createPortal(
        <BookmarkNameDialog
          name={bookmarkDialogName}
          existingNames={bookmarks.map((bookmark) => bookmark.name)}
          onNameChange={setBookmarkDialogName}
          onConfirm={confirmNewBookmark}
          onClose={() => {
            setBookmarkDialog(null);
            setBookmarkDialogName("");
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
      {enginePreview && createPortal(
        <ContentPreviewDialog
          path={enginePreview.label}
          value={enginePreview.value}
          loading={false}
          error={undefined}
          onClose={() => setEnginePreview(null)}
        />,
        document.body,
      )}
    </div>
  );
}

// Depth-first flatten of a content subtree into a single list (folders included),
// used for recursive search and global bookmark filters.
function flattenTree(nodes: ContentTreeNode[]): ContentTreeNode[] {
  const out: ContentTreeNode[] = [];
  for (const node of nodes) {
    out.push(node);
    if (node.children?.length) out.push(...flattenTree(node.children));
  }
  return out;
}

function renderFolderTree(
  nodes: ContentTreeNode[],
  selectedFolderPath: string,
  expandedFolders: Set<string>,
  setExpandedFolders: (next: Set<string>) => void,
  setSelectedFolderPath: (path: string) => void,
  onLoadWorld: (name: string) => void,
  onNodeContextMenu: (event: React.MouseEvent, node: ContentTreeNode) => void,
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
            onContextMenu={(event) => onNodeContextMenu(event, node)}
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
            ? renderFolderTree(node.children, selectedFolderPath, expandedFolders, setExpandedFolders, setSelectedFolderPath, onLoadWorld, onNodeContextMenu, depth + 1)
            : null}
        </div>
      );
    });
}
