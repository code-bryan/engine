// Minimal store around the reducer. `dispatch` applies an action and notifies
// subscribers (the render loop); `applySilent` applies without notifying, for
// per-frame telemetry that should not trigger a re-render on its own (the frame
// is painted once, on the frame-end dispatch — matching the original refresh()).

import { reduce } from "./reducer";
import type { DebugState, EditorAction } from "./types";

export type EditorStore = {
  getState: () => DebugState;
  dispatch: (action: EditorAction) => void;
  applySilent: (action: EditorAction) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStore(initial: DebugState): EditorStore {
  let state = initial;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    getState: () => state,
    dispatch(action) {
      state = reduce(state, action);
      notify();
    },
    applySilent(action) {
      state = reduce(state, action);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
