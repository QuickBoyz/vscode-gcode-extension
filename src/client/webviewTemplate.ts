/**
 * Webview HTML Template for the G-code 3D Visualizer
 *
 * Generates a self-contained HTML page with a pure-Canvas 2D 3D renderer.
 * No external dependencies – works completely offline.
 *
 * Interaction model
 *   Left drag   – orbit (rotate)
 *   Shift+drag  – pan
 *   Scroll      – zoom
 *   Right drag  – pan (alternative)
 */
import { randomBytes } from 'crypto';

import { VisualizerSettings } from '../visualizer/types';

/**
 * Generates a cryptographically random nonce for the Content-Security-Policy.
 */
export function generateNonce(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Builds the full HTML string for the visualizer webview.
 *
 * @param nonce    - CSP nonce for the inline <script> tag
 * @param settings - Initial colour / thickness settings
 */
export function buildWebviewHtml(nonce: string, settings: VisualizerSettings): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <title>G-Code 3D Visualizer</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100%;
      overflow: hidden;
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #cccccc);
      font-family: var(--vscode-font-family, 'Segoe UI', Tahoma, sans-serif);
      font-size: 12px;
    }
    #app {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    #toolbar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px 18px;
      padding: 7px 14px;
      background: var(--vscode-sideBar-background, #252526);
      border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
      user-select: none;
      flex-shrink: 0;
    }
    .ctrl-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .ctrl-group label {
      white-space: nowrap;
      color: var(--vscode-descriptionForeground, #999);
    }
    input[type="color"] {
      width: 28px;
      height: 22px;
      border: 1px solid var(--vscode-input-border, #555);
      border-radius: 3px;
      cursor: pointer;
      padding: 1px;
      background: transparent;
    }
    input[type="range"] {
      width: 80px;
      cursor: pointer;
      accent-color: var(--vscode-progressBar-background, #0e70c0);
    }
    .thickness-val {
      min-width: 20px;
      text-align: right;
    }
    button {
      padding: 3px 10px;
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #cccccc);
      border: 1px solid var(--vscode-button-border, #555);
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }
    button:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }
    .hint {
      color: var(--vscode-descriptionForeground, #666);
      font-size: 11px;
      white-space: nowrap;
      margin-left: auto;
    }
    #canvas-wrapper {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    #canvas {
      display: block;
      width: 100%;
      height: 100%;
      cursor: grab;
    }
    #canvas.dragging {
      cursor: grabbing;
    }
    #empty-msg {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: var(--vscode-descriptionForeground, #666);
      pointer-events: none;
      text-align: center;
      line-height: 1.8;
    }
    #stats {
      position: absolute;
      bottom: 8px;
      right: 12px;
      font-size: 10px;
      color: var(--vscode-descriptionForeground, #555);
      pointer-events: none;
    }
  </style>
</head>
<body>
<div id="app">
  <div id="toolbar">
    <div class="ctrl-group">
      <label for="rapidColor">Rapid (G0):</label>
      <input type="color" id="rapidColor" value="${settings.rapidColor}" title="Rapid move colour" />
    </div>
    <div class="ctrl-group">
      <label for="feedColor">Feed (G1):</label>
      <input type="color" id="feedColor" value="${settings.feedColor}" title="Feed move colour" />
    </div>
    <div class="ctrl-group">
      <label for="arcColor">Arc (G2/G3):</label>
      <input type="color" id="arcColor" value="${settings.arcColor}" title="Arc move colour" />
    </div>
    <div class="ctrl-group">
      <label for="thickness">Thickness:</label>
      <input type="range" id="thickness" min="0.5" max="5" step="0.5"
             value="${settings.lineThickness}" title="Line thickness" />
      <span class="thickness-val" id="thicknessVal">${settings.lineThickness}</span>
    </div>
    <button id="btnReset" title="Reset camera to fit the whole part">Reset View</button>
    <span class="hint">Left drag: rotate &nbsp;·&nbsp; Shift+drag / Right drag: pan &nbsp;·&nbsp; Scroll: zoom</span>
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

<script nonce="${nonce}">
(function () {
  'use strict';

  // ---------- VS Code API ----------
  const vscode = acquireVsCodeApi();

  // ---------- DOM refs ----------
  const canvas        = document.getElementById('canvas');
  const ctx           = canvas.getContext('2d');
  const emptyMsg      = document.getElementById('empty-msg');
  const statsEl       = document.getElementById('stats');
  const rapidColorEl  = document.getElementById('rapidColor');
  const feedColorEl   = document.getElementById('feedColor');
  const arcColorEl    = document.getElementById('arcColor');
  const thicknessEl   = document.getElementById('thickness');
  const thicknessVal  = document.getElementById('thicknessVal');
  const btnReset      = document.getElementById('btnReset');

  // ---------- Viewer state ----------
  let segments  = [];
  let bounds    = null;   // { min: {x,y,z}, max: {x,y,z} } from extension
  let settings  = {
    rapidColor:    '${settings.rapidColor}',
    feedColor:     '${settings.feedColor}',
    arcColor:      '${settings.arcColor}',
    lineThickness: ${settings.lineThickness},
  };

  // Camera / projection  (Z-up: azimuth rotates around Z, elevation tilts from horizontal)
  let theta  = -Math.PI / 4;      // azimuth: front-right view
  let phi    =  Math.PI / 5;      // elevation: 36° above the XY plane
  let radius = 200;               // orbit distance
  let panX   = 0;                 // screen-space pan X
  let panY   = 0;                 // screen-space pan Y
  let target = { x: 0, y: 0, z: 0 };  // look-at point

  // Drag state
  let dragMode    = null;   // 'orbit' | 'pan' | null
  let lastMouseX  = 0;
  let lastMouseY  = 0;

  // Cached background colour from the VS Code CSS variable
  var bgColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';

  // Resize observer handle
  let animFrameId = null;

  // ---------- 3D Math ----------

  /**
   * Projects a 3D world point to 2D canvas coordinates (Z-up convention).
   *
   * Rotation order:
   *   1. Azimuth (theta) around the Z axis
   *   2. Elevation (phi) around the X axis
   *
   * After rotation the axes map to:
   *   x2 → screen horizontal
   *   z2 → screen vertical (negated so Z-up = canvas-up)
   *   y2 → depth (into the screen)
   *
   * Returns null when the point is behind the camera.
   */
  function project(px, py, pz) {
    // Translate to camera-relative
    const dx = px - target.x;
    const dy = py - target.y;
    const dz = pz - target.z;

    // Rotate around Z axis (azimuth)
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const x1 =  dx * cosT + dy * sinT;
    const y1 = -dx * sinT + dy * cosT;

    // Rotate around X axis (elevation)
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);
    const y2 = y1 * cosP - dz * sinP;
    const z2 = y1 * sinP + dz * cosP;

    // Perspective divide (y2 is the depth axis in Z-up convention)
    const depth = radius + y2;
    if (depth < 0.01) return null;

    // Canvas-based FOV: at the default orbit distance the geometry fills ~70%
    // of the smaller canvas dimension.  Using a constant canvas-based value
    // (rather than radius*K) means perspective scale is correct and zoom
    // works by varying radius/depth only.
    const fov   = Math.min(canvas.width, canvas.height) * 1.5;
    const scale = fov / depth;

    return {
      x: canvas.width  / 2 + panX + x1 * scale,
      y: canvas.height / 2 + panY - z2 * scale,
      depth,
    };
  }

  // ---------- Rendering ----------

  function getSegmentColor(type) {
    switch (type) {
      case 'rapid':   return settings.rapidColor;
      case 'feed':    return settings.feedColor;
      case 'arc_cw':
      case 'arc_ccw': return settings.arcColor;
      default:        return '#aaaaaa';
    }
  }

  function isRapid(type) {
    return type === 'rapid';
  }

  function render() {
    animFrameId = null;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background – uses the VS Code editor background colour
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    if (segments.length === 0) return;

    const thickness = Math.max(0.5, settings.lineThickness);

    // --- Depth-sort segments (painter's algorithm using mid-point depth) ---
    const sorted = segments.map(function (seg) {
      const mid = seg.points[Math.floor(seg.points.length / 2)];
      const p   = project(mid.x, mid.y, mid.z);
      return { seg: seg, depth: p ? p.depth : Infinity };
    });
    sorted.sort(function (a, b) { return b.depth - a.depth; });

    // --- Draw segments ---
    for (let si = 0; si < sorted.length; si++) {
      const seg   = sorted[si].seg;
      const rapid = isRapid(seg.type);
      const color = getSegmentColor(seg.type);

      ctx.strokeStyle   = color;
      ctx.lineWidth     = rapid ? Math.max(0.5, thickness * 0.5) : thickness;
      ctx.globalAlpha   = rapid ? 0.45 : 1.0;
      ctx.lineCap       = 'round';
      ctx.lineJoin      = 'round';

      if (rapid) {
        ctx.setLineDash([5, 6]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      let pathStarted = false;
      const pts = seg.points;
      for (let pi = 0; pi < pts.length; pi++) {
        const p = project(pts[pi].x, pts[pi].y, pts[pi].z);
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

    // --- Draw reference axes ---
    drawAxes();
  }

  function drawAxes() {
    const axisLen = radius * 0.12;
    const origin  = project(target.x, target.y, target.z);
    if (!origin) return;

    const axes = [
      { label: 'X', dx: axisLen, dy: 0,      dz: 0,      color: '#e05555' },
      { label: 'Y', dx: 0,       dy: axisLen, dz: 0,      color: '#55bb55' },
      { label: 'Z', dx: 0,       dy: 0,       dz: axisLen, color: '#5588ff' },
    ];

    ctx.lineWidth   = 1.5;
    ctx.globalAlpha = 0.8;

    for (let i = 0; i < axes.length; i++) {
      const ax = axes[i];
      const tip = project(target.x + ax.dx, target.y + ax.dy, target.z + ax.dz);
      if (!tip) continue;

      ctx.strokeStyle = ax.color;
      ctx.fillStyle   = ax.color;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();

      ctx.font = 'bold 11px monospace';
      ctx.fillText(ax.label, tip.x + 3, tip.y + 3);
    }

    ctx.globalAlpha = 1.0;
  }

  function scheduleRender() {
    if (animFrameId === null) {
      animFrameId = requestAnimationFrame(render);
    }
  }

  // ---------- Camera helpers ----------

  function fitView() {
    if (segments.length === 0) return;
    if (!bounds) return;

    var minX = bounds.min.x;
    var minY = bounds.min.y;
    var minZ = bounds.min.z;
    var maxX = bounds.max.x;
    var maxY = bounds.max.y;
    var maxZ = bounds.max.z;

    target = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2,
    };
    const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1);
    // With fov = canvas_min * 1.5, radius = size * 2.0 fits the full bounding-box
    // diagonal (sqrt(2) * size) within ~75% of the smaller canvas dimension.
    radius = size * 2.0;
    panX   = 0;
    panY   = 0;
    theta  = -Math.PI / 4;
    phi    =  Math.PI / 5;
  }

  function resetView() {
    fitView();
    scheduleRender();
  }

  // ---------- Canvas resize ----------

  function resizeCanvas() {
    const wrapper  = document.getElementById('canvas-wrapper');
    canvas.width   = wrapper.clientWidth;
    canvas.height  = wrapper.clientHeight;
    scheduleRender();
  }

  new ResizeObserver(resizeCanvas).observe(document.getElementById('canvas-wrapper'));
  resizeCanvas();

  // ---------- Mouse interaction ----------

  canvas.addEventListener('mousedown', function (e) {
    if (e.button === 0) {
      dragMode = e.shiftKey ? 'pan' : 'orbit';
    } else if (e.button === 1 || e.button === 2) {
      dragMode = 'pan';
    }
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    canvas.classList.add('dragging');
    e.preventDefault();
  });

  window.addEventListener('mousemove', function (e) {
    if (!dragMode) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    if (dragMode === 'orbit') {
      theta -= dx * 0.008;
      phi = Math.max(-Math.PI / 2 + 0.01,
                Math.min(Math.PI / 2 - 0.01, phi + dy * 0.008));
    } else {
      panX += dx;
      panY += dy;
    }
    scheduleRender();
  });

  window.addEventListener('mouseup', function () {
    dragMode = null;
    canvas.classList.remove('dragging');
  });

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.12 : 0.89;
    radius = Math.max(0.01, radius * factor);
    scheduleRender();
  }, { passive: false });

  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---------- Toolbar controls ----------

  rapidColorEl.addEventListener('input', function () {
    settings.rapidColor = rapidColorEl.value;
    notifySettingsChange();
    scheduleRender();
  });

  feedColorEl.addEventListener('input', function () {
    settings.feedColor = feedColorEl.value;
    notifySettingsChange();
    scheduleRender();
  });

  arcColorEl.addEventListener('input', function () {
    settings.arcColor = arcColorEl.value;
    notifySettingsChange();
    scheduleRender();
  });

  thicknessEl.addEventListener('input', function () {
    settings.lineThickness = parseFloat(thicknessEl.value);
    thicknessVal.textContent = thicknessEl.value;
    notifySettingsChange();
    scheduleRender();
  });

  btnReset.addEventListener('click', resetView);

  function notifySettingsChange() {
    vscode.postMessage({ type: 'settingsChange', settings: settings });
  }

  // ---------- Messages from extension ----------

  window.addEventListener('message', function (event) {
    const msg = event.data;

    if (msg.type === 'update') {
      segments = msg.segments || [];
      bounds = msg.bounds || null;
      updateSettingsUI(msg.settings || settings);
      emptyMsg.style.display = segments.length === 0 ? 'flex' : 'none';
      statsEl.textContent =
        segments.length > 0
          ? segments.length + ' segments'
          : '';
      fitView();
      scheduleRender();
    } else if (msg.type === 'updateSettings') {
      updateSettingsUI(msg.settings || {});
      scheduleRender();
    }
  });

  function updateSettingsUI(s) {
    if (s.rapidColor    !== undefined) { settings.rapidColor    = s.rapidColor;    rapidColorEl.value      = s.rapidColor; }
    if (s.feedColor     !== undefined) { settings.feedColor     = s.feedColor;     feedColorEl.value       = s.feedColor; }
    if (s.arcColor      !== undefined) { settings.arcColor      = s.arcColor;      arcColorEl.value        = s.arcColor; }
    if (s.lineThickness !== undefined) {
      settings.lineThickness    = s.lineThickness;
      thicknessEl.value         = String(s.lineThickness);
      thicknessVal.textContent  = String(s.lineThickness);
    }
  }

})();
</script>
</body>
</html>`;
}
