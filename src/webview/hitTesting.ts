/**
 * Pure math module for hit-testing projected 2D path segments.
 *
 * No DOM or canvas dependencies — all functions operate on plain
 * number coordinates so they can be unit-tested under Node.js.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Flat typed-array view over the projected screen buffer built by the
 * render loop. Avoids per-frame wrapper-object allocation, so hit
 * testing during orbit is zero-allocation.
 *
 * `screen` is interleaved [x0,y0, x1,y1, …]. For segment index s, the
 * first point is at `screen[2 * segmentStart[s]]` and there are
 * `segmentLength[s]` consecutive points. Behind-camera points are
 * encoded as `NaN` — consumers must break the polyline at NaN.
 *
 * `drawnSegments[0 .. drawnCount-1]` enumerates the segments that were
 * actually drawn in the last frame (respecting playback visibility and
 * `showRapidMoves`). Hit testing iterates only these.
 */
export interface ProjectedFrame {
  readonly screen: Float32Array;
  readonly segmentStart: Uint32Array;
  readonly segmentLength: Uint32Array;
  readonly drawnSegments: Uint32Array;
  readonly drawnCount: number;
}

/**
 * Result of a successful hit test — the matched segment index and
 * the distance (in canvas pixels) from the cursor to the nearest
 * edge of the segment polyline.
 */
export interface HitTestResult {
  readonly segmentIndex: number;
  readonly distance: number;
}

// ---------------------------------------------------------------------------
// Point-to-segment distance
// ---------------------------------------------------------------------------

/**
 * Computes the shortest Euclidean distance from point (px, py) to
 * the finite line segment from (ax, ay) to (bx, by).
 *
 * The projection parameter `t` is clamped to [0, 1] so the result
 * is always the distance to a point *on* the segment, not on the
 * infinite line.
 */
export function pointToSegmentDistance(
  pointX: number,
  pointY: number,
  segmentStartX: number,
  segmentStartY: number,
  segmentEndX: number,
  segmentEndY: number
): number {
  const segmentDeltaX = segmentEndX - segmentStartX;
  const segmentDeltaY = segmentEndY - segmentStartY;
  const segmentLengthSquared = segmentDeltaX * segmentDeltaX + segmentDeltaY * segmentDeltaY;

  // Degenerate segment (start === end) — just return point-to-point distance
  if (segmentLengthSquared === 0) {
    const deltaX = pointX - segmentStartX;
    const deltaY = pointY - segmentStartY;
    return Math.hypot(deltaX, deltaY);
  }

  // Project point onto the line, clamped to [0, 1]
  const projectionParameter = Math.max(
    0,
    Math.min(
      1,
      ((pointX - segmentStartX) * segmentDeltaX + (pointY - segmentStartY) * segmentDeltaY) /
        segmentLengthSquared
    )
  );

  const closestX = segmentStartX + projectionParameter * segmentDeltaX;
  const closestY = segmentStartY + projectionParameter * segmentDeltaY;

  const distanceDeltaX = pointX - closestX;
  const distanceDeltaY = pointY - closestY;
  return Math.hypot(distanceDeltaX, distanceDeltaY);
}

// ---------------------------------------------------------------------------
// Hit test
// ---------------------------------------------------------------------------

/**
 * Finds the closest drawn segment to the mouse position by reading the
 * flat typed-array view produced by the render loop. Returns the
 * closest drawn segment within `tolerance`, or null. Reads screen
 * coordinates directly out of the `Float32Array` with no per-segment
 * object allocation.
 *
 * Segments in `frame.drawnSegments[0 .. frame.drawnCount-1]` are the
 * only ones considered — so playback-hidden, filtered-out, and
 * fully-behind-camera segments cannot be hit-tested, matching the
 * old behaviour where they were absent from the projected cache.
 *
 * Sub-segments (polyline edges) that touch a `NaN` endpoint (behind
 * camera) are skipped, matching the old behaviour where the path was
 * broken at invalid points.
 */
export function hitTestProjectedFrame(
  mouseX: number,
  mouseY: number,
  frame: ProjectedFrame,
  tolerance: number
): HitTestResult | null {
  const { screen, segmentStart, segmentLength, drawnSegments, drawnCount } = frame;

  let bestSegmentIndex: number | null = null;
  let bestDistance = Infinity;

  for (let d = 0; d < drawnCount; d++) {
    const segIdx = drawnSegments[d];
    const length = segmentLength[segIdx];
    if (length < 2) {
      continue;
    }
    const startPoint = segmentStart[segIdx];

    let minimumSegmentDistance = Infinity;
    for (let j = 0; j < length - 1; j++) {
      const aBase = (startPoint + j) * 2;
      const bBase = (startPoint + j + 1) * 2;
      const ax = screen[aBase];
      const ay = screen[aBase + 1];
      const bx = screen[bBase];
      const by = screen[bBase + 1];

      // Skip edges that touch a behind-camera point.
      if (Number.isNaN(ax) || Number.isNaN(bx)) {
        continue;
      }

      const distance = pointToSegmentDistance(mouseX, mouseY, ax, ay, bx, by);
      if (distance < minimumSegmentDistance) {
        minimumSegmentDistance = distance;
      }
    }

    if (minimumSegmentDistance < bestDistance && minimumSegmentDistance <= tolerance) {
      bestDistance = minimumSegmentDistance;
      bestSegmentIndex = segIdx;
    }
  }

  if (bestSegmentIndex === null) {
    return null;
  }
  return { segmentIndex: bestSegmentIndex, distance: bestDistance };
}
