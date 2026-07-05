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
      grid-template-rows: 56px 1fr 150px;
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
      grid-template-rows: auto auto minmax(0, 1fr);
    }
    .debugger-panel--right {
      grid-area: right;
      grid-template-rows: minmax(220px, 42%) minmax(0, 1fr);
    }
    .debugger-panel--bottom {
      grid-area: bottom;
      grid-template-rows: minmax(0, 1fr);
      min-height: 0;
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
  `;
  document.head.appendChild(style);
}
