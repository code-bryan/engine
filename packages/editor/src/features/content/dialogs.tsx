import { createPortal } from "react-dom";
import type { ContentTreeNode } from "../../shared/types";
import { DIALOG_BTN, DIALOG_BTN_PRIMARY, DIALOG_BTN_DANGER } from "../../shell/ui-kit";

export type ContentPreviewDialogProps = {
  path: string;
  value: unknown;
  loading: boolean;
  error?: string;
  onClose: () => void;
};

export function ContentPreviewDialog(props: ContentPreviewDialogProps) {
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

export type ContentCreateDialogProps = {
  kind: "folder" | "world" | "component" | "prefab" | "graph";
  basePath: string;
  name: string;
  currentChildren: ContentTreeNode[];
  keyboardLocked: boolean;
  onNameChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function ContentCreateDialog(props: ContentCreateDialogProps) {
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

export type ContentImportDialogProps = {
  basePath: string;
  file: File | null;
  error?: string;
  busy: boolean;
  keyboardLocked: boolean;
  onPickFile: () => void;
  onClose: () => void;
  onImport: () => void;
};

export function ContentImportDialog(props: ContentImportDialogProps) {
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

export type DeleteContentDialogProps = {
  node: ContentTreeNode;
  keyboardLocked: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteContentDialog(props: DeleteContentDialogProps) {
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
