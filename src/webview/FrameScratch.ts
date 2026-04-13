import { GeometryCache } from './GeometryCache';

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
   * See the DEPTH_QUANT_* / SORT_IDX_* constants below for the layout.
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
 *
 * Colocated with FrameScratch because FrameScratch.sortKeys is the
 * Uint32Array these constants encode into. The inline packing logic
 * in useRenderLoop.ts must stay bit-for-bit compatible with these
 * constants and with the reference implementation in
 * src/test/radixDepthSort.test.ts.
 */
export const DEPTH_QUANT_BITS = 13;
export const DEPTH_QUANT_MAX = (1 << DEPTH_QUANT_BITS) - 1;
export const SORT_IDX_BITS = 32 - DEPTH_QUANT_BITS;
export const SORT_IDX_MASK = (1 << SORT_IDX_BITS) - 1;
export const MAX_SORTABLE_SEGMENTS = SORT_IDX_MASK + 1;
