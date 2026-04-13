import { MotionType } from '../visualizer/types';
import { FrameScratch } from '../webview/FrameScratch';
import { GeometryCache } from '../webview/GeometryCache';

describe('FrameScratch', () => {
  it('allocates buffers sized to a cache', () => {
    const cache = GeometryCache.build([
      {
        type: MotionType.FEED,
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
      },
    ]);
    const scratch = FrameScratch.forCache(cache);
    expect(scratch.screen.length).toBe(cache.pointCount * 2);
    expect(scratch.pointDepth.length).toBe(cache.pointCount);
    expect(scratch.segmentDepth.length).toBe(cache.segmentCount);
    expect(scratch.sortedSegments.length).toBe(cache.segmentCount);
  });
});
