import { createStore } from "@engine/ecs-core";

export type KeyboardState = { keys: Set<string> };
export type PointerState = { x: number; y: number; down: boolean };

export const keyboard = createStore<KeyboardState>();
export const pointer = createStore<PointerState>();

const globalKeyboard: KeyboardState = { keys: new Set() };
const globalPointer: PointerState = { x: 0, y: 0, down: false };

export function createKeyboardInputSys(target: Window = window) {
  target.addEventListener("keydown", (event) => globalKeyboard.keys.add(event.code));
  target.addEventListener("keyup", (event) => globalKeyboard.keys.delete(event.code));
  return () => keyboard.set(0, globalKeyboard);
}

export function createPointerInputSys(target: HTMLElement | Window = window) {
  target.addEventListener("pointermove", (event) => {
    const pointerEvent = event as PointerEvent;
    globalPointer.x = pointerEvent.clientX;
    globalPointer.y = pointerEvent.clientY;
  });
  target.addEventListener("pointerdown", () => { globalPointer.down = true; });
  target.addEventListener("pointerup", () => { globalPointer.down = false; });
  return () => pointer.set(0, globalPointer);
}
