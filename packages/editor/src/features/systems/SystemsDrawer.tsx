import type { DebuggerStatusCardView, DebuggerSystemView } from "../../shell/view-types";
import { RuntimeCard } from "../../components/RuntimeCard";

export type SystemsDrawerProps = {
  statusCards: DebuggerStatusCardView[];
  systems: DebuggerSystemView[];
  onToggleSystem: (index: number) => void;
};

export function SystemsDrawer(props: {
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
