// Stacking toast notifications (newest at the bottom). Markup matches the design
// mockup verbatim. Each toast animates in, auto-hides ~2.5s after it was last
// shown (a coalesced refresh bumps `version`, resetting the timer without a
// remount), then animates out before the store drops it.

import { useEffect, useState } from "react";
import type { EditorToast, EditorToastKind } from "../state/types";

const VISIBLE_MS = 2500;
const EXIT_MS = 300;

function iconClass(kind: EditorToastKind): string {
  switch (kind) {
    case "error":
      return "ph-x-circle text-[#f87171]";
    case "info":
      return "ph-info text-[#60a5fa]";
    case "success":
      return "ph-check-circle text-[#4ade80]";
  }
}

function ToastItem(props: { toast: EditorToast; onDismiss: (id: number) => void }) {
  const { toast, onDismiss } = props;
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const enter = requestAnimationFrame(() => setShown(true));
    const hide = window.setTimeout(() => setShown(false), VISIBLE_MS);
    const remove = window.setTimeout(() => onDismiss(toast.id), VISIBLE_MS + EXIT_MS);
    return () => {
      cancelAnimationFrame(enter);
      window.clearTimeout(hide);
      window.clearTimeout(remove);
    };
    // Re-run when a coalesced toast is refreshed (version bump) to reset the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id, toast.version]);

  return (
    <div
      className={`transform transition-all duration-300 ${shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"} flex items-center gap-3 px-4 py-3 bg-[#1e1e1e]/95 backdrop-blur border border-[#303030] rounded-md shadow-2xl text-white pointer-events-auto min-w-[250px]`}
      role="status"
      aria-live="polite"
    >
      <i className={`ph-fill ${iconClass(toast.kind)} text-xl flex-shrink-0`} />
      <div className="flex flex-col">
        <span className="text-[12px] font-bold tracking-wide">{toast.title}</span>
        {toast.description ? <span className="text-[10px] text-[#888] mt-0.5">{toast.description}</span> : null}
      </div>
    </div>
  );
}

export function Toasts(props: { toasts: EditorToast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {props.toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={props.onDismiss} />
      ))}
    </div>
  );
}
