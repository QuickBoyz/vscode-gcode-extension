# Phase 2 PR1: Webview Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the 601-line inline JavaScript webview template into separate HTML, CSS, and TypeScript files with full type safety, linting, and testability.

**Architecture:** The inline template string in `webviewTemplate.ts` is split into three concerns: `index.html` (markup), `styles.css` (styling), and TypeScript modules (`renderer.ts`, `projection.ts`, `interaction.ts`, `axes.ts`). A separate `tsconfig.webview.json` compiles the webview code with DOM types. esbuild bundles it into a single `dist/webview/renderer.js`. The panel loads these files via `webview.asWebviewUri()`.

**Tech Stack:** TypeScript 5.x, esbuild (new devDependency), VS Code Webview API, Canvas 2D

**Spec:** `docs/superpowers/specs/2026-03-22-visualizer-phase2-design.md` (PR1 section)

**Branch:** `feat/webview-extraction` from `main`

---

## Task 1: Create shared types and webview tsconfig

**Files:**
- Create: `src/shared/visualizerTypes.ts`
- Create: `tsconfig.webview.json`
- Modify: `src/visualizer/types.ts` — re-export from shared, keep handler types
- Modify: `package.json` — add esbuild devDependency

- [ ] **Step 1: Install esbuild**

```bash
npm install --save-dev esbuild
```

- [ ] **Step 2: Create `src/shared/visualizerTypes.ts`**

Extract all parser-independent types from `src/visualizer/types.ts` into this new file. These types are used by both the extension host and the webview.

```typescript
/**
 * Shared data types for the G-code visualizer.
 *
 * These types are intentionally free of VS Code, parser, and Node.js
 * dependencies so they can be used in both the extension host and the
 * webview (which runs in a browser-like environment).
 */

/**
 * G-code motion type used to colour-code path segments in the viewer.
 */
export enum MotionType {
  RAPID = 'rapid',
  FEED = 'feed',
  ARC_CW = 'arc_cw',
  ARC_CCW = 'arc_ccw',
}

/**
 * An immutable 3D point in G-code coordinate space (mm or inches).
 */
export interface PathPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * A single motion segment.
 */
export interface PathSegment {
  readonly type: MotionType;
  readonly points: readonly PathPoint[];
}

/**
 * Axis-aligned bounding box of the complete tool path.
 */
export interface PathBounds {
  readonly min: PathPoint;
  readonly max: PathPoint;
}

/**
 * The full result returned by the path extractor.
 */
export interface ToolPathData {
  readonly segments: readonly PathSegment[];
  readonly bounds: PathBounds;
}

/**
 * User-configurable visual appearance for the 3D viewer.
 */
export interface VisualizerSettings {
  readonly rapidColor: string;
  readonly feedColor: string;
  readonly arcColor: string;
  readonly lineThickness: number;
}

export const DEFAULT_VISUALIZER_SETTINGS: VisualizerSettings = {
  rapidColor: '#ff6b6b',
  feedColor: '#4ecdc4',
  arcColor: '#45b7d1',
  lineThickness: 1,
};

/**
 * Successful result from the visualizer pipeline.
 */
export interface VisualizerSuccess {
  readonly success: true;
  readonly data: ToolPathData;
}

/**
 * Failed result from the visualizer pipeline.
 */
export interface VisualizerFailure {
  readonly success: false;
  readonly errorMessage: string;
}

/**
 * Discriminated union for error handling without try/catch.
 */
export type VisualizerResult = VisualizerSuccess | VisualizerFailure;
```

- [ ] **Step 3: Update `src/visualizer/types.ts` to re-export shared types and keep handler types**

```typescript
/**
 * Re-export shared types that are used throughout the extension host.
 */
export {
  DEFAULT_VISUALIZER_SETTINGS,
  MotionType,
  VisualizerSettings,
  PathBounds,
  PathPoint,
  PathSegment,
  ToolPathData,
  VisualizerResult,
  VisualizerSuccess,
  VisualizerFailure,
} from '../shared/visualizerTypes';

/**
 * Types that depend on parser nodes — extension host only.
 */
import { AxisParameterNode } from '../parser/nodes/AxisParameterNode';
import { GCodeExpressionEvaluator } from './GCodeExpressionEvaluator';

export interface InterpreterOptions {
  readonly maxIterations: number;
}

export const DEFAULT_INTERPRETER_OPTIONS: InterpreterOptions = {
  maxIterations: 10_000,
};

export interface MotionHandler {
  onMotionCommand(
    command: string,
    parameters: readonly AxisParameterNode[],
    evaluator: GCodeExpressionEvaluator
  ): void;
}
```

- [ ] **Step 4: Create `tsconfig.webview.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "noImplicitAny": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true,
    "isolatedModules": true,
    "outDir": "./dist/webview",
    "rootDir": "./src"
  },
  "include": ["src/webview/**/*.ts", "src/shared/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Exclude webview files from the main tsconfigs**

**CRITICAL:** The main `tsconfig.build.json` includes `src/**/*.ts` which would pick up `src/webview/*.ts` and fail (no DOM types). Add exclusions:

In `tsconfig.build.json`, add `"src/webview/*"` and `"src/shared/*"` to the `exclude` array:
```json
"exclude": ["src/e2e/*", "src/test/*", "src/webview/*", "src/shared/*"]
```

In `tsconfig.json` (root, used by `tsc --noEmit` and Jest), add:
```json
"exclude": ["node_modules", "dist", "out", "src/webview/*"]
```

(`src/shared/*` does NOT need to be excluded from the root tsconfig — it has no DOM dependencies and is used by extension host code via `src/visualizer/types.ts` re-exports.)

- [ ] **Step 6: Run typecheck to ensure existing code still compiles**

```bash
npx tsc --noEmit && npx tsc --noEmit --project tsconfig.webview.json
```
Expected: PASS for both — main code compiles without DOM types, webview code compiles with DOM types.

- [ ] **Step 7: Run tests to ensure nothing is broken**

```bash
npm test
```
Expected: 605 tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/shared/visualizerTypes.ts src/visualizer/types.ts tsconfig.webview.json tsconfig.build.json tsconfig.json package.json package-lock.json
git commit -m "refactor: extract shared visualizer types and add webview tsconfig

Moves parser-free data types to src/shared/visualizerTypes.ts for use
by both extension host and webview. Adds tsconfig.webview.json with
DOM types. Excludes src/webview/ from main tsconfigs."
```

---

## Task 2: Create webview TypeScript modules

**Files:**
- Create: `src/webview/types.ts`
- Create: `src/webview/projection.ts`
- Create: `src/webview/axes.ts`
- Create: `src/webview/interaction.ts`
- Create: `src/webview/renderer.ts`
- Test: `src/test/projection.test.ts`

- [ ] **Step 1: Write projection tests**

Create `src/test/projection.test.ts`:

```typescript
import { project, createCameraState, DEFAULT_CAMERA_ANGLES } from '../webview/projection';

describe('projection', () => {
  it('projects a point at the origin to canvas center', () => {
    const camera = createCameraState();
    const result = project(0, 0, 0, camera, 400, 300);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(200);
    expect(result!.y).toBeCloseTo(150);
  });

  it('projects Z-up: a point above origin maps above canvas center', () => {
    const camera = createCameraState();
    const result = project(0, 0, 10, camera, 400, 300);
    expect(result).not.toBeNull();
    // Z-up means positive Z → lower y value on canvas (canvas y is inverted)
    expect(result!.y).toBeLessThan(150);
  });

  it('returns null for a point behind the camera', () => {
    const camera = { ...createCameraState(), radius: 10 };
    // A point very far behind the camera in the depth direction
    const result = project(0, -10000, 0, camera, 400, 300);
    expect(result).toBeNull();
  });

  it('uses default camera angles', () => {
    expect(DEFAULT_CAMERA_ANGLES.theta).toBeCloseTo(-Math.PI / 4);
    expect(DEFAULT_CAMERA_ANGLES.phi).toBeCloseTo(Math.PI / 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern projection
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/webview/types.ts`**

Webview-internal types (DOM state, not shared across boundaries):

```typescript
/**
 * Webview-internal types.
 * These types are only used within the webview renderer and are NOT
 * shared with the extension host.
 */

/** Result of projecting a 3D point to 2D canvas coordinates. */
export interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

/**
 * Mutable camera state for the orbit camera.
 *
 * Note: Fields are intentionally mutable (not readonly) because the
 * interaction module updates them directly on mouse/wheel events for
 * real-time responsiveness. This is a deliberate deviation from the
 * readonly-by-default rule in AGENTS.md.
 */
export interface CameraState {
  theta: number;
  phi: number;
  radius: number;
  panX: number;
  panY: number;
  target: { x: number; y: number; z: number };
}

/** Drag interaction mode. */
export enum DragMode {
  ORBIT = 'orbit',
  PAN = 'pan',
}
```

- [ ] **Step 4: Create `src/webview/projection.ts`**

Pure math — no DOM, no canvas references. Independently testable.

```typescript
import { CameraState, ProjectedPoint } from './types';

/** Default camera angles: front-right isometric, Z-up. */
export const DEFAULT_CAMERA_ANGLES = {
  theta: -Math.PI / 4,
  phi: Math.PI / 5,
} as const;

/** Creates a fresh camera state with default values. */
export function createCameraState(): CameraState {
  return {
    theta: DEFAULT_CAMERA_ANGLES.theta,
    phi: DEFAULT_CAMERA_ANGLES.phi,
    radius: 200,
    panX: 0,
    panY: 0,
    target: { x: 0, y: 0, z: 0 },
  };
}

/**
 * Projects a 3D world point to 2D canvas coordinates (Z-up convention).
 *
 * Rotation order:
 *   1. Azimuth (theta) around the Z axis
 *   2. Elevation (phi) around the X axis
 *
 * Returns null when the point is behind the camera.
 */
export function project(
  px: number,
  py: number,
  pz: number,
  camera: CameraState,
  canvasWidth: number,
  canvasHeight: number
): ProjectedPoint | null {
  const dx = px - camera.target.x;
  const dy = py - camera.target.y;
  const dz = pz - camera.target.z;

  const cosT = Math.cos(camera.theta);
  const sinT = Math.sin(camera.theta);
  const x1 = dx * cosT + dy * sinT;
  const y1 = -dx * sinT + dy * cosT;

  const cosP = Math.cos(camera.phi);
  const sinP = Math.sin(camera.phi);
  const y2 = y1 * cosP - dz * sinP;
  const z2 = y1 * sinP + dz * cosP;

  const depth = camera.radius + y2;
  if (depth < 0.01) return null;

  const fov = Math.min(canvasWidth, canvasHeight) * 1.5;
  const scale = fov / depth;

  return {
    x: canvasWidth / 2 + camera.panX + x1 * scale,
    y: canvasHeight / 2 + camera.panY - z2 * scale,
    depth,
  };
}
```

- [ ] **Step 5: Run projection tests**

```bash
npm test -- --testPathPattern projection
```
Expected: PASS.

- [ ] **Step 6: Create `src/webview/axes.ts`**

```typescript
import { CameraState } from './types';
import { project } from './projection';

/**
 * Draws the XYZ reference axes at the camera target point.
 */
export function drawAxes(
  ctx: CanvasRenderingContext2D,
  camera: CameraState,
  canvasWidth: number,
  canvasHeight: number
): void {
  const axisLength = camera.radius * 0.12;
  const origin = project(camera.target.x, camera.target.y, camera.target.z, camera, canvasWidth, canvasHeight);
  if (!origin) return;

  const axes = [
    { label: 'X', dx: axisLength, dy: 0, dz: 0, color: '#e05555' },
    { label: 'Y', dx: 0, dy: axisLength, dz: 0, color: '#55bb55' },
    { label: 'Z', dx: 0, dy: 0, dz: axisLength, color: '#5588ff' },
  ];

  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.8;

  for (const axis of axes) {
    const tip = project(
      camera.target.x + axis.dx,
      camera.target.y + axis.dy,
      camera.target.z + axis.dz,
      camera,
      canvasWidth,
      canvasHeight
    );
    if (!tip) continue;

    ctx.strokeStyle = axis.color;
    ctx.fillStyle = axis.color;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    ctx.font = 'bold 11px monospace';
    ctx.fillText(axis.label, tip.x + 3, tip.y + 3);
  }

  ctx.globalAlpha = 1.0;
}
```

- [ ] **Step 7: Create `src/webview/interaction.ts`**

```typescript
import { CameraState, DragMode } from './types';

/** Orbit sensitivity (radians per pixel). */
const ORBIT_SENSITIVITY = 0.008;

/** Minimum distance from the camera to the poles. */
const POLE_MARGIN = 0.01;

/** Zoom scale factors for scroll up/down. */
const ZOOM_IN_FACTOR = 0.89;
const ZOOM_OUT_FACTOR = 1.12;

/** Minimum orbit radius. */
const MIN_RADIUS = 0.01;

/**
 * Sets up mouse and wheel interaction on the canvas.
 * Returns a cleanup function that removes all event listeners.
 */
export function setupInteraction(
  canvas: HTMLCanvasElement,
  camera: CameraState,
  onCameraChange: () => void
): () => void {
  let dragMode: DragMode | null = null;
  let lastMouseX = 0;
  let lastMouseY = 0;

  function onMouseDown(event: MouseEvent): void {
    if (event.button === 0) {
      dragMode = event.shiftKey ? DragMode.PAN : DragMode.ORBIT;
    } else if (event.button === 1 || event.button === 2) {
      dragMode = DragMode.PAN;
    }
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
    canvas.classList.add('dragging');
    event.preventDefault();
  }

  function onMouseMove(event: MouseEvent): void {
    if (!dragMode) return;
    const dx = event.clientX - lastMouseX;
    const dy = event.clientY - lastMouseY;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;

    if (dragMode === DragMode.ORBIT) {
      camera.theta -= dx * ORBIT_SENSITIVITY;
      camera.phi = Math.max(
        -Math.PI / 2 + POLE_MARGIN,
        Math.min(Math.PI / 2 - POLE_MARGIN, camera.phi + dy * ORBIT_SENSITIVITY)
      );
    } else {
      camera.panX += dx;
      camera.panY += dy;
    }
    onCameraChange();
  }

  function onMouseUp(): void {
    dragMode = null;
    canvas.classList.remove('dragging');
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    const factor = event.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR;
    camera.radius = Math.max(MIN_RADIUS, camera.radius * factor);
    onCameraChange();
  }

  function onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);

  return () => {
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', onContextMenu);
  };
}
```

- [ ] **Step 8: Create `src/webview/renderer.ts`**

This is the main entry point. It initializes the renderer, handles messages from the extension, and orchestrates the render loop.

```typescript
import { MotionType, PathBounds, PathSegment, VisualizerSettings } from '../shared/visualizerTypes';
import { CameraState } from './types';
import { createCameraState, DEFAULT_CAMERA_ANGLES, project } from './projection';
import { drawAxes } from './axes';
import { setupInteraction } from './interaction';

// ---- VS Code API ----
declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
const vscode = acquireVsCodeApi();

// ---- DOM refs ----
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const emptyMsg = document.getElementById('empty-msg') as HTMLElement;
const statsEl = document.getElementById('stats') as HTMLElement;
const rapidColorEl = document.getElementById('rapidColor') as HTMLInputElement;
const feedColorEl = document.getElementById('feedColor') as HTMLInputElement;
const arcColorEl = document.getElementById('arcColor') as HTMLInputElement;
const thicknessEl = document.getElementById('thickness') as HTMLInputElement;
const thicknessVal = document.getElementById('thicknessVal') as HTMLElement;
const btnReset = document.getElementById('btnReset') as HTMLElement;
const errorBanner = document.getElementById('error-banner') as HTMLElement;
const errorText = document.getElementById('error-text') as HTMLElement;

// ---- State ----
let segments: readonly PathSegment[] = [];
let bounds: PathBounds | null = null;
let settings: VisualizerSettings = {
  rapidColor: '#ff6b6b',
  feedColor: '#4ecdc4',
  arcColor: '#45b7d1',
  lineThickness: 1,
};
const camera: CameraState = createCameraState();
let animFrameId: number | null = null;

const bgColor = getComputedStyle(document.documentElement)
  .getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';

// ---- Rendering ----

function getSegmentColor(type: MotionType): string {
  switch (type) {
    case MotionType.RAPID: return settings.rapidColor;
    case MotionType.FEED: return settings.feedColor;
    case MotionType.ARC_CW:
    case MotionType.ARC_CCW: return settings.arcColor;
    default: return '#aaaaaa';
  }
}

function render(): void {
  animFrameId = null;
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);

  if (segments.length === 0) return;

  const thickness = Math.max(0.5, settings.lineThickness);

  // Depth-sort segments (painter's algorithm)
  const sorted = segments.map((seg) => {
    const mid = seg.points[Math.floor(seg.points.length / 2)];
    const p = project(mid.x, mid.y, mid.z, camera, w, h);
    return { seg, depth: p ? p.depth : Infinity };
  });
  sorted.sort((a, b) => b.depth - a.depth);

  // Draw segments
  for (const { seg } of sorted) {
    const rapid = seg.type === MotionType.RAPID;
    ctx.strokeStyle = getSegmentColor(seg.type);
    ctx.lineWidth = rapid ? Math.max(0.5, thickness * 0.5) : thickness;
    ctx.globalAlpha = rapid ? 0.45 : 1.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(rapid ? [5, 6] : []);

    ctx.beginPath();
    let pathStarted = false;
    for (const pt of seg.points) {
      const p = project(pt.x, pt.y, pt.z, camera, w, h);
      if (!p) { pathStarted = false; continue; }
      if (!pathStarted) {
        ctx.moveTo(p.x, p.y);
        pathStarted = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 1.0;
  ctx.setLineDash([]);
  drawAxes(ctx, camera, w, h);
}

function scheduleRender(): void {
  if (animFrameId === null) {
    animFrameId = requestAnimationFrame(render);
  }
}

// ---- Camera ----

function fitView(): void {
  if (segments.length === 0 || !bounds) return;

  camera.target.x = (bounds.min.x + bounds.max.x) / 2;
  camera.target.y = (bounds.min.y + bounds.max.y) / 2;
  camera.target.z = (bounds.min.z + bounds.max.z) / 2;

  const size = Math.max(
    bounds.max.x - bounds.min.x,
    bounds.max.y - bounds.min.y,
    bounds.max.z - bounds.min.z,
    1
  );
  camera.radius = size * 2.0;
  camera.panX = 0;
  camera.panY = 0;
  camera.theta = DEFAULT_CAMERA_ANGLES.theta;
  camera.phi = DEFAULT_CAMERA_ANGLES.phi;
}

// ---- Canvas resize ----

function resizeCanvas(): void {
  const wrapper = document.getElementById('canvas-wrapper')!;
  canvas.width = wrapper.clientWidth;
  canvas.height = wrapper.clientHeight;
  scheduleRender();
}

new ResizeObserver(resizeCanvas).observe(document.getElementById('canvas-wrapper')!);
resizeCanvas();

// ---- Interaction ----

setupInteraction(canvas, camera, scheduleRender);
btnReset.addEventListener('click', () => { fitView(); scheduleRender(); });

// ---- Toolbar ----

rapidColorEl.addEventListener('input', () => {
  settings = { ...settings, rapidColor: rapidColorEl.value };
  notifySettingsChange();
  scheduleRender();
});
feedColorEl.addEventListener('input', () => {
  settings = { ...settings, feedColor: feedColorEl.value };
  notifySettingsChange();
  scheduleRender();
});
arcColorEl.addEventListener('input', () => {
  settings = { ...settings, arcColor: arcColorEl.value };
  notifySettingsChange();
  scheduleRender();
});
thicknessEl.addEventListener('input', () => {
  settings = { ...settings, lineThickness: parseFloat(thicknessEl.value) };
  thicknessVal.textContent = thicknessEl.value;
  notifySettingsChange();
  scheduleRender();
});

function notifySettingsChange(): void {
  vscode.postMessage({ type: 'settingsChange', settings });
}

// ---- Settings UI sync ----

function updateSettingsUI(incoming: Partial<VisualizerSettings>): void {
  if (incoming.rapidColor !== undefined) {
    settings = { ...settings, rapidColor: incoming.rapidColor };
    rapidColorEl.value = incoming.rapidColor;
  }
  if (incoming.feedColor !== undefined) {
    settings = { ...settings, feedColor: incoming.feedColor };
    feedColorEl.value = incoming.feedColor;
  }
  if (incoming.arcColor !== undefined) {
    settings = { ...settings, arcColor: incoming.arcColor };
    arcColorEl.value = incoming.arcColor;
  }
  if (incoming.lineThickness !== undefined) {
    settings = { ...settings, lineThickness: incoming.lineThickness };
    thicknessEl.value = String(incoming.lineThickness);
    thicknessVal.textContent = String(incoming.lineThickness);
  }
}

// ---- Error display ----

function showError(message: string): void {
  errorText.textContent = message;
  errorBanner.style.display = 'flex';
}

function hideError(): void {
  errorBanner.style.display = 'none';
  errorText.textContent = '';
}

// ---- Messages from extension ----

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data;

  if (msg.type === 'update') {
    segments = msg.segments || [];
    bounds = msg.bounds || null;
    updateSettingsUI(msg.settings || {});
    emptyMsg.style.display = segments.length === 0 ? 'flex' : 'none';
    statsEl.textContent = segments.length > 0 ? `${segments.length} segments` : '';
    hideError();
    fitView();
    scheduleRender();
  } else if (msg.type === 'updateSettings') {
    updateSettingsUI(msg.settings || {});
    scheduleRender();
  } else if (msg.type === 'error') {
    showError(msg.message || 'An unknown error occurred');
  }
});
```

- [ ] **Step 9: Run tests**

```bash
npm test && npx tsc --noEmit
```
Expected: All pass. Note: the webview TS files will show type errors with the main tsconfig (no DOM lib). That's expected — they compile via `tsconfig.webview.json` only. We'll verify this in Task 3.

- [ ] **Step 10: Commit**

```bash
git add src/webview/ src/test/projection.test.ts
git commit -m "feat: create typed webview modules for 3D renderer

Extracts the projection math, interaction handling, axes drawing, and
render loop into separate TypeScript modules under src/webview/.
Adds projection unit tests. These modules will replace the inline
JavaScript template in the next step."
```

---

## Task 3: Create HTML and CSS files, update build pipeline

**Files:**
- Create: `src/webview/index.html`
- Create: `src/webview/styles.css`
- Create: `scripts/build-webview.mjs`
- Modify: `package.json` — update build scripts
- Modify: `.vscodeignore` — include dist/webview

- [ ] **Step 1: Create `src/webview/index.html`**

Pure HTML markup with `{{placeholder}}` tokens. No inline JavaScript. No inline CSS (except the CSP meta tag).

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src {{cspSource}}; script-src 'nonce-{{nonce}}' {{cspSource}};" />
  <title>G-Code 3D Visualizer</title>
  <link rel="stylesheet" href="{{styleUri}}" />
</head>
<body>
<div id="app">
  <div id="toolbar">
    <div class="ctrl-group">
      <label for="rapidColor">Rapid (G0):</label>
      <input type="color" id="rapidColor" value="#ff6b6b" title="Rapid move colour" />
    </div>
    <div class="ctrl-group">
      <label for="feedColor">Feed (G1):</label>
      <input type="color" id="feedColor" value="#4ecdc4" title="Feed move colour" />
    </div>
    <div class="ctrl-group">
      <label for="arcColor">Arc (G2/G3):</label>
      <input type="color" id="arcColor" value="#45b7d1" title="Arc move colour" />
    </div>
    <div class="ctrl-group">
      <label for="thickness">Thickness:</label>
      <input type="range" id="thickness" min="0.5" max="5" step="0.5"
             value="1" title="Line thickness" />
      <span class="thickness-val" id="thicknessVal">1</span>
    </div>
    <button id="btnReset" title="Reset camera to fit the whole part">Reset View</button>
    <span class="hint">Left drag: rotate &middot; Shift+drag / Right drag: pan &middot; Scroll: zoom</span>
  </div>

  <div id="error-banner">
    <span class="error-icon">!</span>
    <span class="error-text" id="error-text"></span>
  </div>

  <div id="canvas-wrapper">
    <canvas id="canvas"></canvas>
    <div id="empty-msg" style="display:none">
      No tool path loaded.<br>
      Open a G-code file and run <em>G-Code: Open 3D Visualizer</em>.
    </div>
    <div id="stats"></div>
  </div>
</div>

<script nonce="{{nonce}}" src="{{scriptUri}}"></script>
</body>
</html>
```

- [ ] **Step 2: Create `src/webview/styles.css`**

Extract all CSS from the inline `<style>` block. Identical content, just in its own file.

(Copy the CSS from `webviewTemplate.ts` lines 40-143 verbatim into `src/webview/styles.css`.)

- [ ] **Step 3: Create `scripts/build-webview.mjs`**

```javascript
import { copyFileSync, mkdirSync } from 'fs';
import { build } from 'esbuild';

await build({
  entryPoints: ['src/webview/renderer.ts'],
  bundle: true,
  outfile: 'dist/webview/renderer.js',
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  sourcemap: true,
  tsconfig: 'tsconfig.webview.json',
});

// Copy static assets
mkdirSync('dist/webview', { recursive: true });
copyFileSync('src/webview/index.html', 'dist/webview/index.html');
copyFileSync('src/webview/styles.css', 'dist/webview/styles.css');

console.log('Webview build complete.');
```

- [ ] **Step 4: Update `package.json` build scripts**

Change the `build` script to also build the webview:

```json
"build": "rm -rf dist && tsc --project tsconfig.build.json && node scripts/build-webview.mjs",
"build:webview": "node scripts/build-webview.mjs"
```

- [ ] **Step 5: Check `.vscodeignore` for dist/webview inclusion**

Read `.vscodeignore` and ensure `dist/webview/` is NOT ignored (it needs to be in the packaged extension). If there's a blanket ignore like `!dist/**`, it's already covered.

- [ ] **Step 6: Run full build**

```bash
npm run build
```
Expected: Both tsc and esbuild succeed. `dist/webview/renderer.js`, `dist/webview/index.html`, and `dist/webview/styles.css` are produced.

- [ ] **Step 7: Commit**

```bash
git add src/webview/index.html src/webview/styles.css scripts/build-webview.mjs package.json
git commit -m "feat: add webview HTML/CSS and esbuild pipeline

Separates the webview markup into index.html and styles.css. Adds
an esbuild script that bundles the TypeScript modules into a single
renderer.js and copies static assets to dist/webview/."
```

---

## Task 4: Update GCodeVisualizerPanel to use external files

**Files:**
- Modify: `src/client/GCodeVisualizerPanel.ts` — load HTML from file, inject URIs
- Delete: `src/client/webviewTemplate.ts`
- Modify: `src/test/webviewTemplate.test.ts` — update or remove

- [ ] **Step 1: Update GCodeVisualizerPanel to load the HTML file**

Replace the `buildWebviewHtml` import with file-based loading. Move `generateNonce` to a shared utility so it remains testable:

Create `src/client/nonce.ts`:
```typescript
import { randomBytes } from 'crypto';

/**
 * Generates a cryptographically random nonce for Content-Security-Policy.
 */
export function generateNonce(): string {
  return randomBytes(16).toString('hex');
}
```

Then in `GCodeVisualizerPanel.ts`:
```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PathBounds, ToolPathData, VisualizerSettings } from '../visualizer/types';
import { generateNonce } from './nonce';
```

Update `initContent` to load the HTML file and inject URIs:

```typescript
private initContent(extensionUri: vscode.Uri): void {
  const webview = this.panel.webview;
  const nonce = generateNonce();

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'renderer.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'styles.css')
  );
  const cspSource = webview.cspSource;

  const htmlPath = path.join(extensionUri.fsPath, 'dist', 'webview', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf-8')
    .replaceAll('{{nonce}}', nonce)
    .replaceAll('{{scriptUri}}', scriptUri.toString())
    .replaceAll('{{styleUri}}', styleUri.toString())
    .replaceAll('{{cspSource}}', cspSource);

  webview.html = html;
}
```

Update `createOrShow` to pass `extensionUri` (from `context.extensionUri`) instead of settings for `initContent`. Settings are sent via `postMessage` after init.

Update `localResourceRoots` in the webview panel options:

```typescript
const panel = vscode.window.createWebviewPanel(
  'gcodeVisualizer',
  'G-Code 3D Visualizer',
  column ?? vscode.ViewColumn.Beside,
  {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [
      vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
    ],
  }
);
```

- [ ] **Step 2: Delete `src/client/webviewTemplate.ts`**

```bash
git rm src/client/webviewTemplate.ts
```

- [ ] **Step 3: Replace `src/test/webviewTemplate.test.ts` with updated tests**

The `generateNonce` tests now import from `src/client/nonce.ts`. The `buildWebviewHtml` tests are removed since the function no longer exists. Add tests for the static HTML/CSS files:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { generateNonce } from '../client/nonce';

describe('generateNonce', () => {
  it('returns a 32-character hex string', () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates unique values', () => {
    const nonces = new Set(Array.from({ length: 100 }, () => generateNonce()));
    expect(nonces.size).toBe(100);
  });
});

describe('webview static files', () => {
  const webviewDir = path.join(__dirname, '..', 'webview');

  it('index.html contains required placeholders', () => {
    const html = fs.readFileSync(path.join(webviewDir, 'index.html'), 'utf-8');
    expect(html).toContain('{{nonce}}');
    expect(html).toContain('{{scriptUri}}');
    expect(html).toContain('{{styleUri}}');
    expect(html).toContain('{{cspSource}}');
    expect(html).toContain('id="canvas"');
  });

  it('styles.css exists and is non-empty', () => {
    const css = fs.readFileSync(path.join(webviewDir, 'styles.css'), 'utf-8');
    expect(css.length).toBeGreaterThan(100);
    expect(css).toContain('--vscode-editor-background');
  });
});
```

- [ ] **Step 4: Run full verification**

```bash
npm run build && npm test && npx tsc --noEmit && npm run lint
```
Expected: All pass.

- [ ] **Step 5: Test in VS Code e2e**

```bash
npm run test:e2e
```
Expected: All 71 e2e tests pass, including the 5 visualizer tests.

- [ ] **Step 6: Commit**

```bash
git add src/client/GCodeVisualizerPanel.ts src/test/webviewTemplate.test.ts
git rm src/client/webviewTemplate.ts
git commit -m "refactor: load webview from external HTML/CSS/JS files

GCodeVisualizerPanel now reads index.html from dist/webview/ and
injects CSP nonce, script URI, and style URI via placeholder
replacement. Removes the inline template string entirely.

Settings are sent via postMessage after panel creation instead of
string interpolation, eliminating the XSS risk."
```

---

## Task 5: Final verification and PR

- [ ] **Step 1: Run complete verification chain**

```bash
npm run build && npm test && npx tsc --noEmit && npm run lint && npm run test:e2e
```
Expected: 605+ unit tests pass, 71 e2e tests pass, no type errors, no lint errors.

- [ ] **Step 2: Self-review**

```bash
git diff main...HEAD --stat
git diff main...HEAD
```

Verify:
- `src/client/webviewTemplate.ts` is deleted
- `src/webview/` contains: `index.html`, `styles.css`, `renderer.ts`, `projection.ts`, `interaction.ts`, `axes.ts`, `types.ts`
- `src/shared/visualizerTypes.ts` exists with all parser-free types
- `src/visualizer/types.ts` re-exports shared types and keeps handler types
- `tsconfig.webview.json` exists
- `scripts/build-webview.mjs` exists
- `package.json` build script includes webview build
- No leftover debug code or TODO comments

- [ ] **Step 3: Push and create PR**

```bash
git push origin feat/webview-extraction
gh pr create --base main \
  --title "refactor: extract webview into separate HTML/CSS/TypeScript files" \
  --body "$(cat <<'EOF'
## Summary

Extracts the 601-line inline JavaScript webview template into separate,
typed files:

- `src/webview/index.html` — Pure HTML markup
- `src/webview/styles.css` — CSS with VS Code theme variables
- `src/webview/renderer.ts` — Render loop, message handling
- `src/webview/projection.ts` — 3D→2D projection (independently testable)
- `src/webview/interaction.ts` — Mouse/wheel handlers
- `src/webview/axes.ts` — XYZ axis indicator
- `src/shared/visualizerTypes.ts` — Parser-free types shared between extension and webview

Compiled via esbuild into `dist/webview/renderer.js`. Panel loads files
via `webview.asWebviewUri()` with proper CSP.

## Motivation

- Type safety for all webview code (was untyped inline JS)
- Linting coverage
- Testable projection math
- Clean extension points for Phase 2 (grid.ts, hitTesting.ts)
- Eliminates XSS risk from string interpolation of settings

Part of Phase 2 (#39), prerequisite for all other Phase 2 PRs.

## Test Plan

- [ ] `npm test` — all unit tests pass
- [ ] `npm run test:e2e` — all e2e tests pass (visualizer opens, renders)
- [ ] F5 debug: open G-code file, right-click → Open 3D Visualizer
- [ ] Verify orbit/pan/zoom, color pickers, thickness slider all work
- [ ] Verify Reset View button works
EOF
)"
```
