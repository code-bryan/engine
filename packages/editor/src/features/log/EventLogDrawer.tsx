import type { DebuggerLogEntryView } from "../../shell/view-types";

export type EventLogDrawerProps = {
  logs: DebuggerLogEntryView[];
  logFilters: Array<{ cat: string; active: boolean }>;
  logPaused: boolean;
  onToggleLogFilter: (cat: string) => void;
  onToggleLogPause: () => void;
};

export function EventLogDrawer(props: {
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
