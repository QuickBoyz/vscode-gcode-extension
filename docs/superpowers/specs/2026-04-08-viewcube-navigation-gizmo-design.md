# ViewCube Navigation Gizmo — Design Spec

**Issue:** #121
**Date:** 2026-04-08

## Problem

The 3D visualizer only supports orbit/pan/zoom via mouse interaction. There is no quick way to snap to standard orthographic views (Top, Front, Right, etc.). Users familiar with CAD tools expect a navigation cube (ViewCube) for this.

## Solution

A CSS 3D navigation cube rendered as an HTML overlay in the top-right corner of the canvas area. Clicking a face or edge animates the camera to the corresponding predefined view. Dragging the cube orbits the main camera.

## Decisions

| Decision        | Choice                                     | Rationale                                                                                                                |
| --------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Interactivity   | Faces + edges (18 targets) + drag-to-orbit | Good balance — covers orthographic and 45° diagonal views without corner complexity                                      |
| Rendering       | CSS 3D transforms                          | Browser handles projection, depth, text, and click events natively. Avoids reimplementing 3D polygon rendering on canvas |
| Visual style    | Near-opaque (alpha ~0.85)                  | Mostly solid faces with subtle transparency. Not distracting but clearly visible                                         |
| Edge appearance | 1px default, 2px on hover                  | Thin visible lines with wider invisible hit area (~12px) for usability                                                   |
| Animation       | 100ms ease-out                             | Fast and snappy. Smooth enough to preserve spatial context                                                               |

## Architecture

### New files

- `src/webview/components/ViewCube.tsx` — React component rendering the CSS 3D cube
- `src/webview/viewCube/views.ts` — View angle definitions (face/edge name → target theta/phi)
- `src/webview/animation.ts` — Camera animation function (theta/phi interpolation over time)

### Modified files

- `src/webview/components/CanvasArea.tsx` — Add `<ViewCube />` as sibling to `<ToolPathCanvas />`
- `src/webview/interaction.ts` — Add animation cancel callback when orbit/pan drag starts
- `src/webview/styles.scss` — ViewCube styles
- `src/webview/types.ts` — Export animation-related types if needed

## CSS 3D Cube Structure

A container div with `perspective` wrapping an inner element with `transform-style: preserve-3d`. The inner element's `transform` is synced to the camera state: `rotateX(-phi) rotateZ(-theta)`.

### Face elements (6)

Each face is a div positioned with `translateZ`/`rotateX`/`rotateY` to form a cube. Each face has:

- Centered label text ("TOP", "FRONT", "RIGHT", "BACK", "LEFT", "BOTTOM")
- `backface-visibility: hidden` so only the front-facing side is visible
- Click handler that triggers camera animation to the face's predefined view

### Edge elements (12)

Each edge is a narrow rectangular div positioned at the boundary between two adjacent faces using CSS 3D transforms. Each edge has:

- Visible line: 1px default, 2px on hover
- Invisible hit area: ~12px wide for usability (transparent padding or wider element with transparent background)
- Click handler that triggers camera animation to the midpoint view between the two adjacent faces

### Edges enumeration

Horizontal edges (connecting faces at same elevation):

- Front-Right, Front-Left, Back-Right, Back-Left

Vertical edges (connecting faces at same azimuth):

- Front-Top, Front-Bottom, Back-Top, Back-Bottom, Right-Top, Right-Bottom, Left-Top, Left-Bottom

## Visual Style

### Size

- Cube: ~90px per side
- Container: ~120px (room for labels to not clip during rotation)
- Position: `position: absolute; top: 12px; right: 12px;` inside `#canvas-wrapper`

### Colors (dark theme)

- Face background: `rgba(60, 63, 70, 0.85)` — near-opaque dark
- Face border: `1px solid rgba(150, 150, 150, 0.3)`
- Label text: `rgba(200, 200, 200, 0.8)`
- Edge line: `rgba(150, 150, 150, 0.4)`
- Hover face: brighter background, full opacity labels
- Hover edge: 2px width, brighter color

### Colors (light theme)

- Adapted via `.vscode-light` class
- Face background: `rgba(220, 222, 228, 0.85)`
- Label text: `rgba(60, 60, 60, 0.8)`

### Pointer behavior

- `cursor: pointer` on face/edge hover (when not dragging)
- `cursor: grabbing` during cube drag
- `pointer-events: auto` on the cube container (rest of overlay is `pointer-events: none`)

## Camera Sync

### Canvas → Cube (orbit updates cube)

The `ViewCube` component reads theta/phi from the camera state. Since the camera is mutated in place by `setupInteraction`, the component needs a way to know when to re-read. The existing `scheduleRender` callback fires on every camera change — `ViewCube` can subscribe to the same trigger.

Implementation: `ViewCube` receives the camera ref and applies CSS transform on each render frame. The render loop (or a separate `requestAnimationFrame` tied to camera changes) updates the cube's transform.

### Cube → Canvas (click animates camera)

Clicking a face/edge calls the animation function with the target theta/phi. The animation:

1. Reads current theta/phi from the camera state
2. Computes shortest angular path for theta (wrapping around ±π)
3. Runs a `requestAnimationFrame` loop for 100ms
4. Each frame: interpolates theta/phi with ease-out, mutates the camera state, calls `scheduleRender()`
5. On completion: snaps to exact target values

### Cube → Canvas (drag orbits camera)

Dragging the cube orbits the main camera — same behavior as dragging on the main canvas. The cube's drag handler applies the same orbit sensitivity (`0.008 rad/px`) and phi clamping (`±π/2 - 0.01`) as the main canvas interaction in `interaction.ts`.

Click vs drag is distinguished by a ~3px distance threshold: if the mouse moves beyond the threshold before mouseup, it's a drag (orbit); otherwise it's a click on the face/edge under the cursor.

During a cube drag:

- The main canvas re-renders each frame (via `scheduleRender`)
- The cube's CSS transform updates in sync (reads same camera state)
- Any in-progress click animation is cancelled

## Animation Module

### `animateCamera(camera, target, duration, onFrame, onComplete?)`

Pure imperative function (not a hook). Parameters:

- `camera: CameraState` — the mutable camera object
- `target: { theta: number; phi: number }` — destination angles
- `duration: number` — animation duration in ms (100)
- `onFrame: () => void` — called each frame to trigger re-render (`scheduleRender`)
- `onComplete?: () => void` — optional callback when animation finishes

Returns: `() => void` — cancel function

### Shortest path interpolation

```
deltaTheta = targetTheta - currentTheta
// Normalize to [-π, π] for shortest path
deltaTheta = ((deltaTheta + π) mod 2π) - π
```

### Easing

Ease-out: `1 - (1 - t)²` where `t` is normalized progress `[0, 1]`.

### Cancellation

The cancel function is called when:

- A new face/edge is clicked (new animation replaces old)
- The user starts an orbit or pan drag on the main canvas (interaction.ts calls cancel)
- The user starts dragging the cube itself
- The component unmounts

## View Angle Map

### Faces (6)

| Face   | Theta (θ) | Phi (φ)     |
| ------ | --------- | ----------- |
| Front  | 0         | 0           |
| Back   | π         | 0           |
| Right  | -π/2      | 0           |
| Left   | π/2       | 0           |
| Top    | 0         | π/2 - 0.01  |
| Bottom | 0         | -π/2 + 0.01 |

Top/Bottom phi uses ±(π/2 - 0.01) to match the existing `POLE_MARGIN` constant and prevent gimbal lock.

### Edges (12)

| Edge         | Theta (θ) | Phi (φ) |
| ------------ | --------- | ------- |
| Front-Top    | 0         | π/4     |
| Front-Bottom | 0         | -π/4    |
| Front-Right  | -π/4      | 0       |
| Front-Left   | π/4       | 0       |
| Back-Top     | π         | π/4     |
| Back-Bottom  | π         | -π/4    |
| Back-Right   | -3π/4     | 0       |
| Back-Left    | 3π/4      | 0       |
| Right-Top    | -π/2      | π/4     |
| Right-Bottom | -π/2      | -π/4    |
| Left-Top     | π/2       | π/4     |
| Left-Bottom  | π/2       | -π/4    |

## Integration

### Component placement

`ViewCube` is added inside `#canvas-wrapper` (in `CanvasArea.tsx`) as a positioned HTML element, not on any canvas. It sits above the overlay canvas via z-index.

### Camera access

`ViewCube` accesses the camera state through `VisualizerContext` — the same context that `ToolPathCanvas` uses. It needs:

- Read access to `camera.theta` and `camera.phi` (for syncing cube rotation)
- The `scheduleRender` callback (to trigger re-renders during animation and cube drag)
- A way to register/deregister the animation cancel function with `setupInteraction`

### Interaction cancel hook

`setupInteraction` in `interaction.ts` needs a new optional callback parameter `onDragStart?: () => void` that fires when orbit/pan begins on the main canvas. `ViewCube` passes its animation cancel function through this hook.

Alternatively, the cancel function can be stored in a ref accessible from the interaction setup, or the `CameraControls` interface can be extended with `cancelAnimation`.

## Testing

### Unit tests

- `animation.ts` — test interpolation math, shortest path wrapping, ease-out curve, cancellation
- `views.ts` — test that all 18 view definitions have valid theta/phi values within expected ranges

### Manual testing

- Verify cube rotates in sync when orbiting the main canvas
- Verify clicking each face snaps to correct orthographic view
- Verify clicking each edge snaps to correct 45° view
- Verify dragging the cube orbits the main camera (same as dragging on canvas)
- Verify click vs drag threshold works (~3px)
- Verify 100ms animation feels snappy
- Verify animation cancels when starting orbit drag mid-animation (on canvas or cube)
- Verify hover states (face brightens, edge thickens to 2px)
- Verify light theme adaptation
- Verify cube doesn't interfere with canvas interaction (path hover, click-to-navigate)

## Out of scope

- Corner click targets (could be added later as 8 more targets)
- Custom axis labels or coordinate system reorientation
- ViewCube visibility toggle setting
