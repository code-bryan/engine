import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { ContentTreeNode } from "../../shared/types";
import { CONTENT_MENU_ITEM } from "../../shell/ui-kit";
import { breadcrumbPaths, findContentFolder, joinContentPath } from "./paths";
import { fetchContentFile } from "./api";
import { contentTypeBarColor, renderContentIcon } from "./icons";
import { ContentCreateDialog, ContentImportDialog, ContentPreviewDialog, DeleteContentDialog } from "./dialogs";

export type ContentBrowserProps = {
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
