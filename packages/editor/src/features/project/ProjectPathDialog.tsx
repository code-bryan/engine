import { useState } from "react";
import { createPortal } from "react-dom";
import { DIALOG_BTN, DIALOG_BTN_PRIMARY } from "../../components/ui-kit";

export type ProjectPathDialogProps = {
  mode: "open" | "create";
  recentProjects: string[];
  onBrowse: () => Promise<string | null>;
  onSubmit: (path: string) => void;
  onClose: () => void;
};

export function ProjectPathDialog(props: {
  mode: "open" | "create";
  recentProjects: string[];
  onBrowse: () => Promise<string | null>;
  onSubmit: (path: string) => void;
  onClose: () => void;
}) {
  // For "open" the folder comes from the native OS picker (via onBrowse) or a
  // recent entry — never typed. For "create" the user picks a parent folder and
  // names the new project subfolder.
  const [parent, setParent] = useState("");
  const [name, setName] = useState("");
  const isCreate = props.mode === "create";

  const browse = async () => {
    const picked = await props.onBrowse();
    if (!picked) return;
    if (isCreate) setParent(picked);
    else props.onSubmit(picked);
  };

  const createPath = parent && name.trim() ? `${parent.replace(/\/$/, "")}/${name.trim()}` : "";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm text-xs" role="dialog" aria-modal="true" onClick={props.onClose}>
      <div className="w-[440px] max-w-[90vw] flex flex-col bg-[#1e1e1e] border border-[#303030] rounded-lg shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="h-9 bg-[#252526] flex items-center justify-between px-3 border-b border-[#303030]">
          <span className="text-white font-medium">{isCreate ? "New Project" : "Open Project"}</span>
          <button className="text-[#888] hover:text-white transition-colors" onClick={props.onClose} aria-label="Close dialog">
            <i className="ph ph-x" />
          </button>
        </div>
        <div className="p-3 space-y-3">
          {isCreate ? (
            <>
              <div className="flex items-end gap-2">
                <label className="flex flex-col gap-1 flex-1 min-w-0">
                  <span className="text-[#888]">Location</span>
                  <div className="truncate text-[#ccc] bg-[#111111] border border-[#303030] rounded px-2 py-1" title={parent}>{parent || "Choose a parent folder…"}</div>
                </label>
                <button className={DIALOG_BTN} onClick={browse}><i className="ph ph-folder-open mr-1" />Browse…</button>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[#888]">Project name</span>
                <input
                  className="engine-input px-2 py-1 rounded"
                  autoFocus
                  placeholder="my-project"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && createPath) props.onSubmit(createPath);
                    if (event.key === "Escape") props.onClose();
                  }}
                />
              </label>
            </>
          ) : (
            <button className={`${DIALOG_BTN} w-full justify-center flex items-center py-2`} onClick={browse}>
              <i className="ph ph-folder-open mr-2" />Browse for project folder…
            </button>
          )}
          {props.recentProjects.length > 0 && (
            <div className="space-y-1">
              <span className="text-[#888]">Recent</span>
              <div className="max-h-40 overflow-y-auto border border-[#303030] rounded">
                {props.recentProjects.map((recent) => (
                  <button
                    key={recent}
                    className="w-full text-left px-2 py-1.5 text-[#ccc] hover:bg-[#2d2d2d] hover:text-white transition-colors truncate"
                    title={recent}
                    onClick={() => props.onSubmit(recent)}
                  >
                    {recent}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {isCreate && (
          <div className="flex justify-end gap-2 p-3 border-t border-[#303030]">
            <button className={DIALOG_BTN} onClick={props.onClose}>Cancel</button>
            <button className={DIALOG_BTN_PRIMARY} onClick={() => props.onSubmit(createPath)} disabled={!createPath}>Create</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
