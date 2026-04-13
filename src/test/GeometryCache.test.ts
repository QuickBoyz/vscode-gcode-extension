import { MotionType, PathSegment } from '../visualizer/types';
import { GeometryCache } from '../webview/GeometryCache';
import { StyleBucket } from '../webview/renderBuckets';

describe('GeometryCache', () => {
  it('flattens a two-segment program into typed-array buffers', () => {
    const segments: PathSegment[] = [
      {
        type: MotionType.FEED,
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
        ],
      },
      {
        type: MotionType.RAPID,
        points: [
          { x: 10, y: 0, z: 0 },
          { x: 10, y: 10, z: 5 },
        ],
      },
    ];

    const cache = GeometryCache.build(segments);

    expect(cache.segmentCount).toBe(2);
    expect(cache.pointCount).toBe(4);
    expect(cache.worldPoints.length).toBe(12);

    // First segment
    expect(cache.segmentStart[0]).toBe(0);
    expect(cache.segmentLength[0]).toBe(2);
    expect(cache.segmentBucket[0]).toBe(StyleBucket.FEED);

    // Second segment
    expect(cache.segmentStart[1]).toBe(2);
    expect(cache.segmentLength[1]).toBe(2);
    expect(cache.segmentBucket[1]).toBe(StyleBucket.RAPID);

    // Flattened world points (x,y,z interleaved)
    expect(cache.worldPoints[0]).toBe(0);
    expect(cache.worldPoints[1]).toBe(0);
    expect(cache.worldPoints[2]).toBe(0);
    expect(cache.worldPoints[3]).toBe(10);
    expect(cache.worldPoints[6]).toBe(10);
    expect(cache.worldPoints[9]).toBe(10);
    expect(cache.worldPoints[10]).toBe(10);
    expect(cache.worldPoints[11]).toBe(5);
  });

  it("matches the pre-fix midpoint choice (floor(length/2)) for painter's sort", () => {
    const segments: PathSegment[] = [
      {
        type: MotionType.ARC_CW,
        points: Array.from({ length: 9 }, (_, i) => ({ x: i, y: 0, z: 0 })),
      },
    ];
    const cache = GeometryCache.build(segments);

    // A 9-point segment has midpoint at local index floor(9/2) = 4.
    // Since it's the only segment, segmentStart is 0, so absolute
    // midpoint index is 4.
    expect(cache.segmentMidpoint[0]).toBe(4);
  });

  it('classifies arc buckets for G2 and G3', () => {
    const segments: PathSegment[] = [
      {
        type: MotionType.ARC_CW,
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
      },
      {
        type: MotionType.ARC_CCW,
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
      },
    ];
    const cache = GeometryCache.build(segments);
    expect(cache.segmentBucket[0]).toBe(StyleBucket.ARC);
    expect(cache.segmentBucket[1]).toBe(StyleBucket.ARC);
  });

  it('handles an empty program without exploding', () => {
    const cache = GeometryCache.build([]);
    expect(cache.segmentCount).toBe(0);
    expect(cache.pointCount).toBe(0);
    expect(cache.worldPoints.length).toBe(0);
  });

  it('handles segments with more than two points (arc interpolation)', () => {
    const segments: PathSegment[] = [
      {
        type: MotionType.ARC_CW,
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 1, z: 0 },
          { x: 2, y: 0, z: 0 },
          { x: 3, y: -1, z: 0 },
          { x: 4, y: 0, z: 0 },
        ],
      },
    ];
    const cache = GeometryCache.build(segments);
    expect(cache.segmentLength[0]).toBe(5);
    expect(cache.pointCount).toBe(5);
    // Midpoint absolute index = segmentStart + floor(5/2) = 0 + 2 = 2.
    expect(cache.segmentMidpoint[0]).toBe(2);
    expect(cache.worldPoints[6]).toBe(2); // x of point index 2
  });
});
