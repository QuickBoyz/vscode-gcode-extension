import {
  DEPTH_QUANT_BITS,
  DEPTH_QUANT_MAX,
  MAX_SORTABLE_SEGMENTS,
  SORT_IDX_BITS,
  SORT_IDX_MASK,
} from '../webview/FrameScratch';

/**
 * Pack a (depth, idx) pair exactly the way `useRenderLoop` does, so
 * the invariant we test here is bit-for-bit the invariant the hot
 * path relies on. Back-to-front painter's sort means larger depth
 * draws first, so larger depth must produce a SMALLER key.
 */
function packKey(depth: number, idx: number, minDepth: number, depthRange: number): number {
  const depthScale = DEPTH_QUANT_MAX / depthRange;
  const scaled = ((depth - minDepth) * depthScale) | 0;
  const q = scaled < 0 ? 0 : scaled > DEPTH_QUANT_MAX ? DEPTH_QUANT_MAX : scaled;
  return ((DEPTH_QUANT_MAX - q) << SORT_IDX_BITS) | idx;
}

describe('radix-style depth sort key', () => {
  it('keeps the bit layout within 32 bits', () => {
    expect(DEPTH_QUANT_BITS + SORT_IDX_BITS).toBe(32);
    expect(MAX_SORTABLE_SEGMENTS).toBeGreaterThan(500_000);
  });

  it('sorts segments back-to-front (larger depth drawn first) via native Uint32 sort', () => {
    const depths = [1.0, 5.0, 2.5, 9.1, 3.2, 7.7, 0.1];
    const min = Math.min(...depths);
    const max = Math.max(...depths);
    const range = max - min;

    const keys = new Uint32Array(depths.length);
    for (let i = 0; i < depths.length; i++) {
      keys[i] = packKey(depths[i], i, min, range);
    }
    keys.sort();

    const drawOrder: number[] = [];
    const drawDepths: number[] = [];
    for (const k of keys) {
      const idx = k & SORT_IDX_MASK;
      drawOrder.push(idx);
      drawDepths.push(depths[idx]);
    }

    for (let i = 1; i < drawDepths.length; i++) {
      expect(drawDepths[i]).toBeLessThanOrEqual(drawDepths[i - 1]);
    }
  });

  it('breaks depth ties by segment index (deterministic, no flicker)', () => {
    const depths = [2.0, 2.0, 2.0, 2.0];
    const min = 2.0;
    const range = 1; // degenerate range → all quantize to the same slot
    const keys = new Uint32Array(depths.length);
    for (let i = 0; i < depths.length; i++) {
      keys[i] = packKey(depths[i], i, min, range);
    }
    keys.sort();

    const drawOrder = Array.from(keys, (k) => k & SORT_IDX_MASK);
    expect(drawOrder).toEqual([0, 1, 2, 3]);
  });

  it('matches a reference comparator sort within quantization resolution', () => {
    const rand = (seed: number) => {
      let s = seed >>> 0;
      return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x1_0000_0000;
      };
    };
    const rng = rand(42);
    const N = 4096;
    const depths = new Float32Array(N);
    let mn = Infinity;
    let mx = -Infinity;
    for (let i = 0; i < N; i++) {
      depths[i] = rng() * 100;
      if (depths[i] < mn) mn = depths[i];
      if (depths[i] > mx) mx = depths[i];
    }
    const range = mx - mn || 1;

    const keys = new Uint32Array(N);
    for (let i = 0; i < N; i++) {
      keys[i] = packKey(depths[i], i, mn, range);
    }
    keys.sort();
    const radixOrder = Array.from(keys, (k) => k & SORT_IDX_MASK);

    const refOrder = Array.from({ length: N }, (_, i) => i).sort((a, b) => depths[b] - depths[a]);

    // With 8192 quantization levels across 100 units of depth the bucket
    // width is ~0.012, far smaller than anything the eye or painter's
    // sort cares about. We require the depths produced by the two
    // orders to be monotonically decreasing within ~1 bucket.
    const bucketWidth = range / DEPTH_QUANT_MAX;
    for (let i = 0; i < N; i++) {
      const radixDepth = depths[radixOrder[i]];
      const refDepth = depths[refOrder[i]];
      expect(Math.abs(radixDepth - refDepth)).toBeLessThanOrEqual(bucketWidth * 2);
    }
  });
});
