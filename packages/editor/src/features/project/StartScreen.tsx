import { createPortal } from "react-dom";
import { DIALOG_BTN, DIALOG_BTN_PRIMARY } from "../../shell/ui-kit";

export type StartScreenProps = {
  recentProjects: string[];
  onOpen: () => void;
  onCreate: () => void;
  onPickRecent: (path: string) => void;
};

export function StartScreen(props: {
  recentProjects: string[];
  onOpen: () => void;
  onCreate: () => void;
  onPickRecent: (path: string) => void;
}) {
  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#111111] text-xs">
      <div className="w-[460px] max-w-[90vw] flex flex-col bg-[#1e1e1e] border border-[#303030] rounded-lg shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#303030] flex items-center gap-2">
          <i className="ph-fill ph-hexagon text-[#0070e0] text-xl" />
          <span className="text-white font-bold text-sm tracking-wide">NEXUS</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-[#888]">No project open.</div>
          <div className="flex gap-2">
            <button className={DIALOG_BTN_PRIMARY} onClick={props.onOpen}>Open Project…</button>
            <button className={DIALOG_BTN} onClick={props.onCreate}>New Project…</button>
          </div>
          {props.recentProjects.length > 0 && (
            <div className="space-y-1">
              <span className="text-[#888]">Recent</span>
              <div className="max-h-48 overflow-y-auto border border-[#303030] rounded">
                {props.recentProjects.map((recent) => (
                  <button
                    key={recent}
                    className="w-full text-left px-3 py-2 text-[#ccc] hover:bg-[#2d2d2d] hover:text-white transition-colors truncate"
                    title={recent}
                    onClick={() => props.onPickRecent(recent)}
                  >
                    {recent}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
