const STYLE_ID = "engine-runtime-debugger-style";

export function ensureDebuggerStyles() {
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
    }
    .debugger-viewport-hud {
      position: absolute;
      top: 76px;
      left: 290px;
      z-index: 4;
      pointer-events: none;
      display: flex;
      gap: 12px;
      padding: 4px 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      background: rgba(5, 5, 5, 0.8);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
      backdrop-filter: blur(10px);
      color: #e4e4e7;
      font: 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .debugger-viewport-hud__item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .debugger-viewport-hud__label {
      color: #71717a;
    }
    .debugger-viewport-hud__value {
      font-weight: 700;
    }
    .debugger-viewport-hud__value--fps {
      color: #4ade80;
    }
    .debugger-viewport-hud__value--ms {
      color: #facc15;
    }
    .debugger-layout {
      position: absolute;
      inset: 0;
      z-index: 10;
      display: grid;
      grid-template-columns: 270px 1fr 290px;
      grid-template-rows: 56px minmax(0, 1fr) minmax(300px, 38vh);
      grid-template-areas:
        "top top top"
        "left . right"
        "left bottom right";
      gap: 10px;
      padding: 10px;
      box-sizing: border-box;
      pointer-events: none;
    }
    .debugger-toolbar {
      grid-area: top;
      pointer-events: auto;
      position: relative;
      z-index: 20;
      min-height: 0;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      box-sizing: border-box;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      background: rgba(10, 10, 12, 0.94);
      box-shadow: 0 24px 72px rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(18px);
      color: #e4e4e7;
      font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .debugger-toolbar__left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .debugger-toolbar__playback {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      background: #18181b;
    }
    .debugger-toolbar__playback button {
      width: 34px;
      height: 28px;
      border: 1px solid transparent;
      border-radius: 9px;
      background: transparent;
      color: #a1a1aa;
      cursor: pointer;
      font: 13px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
      display: grid;
      place-items: center;
    }
    .debugger-toolbar button svg {
      display: block;
    }
    .debugger-toolbar__playback button:hover {
      background: rgba(255, 255, 255, 0.07);
      color: #e4e4e7;
    }
    .debugger-toolbar__playback button.is-active {
      border-color: rgba(96, 165, 250, 0.4);
      background: rgba(37, 99, 235, 0.22);
      color: #bfdbfe;
    }
    .debugger-tool-group {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      background: #18181b;
    }
    .debugger-tool-group button {
      height: 28px;
      width: 30px;
      padding: 0;
      border: 1px solid transparent;
      border-radius: 9px;
      background: transparent;
      color: #a1a1aa;
      cursor: pointer;
      font: 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: 0.02em;
      display: grid;
      place-items: center;
    }
    .debugger-tool-group button:hover {
      background: rgba(255, 255, 255, 0.07);
      color: #e4e4e7;
    }
    .debugger-tool-group button.is-active {
      border-color: rgba(96, 165, 250, 0.4);
      background: rgba(37, 99, 235, 0.22);
      color: #bfdbfe;
    }
    .debugger-toolbar__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
    }
    .debugger-panel {
      pointer-events: auto;
      position: relative;
      z-index: 1;
      min-height: 0;
      display: grid;
      gap: 10px;
      padding: 12px;
      box-sizing: border-box;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      background: rgba(10, 10, 12, 0.94);
      box-shadow: 0 24px 72px rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(18px);
      color: #e4e4e7;
      font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .debugger-panel--left {
      grid-area: left;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .debugger-panel--right {
      grid-area: right;
      grid-template-rows: minmax(220px, 42%) minmax(0, 1fr);
    }
    .debugger-panel--bottom {
      grid-area: bottom;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
      min-height: 0;
    }
    .debugger-panel--bottom--content-open {
      grid-template-columns: minmax(0, 1fr) minmax(320px, 380px);
      gap: 10px;
    }
    .debugger-title {
      font-size: 13px;
      font-weight: 700;
      color: #fafafa;
    }
    .debugger-subtitle {
      color: #a1a1aa;
    }
    .debugger-badge {
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.18);
      color: #93c5fd;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.06em;
    }
    .debugger-controls {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 8px;
    }
    .debugger-controls--header {
      grid-template-columns: repeat(10, 32px);
      gap: 6px;
    }
    .debugger-controls button {
      height: 32px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      background: #18181b;
      color: inherit;
      cursor: pointer;
      font: inherit;
    }
    .debugger-controls--header button {
      width: 32px;
      padding: 0;
      font-size: 13px;
      display: grid;
      place-items: center;
    }
    .debugger-controls button:hover {
      background: #27272a;
    }
    .debugger-controls button.is-active {
      border-color: rgba(96, 165, 250, 0.45);
      background: rgba(37, 99, 235, 0.24);
      color: #bfdbfe;
    }
    .debugger-dropdown {
      position: relative;
    }
    .debugger-dropdown__trigger {
      height: 32px;
      padding: 0 12px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      background: #18181b;
      color: #e4e4e7;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .debugger-dropdown__trigger:hover {
      background: #27272a;
    }
    .debugger-dropdown.is-open .debugger-dropdown__trigger {
      border-color: rgba(96, 165, 250, 0.4);
      background: rgba(37, 99, 235, 0.18);
      color: #bfdbfe;
    }
    .debugger-dropdown__panel {
      display: none;
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      min-width: 180px;
      padding: 5px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      background: rgba(10, 10, 12, 0.98);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(20px);
      z-index: 100;
    }
    .debugger-dropdown.is-open .debugger-dropdown__panel {
      display: grid;
      gap: 1px;
    }
    .debugger-dropdown__item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      height: 32px;
      padding: 0 8px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      color: #a1a1aa;
      cursor: pointer;
      font: inherit;
      text-align: left;
      box-sizing: border-box;
    }
    .debugger-dropdown__item:hover {
      background: rgba(255, 255, 255, 0.06);
      color: #e4e4e7;
    }
    .debugger-dropdown__item.is-active {
      border-color: rgba(96, 165, 250, 0.3);
      background: rgba(37, 99, 235, 0.18);
      color: #bfdbfe;
    }
    .debugger-dropdown__item-icon {
      width: 18px;
      text-align: center;
      font-size: 13px;
      flex-shrink: 0;
      opacity: 0.6;
    }
    .debugger-dropdown__item.is-active .debugger-dropdown__item-icon {
      opacity: 1;
    }
    .debugger-dropdown__divider {
      height: 1px;
      margin: 3px 4px;
      background: rgba(255, 255, 255, 0.08);
    }
    .debugger-section {
      min-height: 0;
      padding: 10px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      background: rgba(24, 24, 27, 0.8);
      overflow: hidden;
    }
    .debugger-section--grow {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      flex: 1;
      min-height: 0;
    }
    .debugger-section--content {
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      gap: 10px;
      min-height: 0;
    }
    .debugger-section--entities {
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      min-height: 0;
    }
    .debugger-section--inspector {
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      min-height: 0;
    }
    .debugger-section__title {
      margin-bottom: 8px;
      color: #f4f4f5;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.08em;
    }
    .debugger-kv {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      color: #a1a1aa;
    }
    .debugger-kv strong {
      color: #fafafa;
    }
    .debugger-input {
      width: 100%;
      height: 30px;
      margin-bottom: 8px;
      padding: 0 8px;
      box-sizing: border-box;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      background: #09090b;
      color: inherit;
      font: inherit;
    }
    .debugger-entity-list,
    .debugger-systems,
    .debugger-inspector {
      display: grid;
      align-content: start;
      gap: 6px;
      min-height: 0;
      overflow: auto;
    }
    .debugger-content-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .debugger-content-breadcrumbs {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .debugger-content-breadcrumb {
      height: 20px;
      padding: 0 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.03);
      color: #a1a1aa;
      cursor: pointer;
      font: 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .debugger-content-breadcrumb.is-active {
      background: rgba(37, 99, 235, 0.16);
      color: #bfdbfe;
    }
    .debugger-content-actions {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }
    .debugger-content-action {
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: #18181b;
      color: #a1a1aa;
      cursor: pointer;
      display: grid;
      place-items: center;
    }
    .debugger-content-action:hover {
      background: #27272a;
      color: #e4e4e7;
    }
    .debugger-content-search {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      background: #09090b;
    }
    .debugger-content-search svg {
      flex-shrink: 0;
      color: #52525b;
    }
    .debugger-content-search__input {
      margin-bottom: 0;
      padding-left: 0;
      border: none;
      background: transparent;
      outline: none;
    }
    .debugger-content-systems-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .debugger-content-systems {
      display: grid;
      gap: 6px;
      align-content: start;
      min-height: 0;
      max-height: 180px;
      overflow: auto;
    }
    .debugger-content-system-row {
      display: flex;
      gap: 6px;
      align-items: stretch;
    }
    .debugger-content-system {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid rgba(96, 165, 250, 0.16);
      border-radius: 10px;
      background: rgba(9, 9, 11, 0.95);
      color: #d4d4d8;
      cursor: pointer;
      text-align: left;
      font: inherit;
    }
    .debugger-content-system:hover {
      background: #18181b;
    }
    .debugger-content-system.is-active {
      border-color: rgba(96, 165, 250, 0.4);
      background: rgba(37, 99, 235, 0.18);
      color: #bfdbfe;
    }
    .debugger-content-system__name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .debugger-content-system__toggle {
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: #18181b;
      color: #a1a1aa;
      cursor: pointer;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .debugger-content-system__toggle:hover {
      background: #27272a;
      color: #e4e4e7;
    }
    .debugger-content-create {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
    }
    .debugger-content-create__input {
      margin-bottom: 0;
    }
    .debugger-content-create__actions {
      display: flex;
      gap: 4px;
    }
    .debugger-content-create__btn {
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: #18181b;
      color: #a1a1aa;
      cursor: pointer;
      display: grid;
      place-items: center;
    }
    .debugger-content-create__btn:hover {
      background: #27272a;
      color: #e4e4e7;
    }
    .debugger-content-create__btn--confirm:not(:disabled) {
      border-color: rgba(74, 222, 128, 0.3);
      color: #4ade80;
    }
    .debugger-content-create__btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .debugger-content-create__error {
      color: #f87171;
      font-size: 10px;
    }
    .debugger-content-body {
      display: grid;
      grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
      gap: 10px;
      min-height: 0;
    }
    .debugger-content-tree,
    .debugger-content-browser {
      min-height: 0;
      overflow: auto;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      background: rgba(24, 24, 27, 0.65);
    }
    .debugger-content-tree {
      padding: 6px;
    }
    .debugger-content-browser {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      padding: 8px;
      gap: 8px;
    }
    .debugger-content-browser__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .debugger-content-browser__hint {
      color: #71717a;
      font-size: 10px;
    }
    .debugger-content-list {
      display: grid;
      gap: 6px;
      align-content: start;
      min-height: 0;
      overflow: auto;
    }
    .debugger-content-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: #09090b;
      color: #d4d4d8;
      cursor: pointer;
      text-align: left;
    }
    .debugger-content-item:hover {
      background: #18181b;
    }
    .debugger-content-item.is-active {
      border-color: rgba(96, 165, 250, 0.4);
      background: rgba(37, 99, 235, 0.18);
      color: #bfdbfe;
    }
    .debugger-content-item__action {
      height: 22px;
      padding: 0 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      color: #d4d4d8;
      cursor: pointer;
      font: 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .debugger-content-item__action:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .debugger-content-item__action.is-active {
      border-color: rgba(74, 222, 128, 0.3);
      color: #4ade80;
    }
    .debugger-content-item__icon {
      color: #93c5fd;
    }
    .debugger-content-item__name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .debugger-content-item__path {
      color: #71717a;
      font-size: 10px;
      white-space: nowrap;
    }
    .debugger-content-tree__node {
      display: grid;
    }
    .debugger-content-tree__row {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 6px;
      width: 100%;
      padding: 6px 8px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      color: #a1a1aa;
      cursor: pointer;
      text-align: left;
      font: inherit;
    }
    .debugger-content-tree__row:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #e4e4e7;
    }
    .debugger-content-tree__row.is-selected {
      border-color: rgba(96, 165, 250, 0.3);
      background: rgba(37, 99, 235, 0.16);
      color: #bfdbfe;
    }
    .debugger-content-tree__toggle {
      width: 12px;
      height: 12px;
      display: grid;
      place-items: center;
      color: #71717a;
    }
    .debugger-content-tree__spacer {
      width: 12px;
      height: 12px;
    }
    .debugger-content-tree__icon {
      color: #93c5fd;
    }
    .debugger-content-tree__name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .debugger-graph-dialog {
      position: fixed;
      inset: 0;
      z-index: 40;
      display: grid;
      place-items: center;
      padding: 16px;
      background: rgba(9, 9, 11, 0.72);
      backdrop-filter: blur(10px);
    }
    .debugger-graph-dialog__panel {
      width: min(1600px, calc(100vw - 32px));
      height: min(980px, calc(100vh - 32px));
      display: grid;
      grid-template-rows: auto auto auto minmax(0, 1fr);
      gap: 10px;
      padding: 14px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      background: #09090b;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
    }
    .debugger-graph-dialog__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .debugger-graph-dialog__subtitle {
      color: #a1a1aa;
      font-size: 11px;
    }
    .debugger-graph-zoom-controls {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      background: rgba(24, 24, 27, 0.65);
    }
    .debugger-graph-zoom-controls .debugger-content-action {
      width: 26px;
      height: 26px;
      padding: 0;
      display: grid;
      place-items: center;
    }
    .debugger-graph-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      color: #a1a1aa;
      font-size: 11px;
    }
    .debugger-graph-meta strong {
      color: #f4f4f5;
    }
    .debugger-graph-description {
      color: #d4d4d8;
      font-size: 12px;
    }
    .debugger-graph-side-title {
      color: #f4f4f5;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    .debugger-graph-variable {
      display: grid;
      gap: 6px;
      padding: 10px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      background: rgba(24, 24, 27, 0.75);
    }
    .debugger-graph-canvas__scroll {
      min-height: 0;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      background: linear-gradient(180deg, rgba(24, 24, 27, 0.92), rgba(9, 9, 11, 0.98));
      display: flex;
    }
    .debugger-graph-canvas__viewport {
      position: relative;
      flex: 1;
      min-height: 0;
      overflow: hidden;
      touch-action: none;
      cursor: grab;
    }
    .debugger-graph-canvas__viewport:active {
      cursor: grabbing;
    }
    .debugger-graph-canvas {
      position: relative;
      overflow: hidden;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
      background-size: 28px 28px;
      transform-origin: top left;
    }
    .debugger-graph-canvas__edges {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .debugger-graph-canvas__edges path {
      fill: none;
      stroke: rgba(96, 165, 250, 0.35);
      stroke-width: 2;
      stroke-linecap: round;
      pointer-events: stroke;
      cursor: pointer;
    }
    .debugger-graph-canvas__edges path.is-selected {
      stroke: rgba(250, 204, 21, 0.92);
      stroke-width: 4;
    }
    .debugger-graph-canvas__edges circle {
      filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.45));
    }
    .debugger-graph-edge-label {
      fill: #e0f2fe;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      paint-order: stroke;
      stroke: rgba(8, 15, 32, 0.92);
      stroke-width: 3px;
      stroke-linejoin: round;
      pointer-events: none;
    }
    .debugger-graph-edge-label--to {
      fill: #d9f99d;
    }
    .debugger-graph-node {
      position: absolute;
      width: 246px;
      min-height: 176px;
      padding: 10px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      background: rgba(17, 17, 20, 0.96);
      color: #d4d4d8;
      box-shadow: 0 14px 30px rgba(0, 0, 0, 0.24);
    }
    .debugger-graph-node.is-entrypoint {
      border-color: rgba(96, 165, 250, 0.55);
      box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.18), 0 14px 30px rgba(0, 0, 0, 0.24);
    }
    .debugger-graph-node.is-selected {
      outline: 2px solid rgba(56, 189, 248, 0.3);
      outline-offset: 1px;
    }
    .debugger-graph-node__title-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .debugger-graph-node__title {
      color: #f4f4f5;
      font-size: 12px;
      font-weight: 700;
      cursor: grab;
      user-select: none;
      touch-action: none;
    }
    .debugger-graph-node__title:active {
      cursor: grabbing;
    }
    .debugger-graph-node__type {
      margin-top: 2px;
      color: #93c5fd;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .debugger-graph-node__delete {
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border: 1px solid rgba(248, 113, 113, 0.2);
      border-radius: 8px;
      background: rgba(127, 29, 29, 0.25);
      color: #fecaca;
      cursor: pointer;
      flex: 0 0 auto;
    }
    .debugger-graph-node__delete:hover {
      background: rgba(153, 27, 27, 0.45);
      border-color: rgba(248, 113, 113, 0.35);
      color: #fff1f2;
    }
    .debugger-graph-node__ports {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 10px;
    }
    .debugger-graph-node__flow-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 8px;
      align-items: center;
    }
    .debugger-graph-node__flow-slot {
      display: flex;
      min-height: 18px;
      align-items: center;
    }
    .debugger-graph-node__flow-slot--input {
      justify-content: flex-start;
    }
    .debugger-graph-node__flow-slot--output {
      justify-content: flex-end;
    }
    .debugger-graph-node__ports-col {
      display: grid;
      gap: 6px;
      align-content: start;
    }
    .debugger-graph-node__ports-col--right {
      justify-items: end;
    }
    .debugger-graph-port {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10px;
      line-height: 1.2;
      white-space: nowrap;
    }
    .debugger-graph-port::before {
      display: none;
    }
    .debugger-graph-port--input {
      background: rgba(15, 23, 42, 0.88);
      color: #bfdbfe;
    }
    .debugger-graph-port--output {
      background: rgba(20, 83, 45, 0.42);
      color: #bbf7d0;
    }
    .debugger-graph-port__anchor {
      width: 11px;
      height: 11px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      background: currentColor;
      color: #0f172a;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.18) inset;
    }
    .debugger-graph-port--flow {
      padding-top: 1px;
      padding-bottom: 1px;
    }
    .debugger-graph-port__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 8px;
      height: 8px;
      color: #f8fafc;
    }
    .debugger-graph-port__icon svg {
      display: block;
    }
    .debugger-graph-port__label {
      display: inline-flex;
      align-items: center;
    }
    .debugger-graph-connection-list {
      display: grid;
      gap: 8px;
      max-height: 340px;
      overflow: auto;
      padding-right: 2px;
    }
    .debugger-graph-connection {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      width: 100%;
      padding: 8px 10px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      background: rgba(24, 24, 27, 0.72);
      color: #e4e4e7;
      cursor: pointer;
      text-align: left;
    }
    .debugger-graph-connection.is-selected {
      border-color: rgba(250, 204, 21, 0.4);
      background: rgba(161, 98, 7, 0.22);
    }
    .debugger-graph-connection__flow {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      color: #cbd5e1;
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .debugger-graph-connection__flow strong {
      color: #f8fafc;
    }
    .debugger-graph-connection__actions {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }
    .debugger-graph-connection__delete {
      display: grid;
      place-items: center;
      width: 20px;
      height: 20px;
      border-radius: 7px;
      color: #fecaca;
      background: rgba(127, 29, 29, 0.22);
      border: 1px solid rgba(248, 113, 113, 0.16);
    }
    .debugger-graph-connection__delete:hover {
      background: rgba(153, 27, 27, 0.42);
      color: #fff1f2;
    }
    .debugger-graph-node__data {
      display: grid;
      gap: 4px;
      margin-top: 8px;
      font-size: 11px;
    }
    .debugger-graph-node__row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      color: #a1a1aa;
    }
    .debugger-graph-node__row strong {
      color: #fafafa;
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .debugger-sidepanels {
      display: grid;
      gap: 10px;
      align-content: start;
    }
    .debugger-entity {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: #09090b;
      cursor: pointer;
    }
    .debugger-entity.is-selected {
      border-color: rgba(96, 165, 250, 0.8);
      background: rgba(30, 41, 59, 0.9);
      box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.35);
    }
    .debugger-pill {
      color: #93c5fd;
      font-size: 10px;
    }
    .debugger-card {
      padding: 8px;
      border-radius: 10px;
      background: #09090b;
    }
    .debugger-card--collapsed .debugger-card__header {
      margin-bottom: 0;
    }
    .debugger-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .debugger-card__title {
      color: #fafafa;
      font-weight: 700;
    }
    .debugger-card__collapse {
      width: 18px;
      height: 18px;
      padding: 0;
      border: none;
      background: transparent;
      color: #52525b;
      cursor: pointer;
      font: inherit;
      font-size: 10px;
      line-height: 1;
      flex-shrink: 0;
    }
    .debugger-card__collapse:hover { color: #a1a1aa; }
    .debugger-field {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      color: #a1a1aa;
    }
    .debugger-field--editable {
      cursor: text;
      border-left: 2px solid rgba(96, 165, 250, 0.35);
      padding-left: 4px;
    }
    .debugger-field strong {
      color: #fafafa;
      text-align: right;
    }
    .debugger-field__input {
      width: 88px;
      height: 24px;
      padding: 0 6px;
      box-sizing: border-box;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      background: #111114;
      color: #fafafa;
      text-align: right;
      font: inherit;
    }
    .debugger-field__links {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 6px;
    }
    .debugger-field__link {
      height: 22px;
      padding: 0 6px;
      border: 1px solid rgba(96, 165, 250, 0.28);
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.16);
      color: #bfdbfe;
      cursor: pointer;
      font: inherit;
    }
    .debugger-field__link:hover {
      background: rgba(37, 99, 235, 0.28);
    }
    .debugger-system__toggle {
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      padding: 0;
      border: none;
      border-radius: 3px;
      background: transparent;
      color: #4ade80;
      cursor: pointer;
      font: inherit;
      font-size: 10px;
      line-height: 1;
    }
    .debugger-system--disabled .debugger-system__toggle {
      color: #52525b;
    }
    .debugger-system__label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .debugger-system--disabled .debugger-system__label,
    .debugger-system--disabled strong {
      color: #52525b;
    }
    .debugger-log-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .debugger-log-header .debugger-section__title {
      margin-bottom: 0;
    }
    .debugger-log-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .debugger-log-chip {
      height: 18px;
      padding: 0 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 999px;
      background: transparent;
      color: #71717a;
      cursor: pointer;
      font: 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .debugger-log-chip.is-active {
      background: rgba(255, 255, 255, 0.08);
      color: #d4d4d8;
    }
    .debugger-log-chip--pause.is-active {
      background: rgba(251, 191, 36, 0.15);
      border-color: rgba(251, 191, 36, 0.3);
      color: #fbbf24;
    }
    .debugger-log {
      margin: 0;
      min-height: 0;
      overflow: auto;
      color: #d4d4d8;
      font-size: 11px;
      line-height: 1.4;
    }
    .debugger-log__entry {
      padding: 1px 0;
      border-left: 2px solid transparent;
      padding-left: 5px;
      white-space: pre-wrap;
    }
    .debugger-log__entry--entity  { border-color: #60a5fa; }
    .debugger-log__entry--tag     { border-color: #a78bfa; }
    .debugger-log__entry--system  { border-color: #facc15; }
    .debugger-log__entry--physics { border-color: #fb923c; }
    .debugger-log__entry--collision { border-color: #f87171; }
    .debugger-log__entry--store   { border-color: #4ade80; }
    .debugger-log__empty {
      color: #52525b;
      font-size: 11px;
    }
    .debugger-log__count {
      margin-left: 6px;
      padding: 0 5px;
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      color: #71717a;
      font-size: 10px;
      font-variant-numeric: tabular-nums;
    }
    .debugger-system__timing {
      font-size: 10px;
      color: #a1a1aa;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .debugger-snapshot-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .debugger-snapshot-save {
      height: 22px;
      padding: 0 8px;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 6px;
      background: #18181b;
      color: #d4d4d8;
      cursor: pointer;
      font: inherit;
    }
    .debugger-snapshot-save:hover { background: #27272a; }
    .debugger-snapshot-list {
      display: grid;
      gap: 4px;
    }
    .debugger-snapshot-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 4px 6px;
      border-radius: 6px;
      background: #09090b;
      font-size: 11px;
      color: #a1a1aa;
    }
    .debugger-snapshot-row__label { color: #d4d4d8; }
    .debugger-snapshot-restore {
      height: 20px;
      padding: 0 6px;
      border: 1px solid rgba(96,165,250,0.28);
      border-radius: 999px;
      background: rgba(37,99,235,0.16);
      color: #bfdbfe;
      cursor: pointer;
      font: 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .debugger-snapshot-restore:hover { background: rgba(37,99,235,0.28); }
    .debugger-zoom-group {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 3px 5px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      background: #18181b;
    }
    .debugger-zoom-group button {
      height: 24px;
      min-width: 24px;
      padding: 0 5px;
      border: none;
      border-radius: 7px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      line-height: 1;
    }
    .debugger-zoom-group button:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    .debugger-zoom-group button.is-active {
      border-color: rgba(96, 165, 250, 0.4);
      background: rgba(37, 99, 235, 0.22);
      color: #bfdbfe;
    }
    .debugger-zoom-value {
      min-width: 44px;
      text-align: center;
      font-size: 11px !important;
      font-variant-numeric: tabular-nums;
      color: #a1a1aa !important;
      letter-spacing: 0.02em;
    }
    .debugger-zoom-value:hover {
      color: #e4e4e7 !important;
    }
    .debugger-zoom-sep {
      width: 1px;
      height: 16px;
      background: rgba(255, 255, 255, 0.12);
      margin: 0 2px;
      flex-shrink: 0;
    }
    .debugger-zoom-tuning-wrap {
      position: relative;
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }
    .debugger-zoom-tuning-toggle {
      height: 28px;
      width: 30px;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 9px;
      background: #18181b;
      color: #a1a1aa;
      cursor: pointer;
      display: grid;
      place-items: center;
    }
    .debugger-zoom-tuning-toggle:hover {
      background: rgba(255, 255, 255, 0.07);
      color: #e4e4e7;
    }
    .debugger-zoom-tuning-toggle.is-active {
      border-color: rgba(96, 165, 250, 0.4);
      background: rgba(37, 99, 235, 0.22);
      color: #bfdbfe;
    }
    .debugger-zoom-tuning {
      position: absolute;
      right: 0;
      top: calc(100% + 8px);
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 200px;
      padding: 6px 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      background: #18181b;
      box-shadow: 0 18px 36px rgba(0, 0, 0, 0.32);
      color: #a1a1aa;
      font-size: 11px;
      line-height: 1;
      z-index: 30;
    }
    .debugger-zoom-tuning__label {
      flex-shrink: 0;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: #60a5fa;
    }
    .debugger-zoom-tuning__slider {
      flex: 1;
      min-width: 84px;
      accent-color: #60a5fa;
    }
    .debugger-zoom-tuning__value {
      flex-shrink: 0;
      width: 40px;
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: #e4e4e7;
    }
    .debugger-section--worlds {
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .debugger-worlds-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .debugger-worlds-new {
      width: 20px;
      height: 20px;
      padding: 0;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 6px;
      background: #18181b;
      color: #a1a1aa;
      cursor: pointer;
      font: 14px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
      display: grid;
      place-items: center;
    }
    .debugger-worlds-new:hover { background: #27272a; color: #e4e4e7; }
    .debugger-worlds-list {
      display: grid;
      align-content: start;
      gap: 3px;
      max-height: 120px;
      overflow: auto;
    }
    .debugger-world-item {
      display: flex;
      align-items: center;
      padding: 6px 8px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: #09090b;
      color: #a1a1aa;
      cursor: pointer;
      font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
      text-align: left;
    }
    .debugger-world-item:hover { background: #18181b; color: #e4e4e7; }
    .debugger-world-item.is-active {
      border-color: rgba(96, 165, 250, 0.4);
      background: rgba(37, 99, 235, 0.18);
      color: #bfdbfe;
    }
    .debugger-worlds-create {
      display: grid;
      gap: 4px;
    }
    .debugger-worlds-create__input {
      margin-bottom: 0 !important;
    }
    .debugger-worlds-create__actions {
      display: flex;
      gap: 4px;
    }
    .debugger-worlds-create__btn {
      flex: 1;
      height: 24px;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      background: #18181b;
      color: #a1a1aa;
      cursor: pointer;
      display: grid;
      place-items: center;
    }
    .debugger-worlds-create__btn:hover { background: #27272a; color: #e4e4e7; }
    .debugger-worlds-create__btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .debugger-worlds-create__btn--confirm:not(:disabled) { border-color: rgba(74,222,128,0.3); color: #4ade80; }
    .debugger-worlds-create__btn--cancel:not(:disabled):hover { border-color: rgba(248,113,113,0.3); color: #f87171; }
    .debugger-worlds-create__error {
      font-size: 10px;
      color: #f87171;
    }
    .app-shell--debug {
      background:
        radial-gradient(circle at top, rgba(59, 130, 246, 0.10), transparent 32%),
        linear-gradient(180deg, #0a0d12 0%, #090b10 100%);
    }
    .debugger-root {
      background:
        linear-gradient(180deg, rgba(15, 23, 42, 0.16), rgba(15, 23, 42, 0.04)),
        radial-gradient(circle at 20% 0%, rgba(96, 165, 250, 0.08), transparent 30%);
    }
    .debugger-viewport-hud {
      top: 84px;
      left: 22px;
      border-radius: 999px;
      background: rgba(3, 6, 14, 0.74);
      border-color: rgba(148, 163, 184, 0.18);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
    }
    .debugger-layout {
      grid-template-columns: minmax(0, 1fr) 372px;
      grid-template-rows: 72px minmax(0, 1fr);
      grid-template-areas:
        "top top"
        "stage right";
      gap: 12px;
      padding: 12px;
    }
    .debugger-layout--playing .debugger-toolbar {
      border-color: rgba(96, 165, 250, 0.22);
    }
    .debugger-stage {
      grid-area: stage;
      min-width: 0;
      min-height: 0;
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 22px;
      background:
        linear-gradient(180deg, rgba(15, 23, 42, 0.18), rgba(2, 6, 23, 0.04)),
        radial-gradient(circle at top left, rgba(96, 165, 250, 0.06), transparent 26%);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        0 30px 60px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      position: relative;
    }
    .debugger-stage::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 40px 40px;
      opacity: 0.16;
      pointer-events: none;
      mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.5), transparent 92%);
    }
    .debugger-toolbar {
      grid-template-columns: minmax(180px, 240px) minmax(0, 1fr) auto auto;
      gap: 14px;
      padding: 12px 16px;
      border-radius: 20px;
      border-color: rgba(148, 163, 184, 0.14);
      background: linear-gradient(180deg, rgba(15, 18, 28, 0.96), rgba(9, 11, 17, 0.92));
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.04),
        0 20px 50px rgba(0, 0, 0, 0.4);
    }
    .debugger-toolbar__brand {
      display: grid;
      gap: 2px;
      align-content: center;
      min-width: 0;
    }
    .debugger-toolbar__eyebrow {
      color: #7c8aa5;
      font-size: 10px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .debugger-toolbar__title {
      color: #f8fafc;
      font-size: 14px;
      line-height: 1.1;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .debugger-toolbar__status {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      color: #94a3b8;
      font-size: 11px;
    }
    .debugger-toolbar__status span {
      padding: 3px 8px;
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.02);
    }
    .debugger-toolbar__left {
      flex-wrap: wrap;
    }
    .debugger-panel--right {
      grid-area: right;
      grid-template-rows: minmax(0, 1fr);
      align-content: start;
      background: linear-gradient(180deg, rgba(13, 17, 24, 0.95), rgba(8, 11, 16, 0.92));
      border-color: rgba(148, 163, 184, 0.14);
    }
    .debugger-panel--right > * {
      min-height: 0;
    }
    .debugger-section--debug {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      gap: 10px;
      min-height: 0;
    }
    .debugger-drawer {
      position: absolute;
      left: 12px;
      right: 12px;
      bottom: 12px;
      height: min(48vh, 560px);
      z-index: 40;
      display: grid;
      grid-template-rows: 54px minmax(0, 1fr);
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 22px 22px 18px 18px;
      background: linear-gradient(180deg, rgba(10, 13, 20, 0.97), rgba(6, 8, 13, 0.96));
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.04),
        0 30px 80px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(24px);
      transform: translateY(calc(100% - 54px));
      transition: transform 180ms ease;
      overflow: hidden;
      pointer-events: auto;
    }
    .debugger-drawer.is-open {
      transform: translateY(0);
    }
    .debugger-drawer__chrome {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
      background: linear-gradient(180deg, rgba(17, 24, 39, 0.96), rgba(10, 13, 20, 0.96));
    }
    .debugger-drawer__toggle {
      height: 32px;
      padding: 0 12px;
      border: 1px solid rgba(96, 165, 250, 0.18);
      border-radius: 10px;
      background: rgba(37, 99, 235, 0.12);
      color: #dbeafe;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
    }
    .debugger-drawer__toggle:hover {
      background: rgba(37, 99, 235, 0.2);
    }
    .debugger-drawer__tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .debugger-drawer__tab {
      height: 30px;
      padding: 0 12px;
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.02);
      color: #94a3b8;
      cursor: pointer;
      font: inherit;
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .debugger-drawer__tab:hover {
      color: #e2e8f0;
      border-color: rgba(148, 163, 184, 0.2);
    }
    .debugger-drawer__tab.is-active {
      border-color: rgba(96, 165, 250, 0.26);
      background: rgba(37, 99, 235, 0.16);
      color: #bfdbfe;
    }
    .debugger-drawer__body {
      min-height: 0;
      padding: 12px;
      overflow: auto;
    }
    .debugger-drawer-panel {
      min-height: 100%;
    }
    .debugger-drawer-panel--systems {
      display: grid;
      min-height: 100%;
    }
    .debugger-drawer-panel__grid {
      display: grid;
      grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
      gap: 12px;
      min-height: 100%;
    }
    .debugger-drawer-panel--snapshots,
    .debugger-drawer-panel--log {
      display: grid;
      align-content: start;
      gap: 10px;
    }
    .debugger-drawer-panel--log {
      grid-template-rows: auto minmax(0, 1fr);
      min-height: 100%;
    }
    .debugger-drawer-panel--log .debugger-log {
      min-height: 0;
    }
    .debugger-drawer-panel--snapshots .debugger-snapshot-list {
      max-width: 640px;
    }
    .debugger-drawer-panel--systems .debugger-sidepanels {
      align-content: start;
    }
    .debugger-drawer-panel--systems .debugger-section--grow {
      min-height: 0;
    }
    .debugger-drawer-panel--systems .debugger-systems {
      max-height: none;
    }
    .debugger-input:disabled,
    .debugger-field__input:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .debugger-content-action:disabled,
    .debugger-drawer__toggle:disabled,
    .debugger-drawer__tab:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(style);
}
