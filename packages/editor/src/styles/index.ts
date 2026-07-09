// The editor's UI is styled almost entirely by Tailwind (loaded via CDN in the
// host index.html) plus a small inline <style> there (NEXUS tokens, .engine-input,
// .viewport-grid, .app-shell, .game-frame). Only a handful of ".debugger-*" rules
// are still referenced by the React tree (the fullscreen debug shell, the stage
// container, and the zoom toast); this module injects exactly those. The former
// 2000+ line stylesheet targeted classes the Tailwind rewrite no longer renders
// and has been removed.

const STYLE_ID = "engine-editor-style";

export function ensureEditorStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .app-shell--debug {
      position: fixed !important;
      inset: 0;
      display: block !important;
      padding: 0 !important;
      overflow: hidden;
      background: #141414;
    }
    .app-shell--debug .game-frame {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      border-radius: 0 !important;
      border: none !important;
      box-shadow: none !important;
      aspect-ratio: unset !important;
      z-index: 1;
    }
    .debugger-root {
      position: absolute;
      inset: 0;
      z-index: 10;
      pointer-events: none;
      background: transparent;
    }
    .debugger-stage {
      min-width: 0;
      min-height: 0;
      position: relative;
      background: transparent;
      border: none;
      box-shadow: none;
      overflow: hidden;
    }
    .debugger-zoom-toast {
      position: absolute;
      top: 50%;
      left: 50%;
      z-index: 34;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 96px;
      padding: 10px 14px;
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 999px;
      background: rgba(3, 6, 14, 0.62);
      box-shadow: 0 18px 44px rgba(0, 0, 0, 0.42);
      color: rgba(226, 232, 240, 0.7);
      font-size: 18px;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.03em;
      pointer-events: none;
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.98);
      transition: opacity 180ms ease, transform 180ms ease;
      backdrop-filter: blur(12px);
    }
    .debugger-zoom-toast.is-visible {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  `;
  document.head.appendChild(style);
}
