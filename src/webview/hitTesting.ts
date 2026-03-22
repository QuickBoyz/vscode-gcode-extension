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
 * A projected path segment stored during the render pass.
 * Maps a segment index to its screen-space polyline.
 */
export interface ProjectedSegmentData {
  readonly segmentIndex: number;
  readonly points: readonly { readonly x: number; readonly y: number }[];
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
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }

  // Project point onto the line, clamped to [0, 1]
  const projectionParameter = Math.max(
    0,
    Math.min(
      1,
      ((pointX - segmentStartX) * segmentDeltaX +
        (pointY - segmentStartY) * segmentDeltaY) /
        segmentLengthSquared
    )
  );

  const closestX = segmentStartX + projectionParameter * segmentDeltaX;
  const closestY = segmentStartY + projectionParameter * segmentDeltaY;

  const distanceDeltaX = pointX - closestX;
  const distanceDeltaY = pointY - closestY;
  return Math.sqrt(distanceDeltaX * distanceDeltaX + distanceDeltaY * distanceDeltaY);
}

// ---------------------------------------------------------------------------
// Hit test
// ---------------------------------------------------------------------------

/**
 * Finds the closest projected segment to the mouse position.
 *
 * Iterates every projected segment, computes the minimum distance
 * from the mouse to each consecutive point-pair in the polyline,
 * and returns the segment whose minimum distance is the smallest —
 * provided it is within `tolerance` pixels.
 *
 * @param mouseX             - Cursor X in canvas coordinates
 * @param mouseY             - Cursor Y in canvas coordinates
 * @param projectedSegments  - Projected polylines from the last render pass
 * @param tolerance          - Maximum distance in pixels to count as a hit
 * @returns The closest segment within tolerance, or `null` if none qualifies
 */
export function hitTestSegments(
  mouseX: number,
  mouseY: number,
  projectedSegments: readonly ProjectedSegmentData[],
  tolerance: number
): HitTestResult | null {
  let bestSegmentIndex: number | null = null;
  let bestDistance = Infinity;

  for (const segment of projectedSegments) {
    const points = segment.points;
    if (points.length < 2) {
      continue;
    }

    let minimumSegmentDistance = Infinity;

    for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex++) {
      const startPoint = points[pointIndex];
      const endPoint = points[pointIndex + 1];
      const distance = pointToSegmentDistance(
        mouseX,
        mouseY,
        startPoint.x,
        startPoint.y,
        endPoint.x,
        endPoint.y
      );
      if (distance < minimumSegmentDistance) {
        minimumSegmentDistance = distance;
      }
    }

    if (minimumSegmentDistance < bestDistance && minimumSegmentDistance <= tolerance) {
      bestDistance = minimumSegmentDistance;
      bestSegmentIndex = segment.segmentIndex;
    }
  }

  if (bestSegmentIndex === null) {
    return null;
  }

  return { segmentIndex: bestSegmentIndex, distance: bestDistance };
}
