/**
 * Main entry point for the G-code 3D visualizer webview.
 *
 * This module wires together projection, axes drawing, and interaction
 * handling.  It manages the render loop, toolbar controls, and message
 * passing with the VS Code extension host.
 *
 * Built as a self-contained IIFE — no exports.
 */

import { MotionType, PathBounds, PathSegment, VisualizerSettings } from '../shared/visualizerTypes';
import { CameraState } from './types';
import { createCameraState, DEFAULT_CAMERA_ANGLES, project } from './projection';
import { drawAxes } from './axes';
import { drawGrid } from './grid';
import { setupInteraction } from './interaction';

// ---------------------------------------------------------------------------
// VS Code webview API
// ---------------------------------------------------------------------------

/** Declared by the VS Code webview runtime. */
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum line thickness in canvas pixels. */
const MINIMUM_THICKNESS = 0.5;

/** Rapid moves are drawn at this fraction of the normal thickness. */
const RAPID_THICKNESS_FACTOR = 0.5;

/** Rapid moves are drawn at this opacity. */
const RAPID_OPACITY = 0.65;

/** Dash pattern for rapid moves: [dash, gap]. */
const RAPID_DASH_PATTERN: readonly number[] = [5, 6];

/** Fallback colour for unknown motion types. */
const FALLBACK_SEGMENT_COLOR = '#aaaaaa';

/** Default background colour when the CSS variable is unavailable. */
const DEFAULT_BACKGROUND_COLOR = '#1e1e1e';

/** Fit-view radius multiplier relative to the bounding-box largest dimension. */
const FIT_VIEW_RADIUS_FACTOR = 2.0;

/** Default error message when none is provided. */
const DEFAULT_ERROR_MESSAGE = 'An unknown error occurred';

// ---------------------------------------------------------------------------
// Colour mapping
// ---------------------------------------------------------------------------

/**
 * Returns the user-configured colour for a given motion type.
 */
function getSegmentColor(motionType: MotionType, settings: VisualizerSettings): string {
  switch (motionType) {
    case MotionType.RAPID:
      return settings.rapidColor;
    case MotionType.FEED:
      return settings.feedColor;
    case MotionType.ARC_CW:
    case MotionType.ARC_CCW:
      return settings.arcColor;
    default:
      return FALLBACK_SEGMENT_COLOR;
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

(function main(): void {
  const vscode = acquireVsCodeApi();

  // ---------- DOM refs ----------

  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const context = canvas.getContext('2d')!;
  const emptyMessage = document.getElementById('empty-msg') as HTMLDivElement;
  const statsElement = document.getElementById('stats') as HTMLDivElement;
  const rapidColorInput = document.getElementById('rapidColor') as HTMLInputElement;
  const feedColorInput = document.getElementById('feedColor') as HTMLInputElement;
  const arcColorInput = document.getElementById('arcColor') as HTMLInputElement;
  const thicknessInput = document.getElementById('thickness') as HTMLInputElement;
  const thicknessValueLabel = document.getElementById('thicknessVal') as HTMLSpanElement;
  const resetButton = document.getElementById('btnReset') as HTMLButtonElement;
  const gridToggleButton = document.getElementById('btnToggleGrid') as HTMLButtonElement;
  const errorBanner = document.getElementById('error-banner') as HTMLDivElement;
  const errorTextElement = document.getElementById('error-text') as HTMLSpanElement;

  // ---------- Viewer state ----------

  let segments: PathSegment[] = [];
  let bounds: PathBounds | null = null;
  const settings: VisualizerSettings = {
    rapidColor: rapidColorInput.value,
    feedColor: feedColorInput.value,
    arcColor: arcColorInput.value,
    lineThickness: parseFloat(thicknessInput.value),
    showGrid: true,
    gridSpacing: 10,
  };
  // Mutable copy that we update from toolbar / messages
  let mutableSettings = { ...settings };

  const camera: CameraState = createCameraState();
  let animationFrameId: number | null = null;

  // Cached background colour from the VS Code CSS variable
  const backgroundColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--vscode-editor-background')
      .trim() || DEFAULT_BACKGROUND_COLOR;

  // ---------- Rendering ----------

  function render(): void {
    animationFrameId = null;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    context.clearRect(0, 0, canvasWidth, canvasHeight);

    // Background -- uses the VS Code editor background colour
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    if (bounds && mutableSettings.showGrid) {
      drawGrid(context, camera, canvasWidth, canvasHeight, bounds, mutableSettings.gridSpacing);
    }

    if (segments.length === 0) {
      return;
    }

    const thickness = Math.max(MINIMUM_THICKNESS, mutableSettings.lineThickness);

    // --- Depth-sort segments (painter's algorithm using mid-point depth) ---
    const sorted = segments.map((segment) => {
      const midpoint = segment.points[Math.floor(segment.points.length / 2)];
      const projected = project(
        midpoint.x,
        midpoint.y,
        midpoint.z,
        camera,
        canvasWidth,
        canvasHeight
      );
      return { segment, depth: projected ? projected.depth : Infinity };
    });
    sorted.sort((a, b) => b.depth - a.depth);

    // --- Draw segments ---
    for (const entry of sorted) {
      const segment = entry.segment;
      const isRapidMove = segment.type === MotionType.RAPID;
      const color = getSegmentColor(segment.type, mutableSettings);

      context.strokeStyle = color;
      context.lineWidth = isRapidMove
        ? Math.max(MINIMUM_THICKNESS, thickness * RAPID_THICKNESS_FACTOR)
        : thickness;
      context.globalAlpha = isRapidMove ? RAPID_OPACITY : 1.0;
      context.lineCap = 'round';
      context.lineJoin = 'round';

      if (isRapidMove) {
        context.setLineDash(RAPID_DASH_PATTERN as number[]);
      } else {
        context.setLineDash([]);
      }

      context.beginPath();
      let pathStarted = false;
      const points = segment.points;
      for (const point of points) {
        const projected = project(point.x, point.y, point.z, camera, canvasWidth, canvasHeight);
        if (!projected) {
          pathStarted = false;
          continue;
        }
        if (!pathStarted) {
          context.moveTo(projected.x, projected.y);
          pathStarted = true;
        } else {
          context.lineTo(projected.x, projected.y);
        }
      }
      context.stroke();
    }

    context.globalAlpha = 1.0;
    context.setLineDash([]);

    // --- Draw reference axes ---
    drawAxes(context, camera, canvasWidth, canvasHeight);
  }

  function scheduleRender(): void {
    if (animationFrameId === null) {
      animationFrameId = requestAnimationFrame(render);
    }
  }

  // ---------- Camera helpers ----------

  function fitView(): void {
    if (segments.length === 0) {
      return;
    }
    if (!bounds) {
      return;
    }

    const minimumX = bounds.min.x;
    const minimumY = bounds.min.y;
    const minimumZ = bounds.min.z;
    const maximumX = bounds.max.x;
    const maximumY = bounds.max.y;
    const maximumZ = bounds.max.z;

    camera.target = {
      x: (minimumX + maximumX) / 2,
      y: (minimumY + maximumY) / 2,
      z: (minimumZ + maximumZ) / 2,
    };
    const boundingSize = Math.max(maximumX - minimumX, maximumY - minimumY, maximumZ - minimumZ, 1);
    // With fov = canvas_min * 1.5, radius = size * 2.0 fits the full bounding-box
    // diagonal (sqrt(2) * size) within ~75% of the smaller canvas dimension.
    camera.radius = boundingSize * FIT_VIEW_RADIUS_FACTOR;
    camera.panX = 0;
    camera.panY = 0;
    camera.theta = DEFAULT_CAMERA_ANGLES.theta;
    camera.phi = DEFAULT_CAMERA_ANGLES.phi;
  }

  function resetView(): void {
    fitView();
    scheduleRender();
  }

  // ---------- Canvas resize ----------

  function resizeCanvas(): void {
    const wrapper = document.getElementById('canvas-wrapper')!;
    canvas.width = wrapper.clientWidth;
    canvas.height = wrapper.clientHeight;
    scheduleRender();
  }

  new ResizeObserver(resizeCanvas).observe(document.getElementById('canvas-wrapper')!);
  resizeCanvas();

  // ---------- Mouse interaction ----------

  setupInteraction(canvas, camera, scheduleRender);

  // ---------- Toolbar controls ----------

  rapidColorInput.addEventListener('input', () => {
    mutableSettings = { ...mutableSettings, rapidColor: rapidColorInput.value };
    notifySettingsChange();
    scheduleRender();
  });

  feedColorInput.addEventListener('input', () => {
    mutableSettings = { ...mutableSettings, feedColor: feedColorInput.value };
    notifySettingsChange();
    scheduleRender();
  });

  arcColorInput.addEventListener('input', () => {
    mutableSettings = { ...mutableSettings, arcColor: arcColorInput.value };
    notifySettingsChange();
    scheduleRender();
  });

  thicknessInput.addEventListener('input', () => {
    const newThickness = parseFloat(thicknessInput.value);
    mutableSettings = { ...mutableSettings, lineThickness: newThickness };
    thicknessValueLabel.textContent = thicknessInput.value;
    notifySettingsChange();
    scheduleRender();
  });

  resetButton.addEventListener('click', resetView);

  gridToggleButton.classList.toggle('active', mutableSettings.showGrid);
  gridToggleButton.addEventListener('click', () => {
    mutableSettings = { ...mutableSettings, showGrid: !mutableSettings.showGrid };
    gridToggleButton.classList.toggle('active', mutableSettings.showGrid);
    notifySettingsChange();
    scheduleRender();
  });

  function notifySettingsChange(): void {
    vscode.postMessage({ type: 'settingsChange', settings: mutableSettings });
  }

  // ---------- Error banner ----------

  function showError(message: string): void {
    errorTextElement.textContent = message;
    errorBanner.style.display = 'flex';
  }

  function hideError(): void {
    errorBanner.style.display = 'none';
    errorTextElement.textContent = '';
  }

  // ---------- Loading overlay ----------

  const loadingOverlay = document.getElementById('loading-overlay') as HTMLDivElement;

  function showLoading(): void {
    loadingOverlay.style.display = 'flex';
    emptyMessage.style.display = 'none';
  }

  function hideLoading(): void {
    loadingOverlay.style.display = 'none';
  }

  // ---------- Settings UI sync ----------

  function updateSettingsUI(incoming: Partial<VisualizerSettings>): void {
    if (incoming.rapidColor !== undefined) {
      mutableSettings = { ...mutableSettings, rapidColor: incoming.rapidColor };
      rapidColorInput.value = incoming.rapidColor;
    }
    if (incoming.feedColor !== undefined) {
      mutableSettings = { ...mutableSettings, feedColor: incoming.feedColor };
      feedColorInput.value = incoming.feedColor;
    }
    if (incoming.arcColor !== undefined) {
      mutableSettings = { ...mutableSettings, arcColor: incoming.arcColor };
      arcColorInput.value = incoming.arcColor;
    }
    if (incoming.lineThickness !== undefined) {
      mutableSettings = { ...mutableSettings, lineThickness: incoming.lineThickness };
      thicknessInput.value = String(incoming.lineThickness);
      thicknessValueLabel.textContent = String(incoming.lineThickness);
    }
    if (incoming.showGrid !== undefined) {
      mutableSettings = { ...mutableSettings, showGrid: incoming.showGrid };
      gridToggleButton.classList.toggle('active', incoming.showGrid);
    }
    if (incoming.gridSpacing !== undefined) {
      mutableSettings = { ...mutableSettings, gridSpacing: incoming.gridSpacing };
    }
  }

  // ---------- Messages from extension ----------

  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;

    if (message.type === 'update') {
      hideLoading();
      segments = message.segments || [];
      bounds = message.bounds || null;
      updateSettingsUI(message.settings || mutableSettings);
      emptyMessage.style.display = segments.length === 0 ? 'flex' : 'none';
      statsElement.textContent = segments.length > 0 ? segments.length + ' segments' : '';
      hideError();
      fitView();
      scheduleRender();
    } else if (message.type === 'updateSettings') {
      updateSettingsUI(message.settings || {});
      scheduleRender();
    } else if (message.type === 'error') {
      hideLoading();
      showError(message.message || DEFAULT_ERROR_MESSAGE);
    } else if (message.type === 'loading') {
      showLoading();
    }
  });
})();
