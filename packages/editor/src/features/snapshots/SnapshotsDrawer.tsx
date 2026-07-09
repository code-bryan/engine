import type { DebuggerSnapshotView } from "../../shell/view-types";

export type SnapshotsDrawerProps = {
  snapshots: DebuggerSnapshotView[];
  onSaveSnapshot: () => void;
  onRestoreSnapshot: (index: number) => void;
};

export function SnapshotsDrawer(props: {
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
