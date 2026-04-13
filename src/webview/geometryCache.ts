import { PathSegment } from '../visualizer/types';
import { classifyBucket } from './renderBuckets';

/**
 * Immutable typed-array geometry cache built once per segments load.
 *
 * Collapses the {segments, points} object tree into flat Float32 /
 * Uint32 buffers so the per-frame render loop never walks the object
 * graph, never chases pointers for PathPoint reads, and never allocates
 * during orbit. This is the structural precondition that lets the
 * render loop hit ≥50 fps on large files (surface-finish.ngc has
 * ~190k segments / ~380k points).
 *
 * Layout:
 *
 *   worldPoints[3*i + 0] = segment's i-th point X
 *   worldPoints[3*i + 1] = segment's i-th point Y
 *   worldPoints[3*i + 2] = segment's i-th point Z
 *
 *   For segment s:
 *     firstPoint   = segmentStart[s]
 *     pointCount   = segmentLength[s]
 *     bucket       = segmentBucket[s]     // StyleBucket
 *     midpointIdx  = segmentMidpoint[s]   // point index (absolute) used for painter's depth sort
 *
 * The midpoint choice mirrors the pre-fix render loop which used
 * `segment.points[Math.floor(points.length / 2)]` as the painter's-
 * algorithm depth proxy, so the sort order is unchanged.
 */
export class GeometryCache {
  readonly worldPoints: Float32Array;
  readonly segmentStart: Uint32Array;
  readonly segmentLength: Uint32Array;
  readonly segmentBucket: Uint8Array;
  readonly segmentMidpoint: Uint32Array;
  readonly segmentCount: number;
  readonly pointCount: number;

  private constructor(
    worldPoints: Float32Array,
    segmentStart: Uint32Array,
    segmentLength: Uint32Array,
    segmentBucket: Uint8Array,
    segmentMidpoint: Uint32Array,
    pointCount: number
  ) {
    this.worldPoints = worldPoints;
    this.segmentStart = segmentStart;
    this.segmentLength = segmentLength;
    this.segmentBucket = segmentBucket;
    this.segmentMidpoint = segmentMidpoint;
    this.segmentCount = segmentLength.length;
    this.pointCount = pointCount;
  }

  static build(segments: readonly PathSegment[]): GeometryCache {
    const segmentCount = segments.length;
    const segmentStart = new Uint32Array(segmentCount);
    const segmentLength = new Uint32Array(segmentCount);
    const segmentBucket = new Uint8Array(segmentCount);
    const segmentMidpoint = new Uint32Array(segmentCount);

    let totalPoints = 0;
    for (let i = 0; i < segmentCount; i++) {
      totalPoints += segments[i].points.length;
    }

    const worldPoints = new Float32Array(totalPoints * 3);

    let pointCursor = 0;
    for (let i = 0; i < segmentCount; i++) {
      const segment = segments[i];
      const length = segment.points.length;
      segmentStart[i] = pointCursor;
      segmentLength[i] = length;
      segmentBucket[i] = classifyBucket(segment.type);
      segmentMidpoint[i] = pointCursor + Math.floor(length / 2);

      for (let j = 0; j < length; j++) {
        const p = segment.points[j];
        const base = (pointCursor + j) * 3;
        worldPoints[base] = p.x;
        worldPoints[base + 1] = p.y;
        worldPoints[base + 2] = p.z;
      }
      pointCursor += length;
    }

    return new GeometryCache(
      worldPoints,
      segmentStart,
      segmentLength,
      segmentBucket,
      segmentMidpoint,
      totalPoints
    );
  }
}

/**
 * Reusable per-frame scratch buffers sized to a specific GeometryCache.
 * Allocated once when geometry changes; mutated in place every frame.
 */
export class FrameScratch {
  /** Interleaved screen-space coordinates: [x0,y0, x1,y1, …]. NaN if behind camera. */
  readonly screen: Float32Array;
  /** Per-point raw depth (camera.radius + depthAxis). */
  readonly pointDepth: Float32Array;
  /** Per-segment depth used for painter's sort — Infinity when midpoint is behind camera. */
  readonly segmentDepth: Float32Array;
  /** Segment indices to draw, sorted back-to-front. Reused every frame. */
  readonly sortedSegments: Uint32Array;
  /**
   * Packed (depthQuant, segIdx) sort keys. Sorted with a no-comparator
   * `Uint32Array.prototype.sort()` call — native C++ integer sort, an
   * order of magnitude faster than a JS comparator on 190k elements.
   */
  readonly sortKeys: Uint32Array;

  constructor(pointCount: number, segmentCount: number) {
    this.screen = new Float32Array(pointCount * 2);
    this.pointDepth = new Float32Array(pointCount);
    this.segmentDepth = new Float32Array(segmentCount);
    this.sortedSegments = new Uint32Array(segmentCount);
    this.sortKeys = new Uint32Array(segmentCount);
  }

  static forCache(cache: GeometryCache): FrameScratch {
    return new FrameScratch(cache.pointCount, cache.segmentCount);
  }
}

/**
 * Sort-key packing for the radix-style painter's-algorithm sort.
 *
 * Keys are 32-bit: high 13 bits = quantized depth (back-to-front, so
 * LARGER depth produces SMALLER key → drawn first → overdrawn by
 * nearer geometry), low 19 bits = segment index. 13 bits of depth
 * resolution ≈ 8192 levels, which is far finer than painter's-sort
 * depth collisions care about (and collisions are broken by the
 * segment index naturally, since it's the low bits of the same key).
 *
 * 19 bits of segment index gives a max of 524,287 segments — well
 * above any realistic G-code program.
 */
export const DEPTH_QUANT_BITS = 13;
export const DEPTH_QUANT_MAX = (1 << DEPTH_QUANT_BITS) - 1;
export const SORT_IDX_BITS = 32 - DEPTH_QUANT_BITS;
export const SORT_IDX_MASK = (1 << SORT_IDX_BITS) - 1;
export const MAX_SORTABLE_SEGMENTS = SORT_IDX_MASK + 1;
