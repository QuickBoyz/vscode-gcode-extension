import { PathPoint } from '../../visualizer/types';

/**
 * Computes the total arc length of a polyline defined by an ordered sequence
 * of 3D points. Returns 0 for fewer than two points.
 */
export function polylineLength(points: readonly PathPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const dz = points[i].z - points[i - 1].z;
    total += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return total;
}

/**
 * Returns the 3D position at parameter `t` (clamped to [0, 1]) along a
 * polyline, where distance is proportional to arc length.
 *
 * - t=0 → first point
 * - t=1 → last point
 * - t=0.5 → midpoint by accumulated distance
 * - Empty array → { x: 0, y: 0, z: 0 }
 * - Single point → that point
 */
export function interpolatePolyline(points: readonly PathPoint[], t: number): PathPoint {
  if (points.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  if (points.length === 1) {
    return points[0];
  }

  const clampedT = Math.max(0, Math.min(1, t));

  const total = polylineLength(points);

  // Degenerate: all points coincide
  if (total === 0) {
    return points[0];
  }

  const target = clampedT * total;
  let accumulated = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dz = curr.z - prev.z;
    const segLen = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (accumulated + segLen >= target) {
      const remaining = target - accumulated;
      const frac = segLen === 0 ? 0 : remaining / segLen;
      return {
        x: prev.x + frac * dx,
        y: prev.y + frac * dy,
        z: prev.z + frac * dz,
      };
    }

    accumulated += segLen;
  }

  // t=1 or floating-point accumulation past end: return last point
  return points[points.length - 1];
}
