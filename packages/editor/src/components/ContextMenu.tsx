import { createPortal } from "react-dom";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

// Reusable right-click menu. Owns the hard parts — viewport-clamped positioning,
// outside-click / Escape dismissal, portalling, and hover flyout submenus — so
// callers just compose <ContextMenuItem>/<ContextMenuSeparator>/<ContextMenuSub>.
// Panels (and their flyouts) are tagged data-context-menu so an outside-click is
// only counted when the pointer lands outside every panel.

const PANEL = "fixed z-[200] bg-[#1e1e1e] border border-[#303030] rounded shadow-2xl py-1 text-xs max-h-[calc(100vh-16px)] overflow-y-auto";
const ITEM = "w-full text-left px-3 py-1.5 flex items-center gap-2 text-[#ccc] hover:bg-[#2d2d2d] hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#ccc]";
const VIEWPORT_PAD = 8;
const DEFAULT_WIDTH = 208;

export type ContextMenuProps = {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
  width?: number;
};

export function ContextMenu({ x, y, onClose, children, width = DEFAULT_WIDTH }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Clamp inside the viewport once the real size is known (item count varies).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = Math.max(VIEWPORT_PAD, Math.min(x, window.innerWidth - rect.width - VIEWPORT_PAD));
    const top = Math.max(VIEWPORT_PAD, Math.min(y, window.innerHeight - rect.height - VIEWPORT_PAD));
    setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-context-menu]")) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className={PANEL}
      data-context-menu
      style={{
        left: `${pos?.left ?? x}px`,
        top: `${pos?.top ?? y}px`,
        width: `${width}px`,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  );
}

export type ContextMenuItemProps = {
  children: ReactNode;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  trailing?: ReactNode;
};

export function ContextMenuItem({ children, onClick, icon, disabled, danger, trailing }: ContextMenuItemProps) {
  return (
    <button className={`${ITEM}${danger ? " text-[#f87171] hover:text-[#f87171]" : ""}`} onClick={onClick} disabled={disabled}>
      {icon}
      {children}
      {trailing}
    </button>
  );
}

export function ContextMenuSeparator() {
  return <div className="h-px my-1 bg-[#303030]" />;
}

export type ContextMenuSubProps = {
  label: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
  width?: number;
};

// A submenu row that opens a flyout panel beside itself on hover (with a short
// close delay to bridge the gap) or click. The flyout is a sibling portal — not
// nested in the scrollable parent — so it is never clipped; it flips to the left
// and clamps vertically near screen edges.
export function ContextMenuSub({ label, children, icon, width = DEFAULT_WIDTH }: ContextMenuSubProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; right: number; top: number } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 160);
  };
  const openFlyout = (event: ReactMouseEvent<HTMLButtonElement>) => {
    cancelClose();
    const rect = event.currentTarget.getBoundingClientRect();
    setAnchor({ left: rect.left, right: rect.right, top: rect.top });
    setOpen(true);
  };

  useEffect(() => () => cancelClose(), []);

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPos(null);
      return;
    }
    const el = flyoutRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 2;
    let left = anchor.right - gap;
    if (left + rect.width > window.innerWidth - VIEWPORT_PAD) left = anchor.left - rect.width + gap;
    left = Math.max(VIEWPORT_PAD, left);
    const top = Math.max(VIEWPORT_PAD, Math.min(anchor.top, window.innerHeight - rect.height - VIEWPORT_PAD));
    setPos({ left, top });
  }, [open, anchor]);

  return (
    <>
      <button
        className={`${ITEM}${open ? " bg-[#2d2d2d] text-white" : ""}`}
        onMouseEnter={openFlyout}
        onMouseLeave={scheduleClose}
        onClick={openFlyout}
      >
        {icon}
        {label}
        <i className="ph ph-caret-right text-[10px] ml-auto" />
      </button>
      {open && createPortal(
        <div
          ref={flyoutRef}
          className={PANEL}
          data-context-menu
          style={{
            left: `${pos?.left ?? anchor?.right ?? 0}px`,
            top: `${pos?.top ?? anchor?.top ?? 0}px`,
            width: `${width}px`,
            visibility: pos ? "visible" : "hidden",
          }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}
