/**
 * Main entry point for the G-code 3D visualizer webview.
 *
 * This module wires together projection, axes drawing, and interaction
 * handling.  It manages the render loop, toolbar controls, and message
 * passing with the VS Code extension host.
 *
 * Built as a self-contained IIFE — no exports.
 */

import {
  MotionType,
  PathBounds,
  PathSegment,
  ProjectionMode,
  VisualizerConfig,
} from '../shared/visualizerTypes';
import { CameraState } from './types';
import { createCameraState, DEFAULT_CAMERA_ANGLES, project } from './projection';
import { drawAxes } from './axes';
import { drawGrid } from './grid';
import { setupInteraction } from './interaction';
import { hitTestSegments, ProjectedSegmentData } from './hitTesting';

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

/** Maximum distance in canvas pixels for a hit test to register. */
const HIT_TEST_TOLERANCE = 8;

/** Line thickness multiplier for the hover highlight on the overlay. */
const HOVER_THICKNESS_FACTOR = 3.0;

/** Alpha value for the hover highlight glow. */
const HOVER_ALPHA = 0.5;

/** Shadow blur radius for the hover highlight. */
const HOVER_SHADOW_BLUR = 6;

/** Dwell time in milliseconds before showing the info panel. */
const DWELL_DELAY_MS = 80;

/** Horizontal offset (in CSS pixels) from the cursor to the info panel. */
const INFO_PANEL_OFFSET_X = 16;

/** Vertical offset (in CSS pixels) from the cursor to the info panel. */
const INFO_PANEL_OFFSET_Y = 8;

/** Grace zone delay in ms — time allowed for cursor to reach the tooltip. */
const GRACE_ZONE_DELAY_MS = 300;

// ---------------------------------------------------------------------------
// Colour mapping
// ---------------------------------------------------------------------------

/**
 * Returns the user-configured colour for a given motion type.
 */
function getSegmentColor(motionType: MotionType, settings: VisualizerConfig): string {
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
  const overlay = document.getElementById('overlay') as HTMLCanvasElement;
  const overlayContext = overlay.getContext('2d')!;
  const emptyMessage = document.getElementById('empty-msg') as HTMLDivElement;
  const statsElement = document.getElementById('stats') as HTMLDivElement;
  const rapidColorInput = document.getElementById('rapidColor') as HTMLInputElement;
  const feedColorInput = document.getElementById('feedColor') as HTMLInputElement;
  const arcColorInput = document.getElementById('arcColor') as HTMLInputElement;
  const thicknessInput = document.getElementById('thickness') as HTMLInputElement;
  const thicknessValueLabel = document.getElementById('thicknessVal') as HTMLSpanElement;
  const resetButton = document.getElementById('btnReset') as HTMLButtonElement;
  const gridToggleButton = document.getElementById('btnToggleGrid') as HTMLButtonElement;
  const rapidToggleButton = document.getElementById('btnToggleRapid') as HTMLButtonElement;
  const projectionToggleButton = document.getElementById(
    'btnToggleProjection'
  ) as HTMLButtonElement;
  const errorBanner = document.getElementById('error-banner') as HTMLDivElement;
  const errorTextElement = document.getElementById('error-text') as HTMLSpanElement;
  const infoPanel = document.getElementById('info-panel') as HTMLDivElement;
  const infoTypeElement = document.getElementById('info-type') as HTMLDivElement;
  const infoSourceElement = document.getElementById('info-source') as HTMLDivElement;
  const infoFeedElement = document.getElementById('info-feed') as HTMLDivElement;
  const infoSpindleElement = document.getElementById('info-spindle') as HTMLDivElement;
  const infoCoordsElement = document.getElementById('info-coords') as HTMLDivElement;
  const infoExtraElement = document.getElementById('info-extra') as HTMLDivElement;
  const infoGotoLink = document.getElementById('info-goto') as HTMLButtonElement;

  // ---------- Viewer state ----------

  let segments: PathSegment[] = [];
  let bounds: PathBounds | null = null;
  const settings: VisualizerConfig = {
    rapidColor: rapidColorInput.value,
    feedColor: feedColorInput.value,
    arcColor: arcColorInput.value,
    lineThickness: parseFloat(thicknessInput.value),
    showGrid: true,
    gridSpacing: 10,
    showRapidMoves: true,
    projection: ProjectionMode.PERSPECTIVE,
  };
  // Mutable copy that we update from toolbar / messages
  let mutableSettings = { ...settings };

  const camera: CameraState = createCameraState();
  let animationFrameId: number | null = null;

  /** Projected 2D polylines cached during each render pass for hit testing. */
  let projectedSegmentCache: ProjectedSegmentData[] = [];

  /** Index of the segment currently under the cursor (null when none). */
  let hoveredSegmentIndex: number | null = null;

  /** Source file lines from the most recent update message. */
  let sourceLines: readonly string[] | undefined;

  /** Pending mouse position for rAF-gated hit testing. */
  let pendingHitTestX = 0;
  let pendingHitTestY = 0;
  let hitTestScheduled = false;

  /** Dwell timer for showing the info panel after the cursor pauses. */
  let dwellTimer: ReturnType<typeof setTimeout> | undefined;

  /** Last raw mouse position (CSS pixels) for anchoring the info panel. */
  let lastMouseClientX = 0;
  let lastMouseClientY = 0;

  /** Grace zone dismiss timer — allows cursor to reach the tooltip. */
  let graceZoneTimer: ReturnType<typeof setTimeout> | undefined;

  /** Whether the cursor is currently inside the info panel. */
  let cursorInInfoPanel = false;

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
      drawGrid(
        context,
        camera,
        canvasWidth,
        canvasHeight,
        bounds,
        mutableSettings.gridSpacing,
        mutableSettings.projection
      );
    }

    if (segments.length === 0) {
      return;
    }

    const thickness = Math.max(MINIMUM_THICKNESS, mutableSettings.lineThickness);

    const projectionMode = mutableSettings.projection;

    // --- Depth-sort segments (painter's algorithm using mid-point depth) ---
    const sorted = segments.map((segment) => {
      const midpoint = segment.points[Math.floor(segment.points.length / 2)];
      const projected = project(
        midpoint.x,
        midpoint.y,
        midpoint.z,
        camera,
        canvasWidth,
        canvasHeight,
        projectionMode
      );
      return { segment, depth: projected ? projected.depth : Infinity };
    });
    sorted.sort((a, b) => b.depth - a.depth);

    // --- Draw segments and build projected segment cache ---
    const newProjectedCache: ProjectedSegmentData[] = [];

    for (const entry of sorted) {
      const segment = entry.segment;
      const isRapidMove = segment.type === MotionType.RAPID;

      // Skip rapid moves when the user has toggled them off
      if (isRapidMove && !mutableSettings.showRapidMoves) {
        continue;
      }
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
      const projectedPoints: { x: number; y: number }[] = [];
      for (const point of points) {
        const projected = project(
          point.x,
          point.y,
          point.z,
          camera,
          canvasWidth,
          canvasHeight,
          projectionMode
        );
        if (!projected) {
          pathStarted = false;
          continue;
        }
        projectedPoints.push({ x: projected.x, y: projected.y });
        if (!pathStarted) {
          context.moveTo(projected.x, projected.y);
          pathStarted = true;
        } else {
          context.lineTo(projected.x, projected.y);
        }
      }
      context.stroke();

      // Cache projected points for hit testing (use original segment index)
      if (projectedPoints.length >= 2) {
        const segmentIndex = segments.indexOf(entry.segment);
        newProjectedCache.push({ segmentIndex, points: projectedPoints });
      }
    }

    projectedSegmentCache = newProjectedCache;
    context.globalAlpha = 1.0;
    context.setLineDash([]);

    // --- Draw reference axes ---
    drawAxes(context, camera, canvasWidth, canvasHeight, mutableSettings.projection);
  }

  function scheduleRender(): void {
    if (animationFrameId === null) {
      animationFrameId = requestAnimationFrame(render);
    }
  }

  /**
   * Redraws the overlay canvas with the current hover highlight.
   * Reads from the projected segment cache — no reprojection needed.
   */
  function renderOverlay(): void {
    const overlayWidth = overlay.width;
    const overlayHeight = overlay.height;
    overlayContext.clearRect(0, 0, overlayWidth, overlayHeight);

    if (hoveredSegmentIndex === null || hoveredSegmentIndex >= segments.length) {
      return;
    }

    // Find the projected data for the hovered segment
    const cached = projectedSegmentCache.find((c) => c.segmentIndex === hoveredSegmentIndex);
    if (!cached || cached.points.length < 2) {
      return;
    }

    const segment = segments[hoveredSegmentIndex];
    const color = getSegmentColor(segment.type, mutableSettings);
    const thickness = Math.max(MINIMUM_THICKNESS, mutableSettings.lineThickness);

    overlayContext.save();
    overlayContext.strokeStyle = color;
    overlayContext.lineWidth = thickness * HOVER_THICKNESS_FACTOR;
    overlayContext.globalAlpha = HOVER_ALPHA;
    overlayContext.lineCap = 'round';
    overlayContext.lineJoin = 'round';
    overlayContext.shadowColor = color;
    overlayContext.shadowBlur = HOVER_SHADOW_BLUR;
    overlayContext.setLineDash([]);

    overlayContext.beginPath();
    overlayContext.moveTo(cached.points[0].x, cached.points[0].y);
    for (let i = 1; i < cached.points.length; i++) {
      overlayContext.lineTo(cached.points[i].x, cached.points[i].y);
    }
    overlayContext.stroke();
    overlayContext.restore();
  }

  // ---------- Info panel (dwell tooltip) ----------

  function formatMotionType(type: MotionType): string {
    switch (type) {
      case MotionType.RAPID:
        return 'Rapid (G0)';
      case MotionType.FEED:
        return 'Feed (G1)';
      case MotionType.ARC_CW:
        return 'Arc CW (G2)';
      case MotionType.ARC_CCW:
        return 'Arc CCW (G3)';
      default:
        return 'Unknown';
    }
  }

  function showInfoPanel(segmentIndex: number): void {
    const segment = segments[segmentIndex];
    const motionContext = segment.context;

    infoTypeElement.textContent = formatMotionType(segment.type);

    if (motionContext) {
      const lineText = sourceLines?.[motionContext.sourceLine];
      infoSourceElement.textContent =
        lineText !== undefined
          ? `Line ${motionContext.sourceLine + 1}: ${lineText.trim()}`
          : `Line ${motionContext.sourceLine + 1}`;
      infoFeedElement.textContent =
        motionContext.feedRate !== null ? `Feed: ${motionContext.feedRate}` : '';
      infoSpindleElement.textContent =
        motionContext.spindleSpeed !== null ? `Spindle: ${motionContext.spindleSpeed}` : '';
    } else {
      infoSourceElement.textContent = '';
      infoFeedElement.textContent = '';
      infoSpindleElement.textContent = '';
    }

    // Display extra axes (I, J, K, etc.) when present
    const extraParams = motionContext?.extraParams;
    if (extraParams && Object.keys(extraParams).length > 0) {
      infoExtraElement.textContent = Object.entries(extraParams)
        .map(([axis, value]) => `${axis}:${value.toFixed(3)}`)
        .join(' ');
    } else {
      infoExtraElement.textContent = '';
    }

    const startPoint = segment.points[0];
    const endPoint = segment.points[segment.points.length - 1];
    infoCoordsElement.textContent =
      `X:${startPoint.x.toFixed(3)} Y:${startPoint.y.toFixed(3)} Z:${startPoint.z.toFixed(3)}` +
      ` → ` +
      `X:${endPoint.x.toFixed(3)} Y:${endPoint.y.toFixed(3)} Z:${endPoint.z.toFixed(3)}`;

    // Position the panel to the left of the cursor, flip if near left edge
    const wrapper = document.getElementById('canvas-wrapper')!;
    const wrapperRect = wrapper.getBoundingClientRect();
    const cursorX = lastMouseClientX - wrapperRect.left;
    const cursorY = lastMouseClientY - wrapperRect.top;

    // Temporarily show to measure dimensions
    infoPanel.style.display = 'block';
    infoPanel.style.left = '0';
    infoPanel.style.top = '0';
    const panelWidth = infoPanel.offsetWidth;
    const panelHeight = infoPanel.offsetHeight;

    // Default: anchor to the left of cursor
    let panelX = cursorX - panelWidth - INFO_PANEL_OFFSET_X;
    if (panelX < 0) {
      // Flip to the right
      panelX = cursorX + INFO_PANEL_OFFSET_X;
    }

    let panelY = cursorY - INFO_PANEL_OFFSET_Y;
    // Keep within vertical bounds
    if (panelY + panelHeight > wrapperRect.height) {
      panelY = wrapperRect.height - panelHeight;
    }
    if (panelY < 0) {
      panelY = 0;
    }

    infoPanel.style.left = `${panelX}px`;
    infoPanel.style.top = `${panelY}px`;
    infoPanel.style.pointerEvents = 'auto';

    // Show "Go to line N" link when context is available
    if (motionContext) {
      infoGotoLink.textContent = `Go to line ${motionContext.sourceLine + 1}`;
      infoGotoLink.style.display = 'block';
      infoGotoLink.dataset.line = String(motionContext.sourceLine);
    } else {
      infoGotoLink.style.display = 'none';
    }
  }

  function hideInfoPanel(): void {
    infoPanel.style.display = 'none';
    infoPanel.style.pointerEvents = 'none';
    cursorInInfoPanel = false;
  }

  function clearGraceZoneTimer(): void {
    if (graceZoneTimer !== undefined) {
      clearTimeout(graceZoneTimer);
      graceZoneTimer = undefined;
    }
  }

  /**
   * Starts the grace zone dismiss timer. If the cursor doesn't enter
   * the info panel within the grace period, the panel is hidden.
   */
  function startGraceZoneDismiss(): void {
    clearGraceZoneTimer();
    graceZoneTimer = setTimeout(() => {
      graceZoneTimer = undefined;
      if (!cursorInInfoPanel) {
        hideInfoPanel();
      }
    }, GRACE_ZONE_DELAY_MS);
  }

  // Info panel mouse events — keep panel open while cursor is inside
  infoPanel.addEventListener('mouseenter', () => {
    cursorInInfoPanel = true;
    clearGraceZoneTimer();
    clearDwellTimer();
  });

  infoPanel.addEventListener('mouseleave', () => {
    cursorInInfoPanel = false;
    clearGraceZoneTimer();
    hideInfoPanel();
  });

  // "Go to line" link click — post navigation message to extension
  infoGotoLink.addEventListener('click', () => {
    const line = infoGotoLink.dataset.line;
    if (line !== undefined) {
      vscode.postMessage({ type: 'navigateToLine', line: parseInt(line, 10) });
    }
  });

  function clearDwellTimer(): void {
    if (dwellTimer !== undefined) {
      clearTimeout(dwellTimer);
      dwellTimer = undefined;
    }
  }

  function startDwellTimer(): void {
    clearDwellTimer();
    if (hoveredSegmentIndex !== null) {
      const segmentIndex = hoveredSegmentIndex;
      dwellTimer = setTimeout(() => {
        dwellTimer = undefined;
        // Only show if still hovering the same segment
        if (hoveredSegmentIndex === segmentIndex) {
          showInfoPanel(segmentIndex);
        }
      }, DWELL_DELAY_MS);
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
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    canvas.width = width;
    canvas.height = height;
    overlay.width = width;
    overlay.height = height;
    scheduleRender();
  }

  new ResizeObserver(resizeCanvas).observe(document.getElementById('canvas-wrapper')!);
  resizeCanvas();

  // ---------- Mouse interaction ----------

  const interaction = setupInteraction(canvas, camera, scheduleRender);

  // ---------- Hit testing (rAF-gated) ----------

  /**
   * Converts a MouseEvent to canvas-local coordinates accounting for DPI.
   */
  function canvasCoords(event: MouseEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function processHitTest(): void {
    hitTestScheduled = false;
    const hit = hitTestSegments(
      pendingHitTestX,
      pendingHitTestY,
      projectedSegmentCache,
      HIT_TEST_TOLERANCE
    );
    const newIndex = hit ? hit.segmentIndex : null;

    if (newIndex !== hoveredSegmentIndex) {
      hoveredSegmentIndex = newIndex;
      canvas.style.cursor = hoveredSegmentIndex !== null ? 'pointer' : 'grab';
      renderOverlay();
    }

    // Always restart the dwell timer when hovering a segment.
    // The mousemove handler clears the timer on every move, so we
    // must restart it here even if the segment hasn't changed.
    startDwellTimer();
  }

  canvas.addEventListener('mousemove', (event: MouseEvent) => {
    lastMouseClientX = event.clientX;
    lastMouseClientY = event.clientY;

    if (interaction.isDragging()) {
      if (hoveredSegmentIndex !== null) {
        hoveredSegmentIndex = null;
        clearDwellTimer();
        clearGraceZoneTimer();
        hideInfoPanel();
        renderOverlay();
      }
      return;
    }

    // Any movement resets the dwell timer.
    // If the info panel is visible, start the grace zone timer
    // instead of hiding immediately — gives the user time to
    // move the cursor into the panel.
    clearDwellTimer();
    if (infoPanel.style.display === 'block' && !cursorInInfoPanel) {
      startGraceZoneDismiss();
    } else if (!cursorInInfoPanel) {
      hideInfoPanel();
    }

    const { x, y } = canvasCoords(event);
    pendingHitTestX = x;
    pendingHitTestY = y;
    if (!hitTestScheduled) {
      hitTestScheduled = true;
      requestAnimationFrame(processHitTest);
    }
  });

  canvas.addEventListener('mouseleave', () => {
    clearDwellTimer();
    // When the cursor leaves the canvas it may be entering the info panel.
    // mouseleave fires BEFORE mouseenter on the panel, so cursorInInfoPanel
    // is still false. Use the grace zone timer to give the panel's
    // mouseenter a chance to fire before we dismiss.
    if (infoPanel.style.display === 'block' && !cursorInInfoPanel) {
      startGraceZoneDismiss();
    } else if (!cursorInInfoPanel) {
      hideInfoPanel();
    }
    if (hoveredSegmentIndex !== null) {
      hoveredSegmentIndex = null;
      canvas.style.cursor = 'grab';
      renderOverlay();
    }
  });

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

  rapidToggleButton.classList.toggle('active', mutableSettings.showRapidMoves);
  rapidToggleButton.addEventListener('click', () => {
    mutableSettings = { ...mutableSettings, showRapidMoves: !mutableSettings.showRapidMoves };
    rapidToggleButton.classList.toggle('active', mutableSettings.showRapidMoves);
    notifySettingsChange();
    scheduleRender();
  });

  projectionToggleButton.textContent =
    mutableSettings.projection === ProjectionMode.PERSPECTIVE ? 'Persp' : 'Ortho';
  projectionToggleButton.addEventListener('click', () => {
    const isCurrentlyPerspective = mutableSettings.projection === ProjectionMode.PERSPECTIVE;
    const newProjection = isCurrentlyPerspective
      ? ProjectionMode.ORTHOGRAPHIC
      : ProjectionMode.PERSPECTIVE;
    mutableSettings = { ...mutableSettings, projection: newProjection };
    projectionToggleButton.textContent = isCurrentlyPerspective ? 'Ortho' : 'Persp';
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

  function updateSettingsUI(incoming: Partial<VisualizerConfig>): void {
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
    if (incoming.showRapidMoves !== undefined) {
      mutableSettings = { ...mutableSettings, showRapidMoves: incoming.showRapidMoves };
      rapidToggleButton.classList.toggle('active', incoming.showRapidMoves);
    }
    if (incoming.projection !== undefined) {
      mutableSettings = { ...mutableSettings, projection: incoming.projection };
      projectionToggleButton.textContent =
        incoming.projection === ProjectionMode.PERSPECTIVE ? 'Persp' : 'Ortho';
    }
  }

  // ---------- Messages from extension ----------

  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;

    if (message.type === 'update') {
      hideLoading();
      segments = message.segments || [];
      bounds = message.bounds || null;
      sourceLines = message.sourceLines;
      // Clear stale hover / dwell state
      hoveredSegmentIndex = null;
      projectedSegmentCache = [];
      clearDwellTimer();
      clearGraceZoneTimer();
      hideInfoPanel();
      canvas.style.cursor = 'grab';
      renderOverlay();
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
