# G-Code 3D Visualizer — Phase 2 Design Spec

**Issue:** #39
**Date:** 2026-03-22
**Status:** Approved

## Goal

Improve the 3D G-code visualizer with off-thread parsing, a reference grid, configurable rendering settings, and clickable path segments with source code linking. All new webview code is written in typed TypeScript.

## Prerequisites

PR #26 (Phase 1) must be merged. The current architecture provides:
- `GCodeInterpreter` with variable resolution, WHILE/IF control flow, modal motion
- `GCodePathExtractor` implementing `MotionHandler`
- `VisualizerService` (synchronous pipeline)
- `GCodeVisualizerPanel` (singleton webview panel)
- `webviewTemplate.ts` (601-line inline HTML/CSS/JS template)

---

## PR Sequence

```
PR1: Extract webview into separate HTML/CSS/TS files
PR2: Off-thread parsing (persistent Worker Thread + loading indicator)
PR3: Reference grid
PR4: Configurable visualization settings
PR5: Clickable path segments with source code linking
```

Each PR builds on the previous. Each is independently mergeable and testable.

---

## Shared Types Strategy

Types are split by dependency to respect layer boundaries:

```
src/shared/
  visualizerTypes.ts    — Pure data types used by BOTH extension host and webview:
                          PathPoint, PathSegment, PathBounds, ToolPathData,
                          MotionType, MotionContext, VisualizerSettings,
                          ProjectionMode, VisualizerResult
                          NO parser or VS Code imports.

src/visualizer/
  types.ts              — Handler types that depend on parser nodes:
                          MotionHandler, InterpreterOptions
                          Imports from parser/nodes.
```

Both `tsconfig.build.json` and `tsconfig.webview.json` include `src/shared/`. This ensures the webview and extension host share the same type definitions without either side pulling in the other's dependencies.

---

## PR1: Webview Extraction

### Problem

The webview is a 601-line inline JavaScript string inside a TypeScript template literal. No type checking, no linting, XSS risk from string interpolation. Phase 2 adds grid rendering, hit testing, and settings UI — continuing inline would push it past 800+ lines with no safety net.

### File Structure

```
src/webview/
  index.html          — HTML markup (toolbar, canvas, empty-msg, stats)
  styles.css          — CSS (VS Code theme variables, layout)
  renderer.ts         — Entry point: init, render loop, message handling
  projection.ts       — project() function, camera state, ProjectionMode
  interaction.ts      — Mouse/wheel/keyboard handlers, drag state
  axes.ts             — XYZ axis indicator drawing
  types.ts            — Webview-only types (DOM refs, internal state)

src/shared/
  visualizerTypes.ts  — Shared data types (see Shared Types Strategy above)

tsconfig.webview.json — Separate compilation: ES2020, DOM lib, no Node types
                        includes src/webview/ and src/shared/
```

### Build Pipeline

- `tsconfig.webview.json` compiles `src/webview/*.ts` and `src/shared/*.ts` into `dist/webview/renderer.js` (bundled via esbuild)
- `index.html` and `styles.css` copied to `dist/webview/` during build
- `package.json` `build` script updated to include webview compilation

### Panel Integration

`GCodeVisualizerPanel` reads `index.html`, injects CSP and webview URIs using `replaceAll` to handle multiple occurrences:

```typescript
const scriptUri = webview.asWebviewUri(joinPath(extensionUri, 'dist', 'webview', 'renderer.js'));
const styleUri = webview.asWebviewUri(joinPath(extensionUri, 'dist', 'webview', 'styles.css'));
const nonce = generateNonce();
const cspSource = webview.cspSource;

const html = readFileSync(htmlPath, 'utf-8')
  .replaceAll('{{nonce}}', nonce)
  .replaceAll('{{scriptUri}}', scriptUri.toString())
  .replaceAll('{{styleUri}}', styleUri.toString())
  .replaceAll('{{cspSource}}', cspSource);

panel.webview.html = html;
```

CSP in `index.html`:
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src {{cspSource}}; script-src 'nonce-{{nonce}}' {{cspSource}};" />
```

The `<script>` tag loads the external file with the nonce:
```html
<script nonce="{{nonce}}" src="{{scriptUri}}"></script>
```

### What Changes

- `webviewTemplate.ts` removed entirely — `generateNonce()` moves to `GCodeVisualizerPanel`
- `buildWebviewHtml()` removed — replaced by HTML file + URI injection
- Settings passed via initial `postMessage` after panel creation, not string interpolation
- All existing rendering logic preserved, rewritten in TypeScript across focused files

### Design Rationale

Split into multiple files (not one `renderer.ts`) because:
- `projection.ts` is pure math — independently testable
- `interaction.ts` is input handling — separate concern from rendering
- PR3 adds `grid.ts`, PR5 adds `hitTesting.ts` — clean extension points exist from the start
- Each file stays under ~150 lines

---

## PR2: Off-Thread Parsing with Loading Indicator

### Problem

`VisualizerService.extractToolPath()` runs synchronously on the extension host main thread. Large CAM files (10k+ lines) block the UI, making it impossible to show a loading indicator simultaneously.

### Architecture

**Persistent Worker Thread** — One long-lived `worker_threads.Worker` spawned when the first parse is requested. Stays alive for the panel's lifetime.

**Layer separation:** `VisualizerService` remains a pure synchronous pipeline (unchanged). It runs *inside* the worker. The worker thread imports and uses `VisualizerService` directly. A new `WorkerClient` class in `src/client/` manages the worker lifecycle and message passing — this is a VS Code adapter layer concern, not a service concern.

```
src/visualizer/
  visualizerWorker.ts   — Worker entry: imports VisualizerService, receives text,
                          runs pipeline, posts back VisualizerResult

src/client/
  WorkerClient.ts       — Worker lifecycle, message passing, cancellation,
                          error handling. Owned by CommandProvider.
```

### Message Protocol

```typescript
// Main → Worker
interface WorkerRequest {
  readonly type: 'parse';
  readonly id: number;            // Generation counter for stale rejection
  readonly text: string;
  readonly maxIterations: number;
}

// Worker → Main (success or parse failure)
interface WorkerResponse {
  readonly type: 'result';
  readonly id: number;
  readonly result: VisualizerResult;  // VisualizerSuccess or VisualizerFailure
  readonly durationMs: number;
}

// Worker → Main (unrecoverable worker error)
interface WorkerErrorResponse {
  readonly type: 'error';
  readonly id: number;
  readonly errorMessage: string;
}
```

### Worker Error Handling

Three error classes:
1. **Parse failure** — Caught by `VisualizerService`, returned as `VisualizerFailure` inside `WorkerResponse.result`. Normal flow.
2. **Worker crash** — Unhandled throw inside worker. `WorkerClient` listens on the worker's `'error'` event, rejects the pending promise, and respawns the worker.
3. **Worker exit** — Unexpected exit code. `WorkerClient` listens on `'exit'` event, respawns if the panel is still open.

### Cancellation

Generation counter approach:
- `WorkerClient` increments a counter on each new request
- When a response arrives with `id < currentId`, discard it
- No worker termination needed — the worker finishes its stale job harmlessly

### Serialization Boundary

The entire lex→parse→interpret→extract pipeline runs inside the worker. Only the final `VisualizerResult` (plain data — interfaces, not class instances) crosses the `postMessage` boundary via structured clone. AST nodes, parser state, and interpreter state never leave the worker.

### CommandProvider Changes

`CommandProvider` owns the `WorkerClient` (not `VisualizerService`):

```typescript
// Before:
const result = this.visualizerService.extractToolPath(text);

// After:
const result = await this.workerClient.parse(text);
```

`WorkerClient` gains a `Disposable` interface. Disposed when the panel closes.

### Loading State in Webview

New extension → webview message type: `{ type: 'loading' }`. The webview shows a CSS spinner overlay centered on the canvas. Cleared when `update` or `error` arrives.

### Fallback

If `worker_threads.Worker` fails to spawn (e.g., restricted environment), `WorkerClient` falls back to running `VisualizerService.extractToolPath()` synchronously on the main thread with a console warning. The `WorkerClient.parse()` API is async regardless — the sync fallback just resolves immediately.

---

## PR3: Reference Grid

### New File

```
src/webview/
  grid.ts             — drawGrid() function
```

### Rendering

- Draws on XY plane at Z=0, rendered before path segments (behind them in painter's algorithm)
- Uses the same `project()` function from `projection.ts`
- Minor grid lines every `gridSpacing` units (default 10mm), opacity ~0.15
- Major grid lines every 5th interval, opacity ~0.35
- Origin lines (X=0, Y=0) slightly brighter as reference
- Grid extent auto-computed from `PathBounds`, rounded out to the next grid interval

### Integration

```typescript
// In renderer.ts render(), before drawing segments:
if (settings.showGrid) {
  drawGrid(ctx, bounds, settings.gridSpacing, project);
}
```

`drawGrid` receives the projection function as a parameter — no coupling to camera internals.

### Settings

`VisualizerSettings` gains: `showGrid: boolean` (default `true`), `gridSpacing: number` (default `10`). Added to `package.json` contribution settings. Toolbar gets a grid toggle button.

**Note:** PR3 adds these settings with simple read-on-command behavior (matching existing pattern). PR4 adds the bidirectional toolbar↔settings sync mechanism that covers all settings including these.

---

## PR4: Configurable Visualization Settings

### Extended Settings Type

```typescript
interface VisualizerSettings {
  // Existing:
  readonly rapidColor: string;
  readonly feedColor: string;
  readonly arcColor: string;
  readonly lineThickness: number;
  // From PR3:
  readonly showGrid: boolean;           // default true
  readonly gridSpacing: number;         // default 10
  // New in PR4:
  readonly showRapidMoves: boolean;     // default true
  readonly projection: ProjectionMode;  // default PERSPECTIVE
}

enum ProjectionMode {
  PERSPECTIVE = 'perspective',
  ORTHOGRAPHIC = 'orthographic',
}
```

`ProjectionMode` is defined in `src/shared/visualizerTypes.ts` so both the extension host and webview can use it.

### Toolbar Additions

- Toggle button: "Rapid" (show/hide G0 moves)
- Toggle button: "Grid" (show/hide grid — wired to existing setting from PR3)
- Toggle button: "Persp / Ortho" (projection mode switch)

### VS Code Settings (`package.json`)

- `gcode.visualizer.showRapidMoves` (boolean)
- `gcode.visualizer.projection` (enum: `perspective`, `orthographic`)
- (PR3 already added `showGrid` and `gridSpacing`)

### Bidirectional Sync

- **Toolbar → settings:** Toolbar change → `settingsChange` message to extension → `config.update()` → persisted
- **Settings → toolbar:** `onDidChangeConfiguration` listener in `CommandProvider` → `updateSettings` message to webview → toolbar state updates

This replaces the current pattern where settings are only read on command invocation. All settings (including existing colors/thickness and PR3's grid settings) gain bidirectional sync.

### Orthographic Projection

In `projection.ts`: when mode is orthographic, use constant scale (no perspective divide). The `project()` function accepts `ProjectionMode` and skips the `fov / depth` calculation for orthographic mode.

---

## PR5: Clickable Path Segments with Source Code Linking

### Data Model Changes

**New type in `src/shared/visualizerTypes.ts` — `MotionContext`:**

```typescript
interface MotionContext {
  readonly sourceLine: number;
  readonly sourceText: string;
  readonly feedRate: number | null;
  readonly spindleSpeed: number | null;
}
```

**`MotionHandler` interface extended (in `src/visualizer/types.ts`):**

The `context` parameter is **optional** to preserve backward compatibility. Existing `MotionHandler` implementations continue to work without changes. The interpreter always provides it, but consumers that don't need it can ignore it.

```typescript
interface MotionHandler {
  onMotionCommand(
    command: string,
    parameters: readonly AxisParameterNode[],
    evaluator: GCodeExpressionEvaluator,
    context?: MotionContext
  ): void;
}
```

**`PathSegment` gains context reference:**

```typescript
interface PathSegment {
  readonly type: MotionType;
  readonly points: readonly PathPoint[];
  readonly context?: MotionContext;
}
```

`context` is optional on the type. After PR5, `GCodePathExtractor` always populates it. The webview info panel checks for its presence and shows coordinates-only when absent (graceful degradation for any future consumer that skips context).

### Interpreter Changes

`GCodeInterpreter` tracks modal state for feed rate and spindle speed:
- Updated when F or S parameters appear on motion commands
- Persisted across subsequent commands (standard G-code modal behavior)
- Receives raw source text at construction time (the original file text) for line extraction
- Builds `MotionContext` from the current `MotionCommandNode` range (or `AxisParameterNode` range for modal dispatches) and active F/S values

### New Webview File

```
src/webview/
  hitTesting.ts       — 2D line segment hit testing against projected paths
```

### Hit Testing

- On `click`, project all segment line sub-segments to 2D screen space
- Find the closest segment to the click point within a 5px tolerance
- O(n) scan over segments — sufficient for typical files (<10k segments)
- On `mousemove`, lightweight hover detection (throttled, only when not dragging)

### Visual Feedback

- **Hover:** Thicker line + shadow glow on the hovered segment (redraw with `shadowBlur`)
- **Selected:** Stays highlighted until another click or Escape key
- Both states drawn as an overlay pass after the main render

### Info Panel

Floating panel in the bottom-left of the canvas (inside the webview, not a VS Code panel):
- Motion type, source line number, original G-code text
- Feed rate (if set), spindle speed (if set)
- Start and end coordinates
- Styled with VS Code theme CSS variables
- "Go to line" link/button that sends a message to the extension
- When `context` is absent: shows coordinates only, hides "Go to line" button

### Source Code Navigation

New webview → extension message:

```typescript
interface NavigateToLineMessage {
  type: 'navigateToLine';
  line: number;
}
```

`GCodeVisualizerPanel` handles this:
```typescript
const range = new vscode.Range(line, 0, line, 0);
editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
editor.selection = new vscode.Selection(range.start, range.start);
```

---

## Testing Strategy

Each PR includes its own tests:

| PR | Unit Tests | E2E Tests |
|----|-----------|-----------|
| PR1 | `projection.test.ts` (project math), existing extractor tests still pass | Visualizer command still opens, renders |
| PR2 | `WorkerClient.test.ts` (mock worker, error handling, cancellation), `VisualizerService.test.ts` unchanged | Large file doesn't freeze |
| PR3 | `grid.test.ts` (grid extent calculation, line spacing) | Grid visible in panel |
| PR4 | Settings read/write round-trip, projection mode toggle | Settings persist across sessions |
| PR5 | `hitTesting.test.ts` (2D distance calculations), `MotionContext` propagation through interpreter | Click navigates to source line |

---

## Files Summary

### New Files

```
src/shared/visualizerTypes.ts                (PR1 — extracted from visualizer/types.ts)

src/webview/index.html                       (PR1)
src/webview/styles.css                       (PR1)
src/webview/renderer.ts                      (PR1)
src/webview/projection.ts                    (PR1)
src/webview/interaction.ts                   (PR1)
src/webview/axes.ts                          (PR1)
src/webview/types.ts                         (PR1)
src/webview/grid.ts                          (PR3)
src/webview/hitTesting.ts                    (PR5)

src/client/WorkerClient.ts                   (PR2)
src/visualizer/visualizerWorker.ts           (PR2)

tsconfig.webview.json                        (PR1)
```

### Modified Files

```
src/visualizer/types.ts              — Slimmed: only MotionHandler, InterpreterOptions (PR1)
src/visualizer/GCodeInterpreter.ts   — MotionContext construction, F/S modal tracking (PR5)
src/visualizer/GCodePathExtractor.ts — MotionContext passthrough (PR5)
src/client/GCodeVisualizerPanel.ts   — HTML file loading, navigateToLine handler (PR1, PR5)
src/client/CommandProvider.ts        — WorkerClient, async callers, config listener (PR2, PR4)
src/client/webviewTemplate.ts       — Removed (PR1)
package.json                         — New settings, build script (PR1, PR3, PR4)
```
