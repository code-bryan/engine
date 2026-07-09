import { useState } from "react";
import type { DebuggerSystemView } from "../../shell/view-types";

export type SceneSystemsPanelProps = {
  worldName: string;
  systems: DebuggerSystemView[];
  frameMs: string;
  availableSystems: string[];
  onToggleSystem: (index: number) => void;
  onAddSystem: (name: string) => void;
  onRemoveSystem: (name: string) => void;
};

export function SceneSystemsPanel(props: {
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
