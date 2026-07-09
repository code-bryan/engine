// Editor keyboard shortcuts. The tool-mode mapping is a pure function so it can
// be unit-tested; installKeyboard wires it to the DOM + store dispatch.

import type { EditorToolMode } from "../shared/types";

// Q/W/E/R select the transform tools, matching common DCC/editor conventions.
export function toolModeForKey(key: string): EditorToolMode | null {
  switch (key.toLowerCase()) {
    case "q":
      return "select";
    case "w":
      return "move";
    case "e":
      return "rotate";
    case "r":
      return "scale";
    default:
      return null;
  }
}

export function installKeyboard(opts: {
  isPlaying: () => boolean;
  setTool: (mode: EditorToolMode) => void;
  save: () => void;
}): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    // Save (⌘/Ctrl+S) works everywhere — while playing and inside inputs — and
    // takes over the browser's own save dialog.
    if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      opts.save();
      return;
    }

    if (opts.isPlaying()) return;

    const target = event.target;
    if (
      target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || (target instanceof HTMLElement && target.isContentEditable)
    ) return;

    const mode = toolModeForKey(event.key);
    if (mode === null) return;
    opts.setTool(mode);
    event.preventDefault();
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}
