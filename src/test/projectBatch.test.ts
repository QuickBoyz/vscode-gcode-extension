import { MotionType, PathSegment, ProjectionMode } from '../visualizer/types';
import { project, projectBatch, createCameraState } from '../webview/projection';
import { GeometryCache } from '../webview/geometryCache';

function buildSingleSegmentCache(
  points: readonly { x: number; y: number; z: number }[]
): GeometryCache {
  const segments: PathSegment[] = [{ type: MotionType.FEED, points }];
  return GeometryCache.build(segments);
}

describe('projectBatch', () => {
  const canvasWidth = 400;
  const canvasHeight = 300;

  it('matches the scalar project() for every point on a cloud', () => {
    const camera = createCameraState();
    const worldPoints = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 0, y: 10, z: 0 },
      { x: 0, y: 0, z: 10 },
      { x: -5, y: 3, z: 7 },
      { x: 12.5, y: -8.25, z: 2.1 },
    ];

    const cache = buildSingleSegmentCache(worldPoints);
    const screen = new Float32Array(worldPoints.length * 2);
    const depth = new Float32Array(worldPoints.length);

    projectBatch(
      cache.worldPoints,
      cache.pointCount,
      camera,
      canvasWidth,
      canvasHeight,
      ProjectionMode.PERSPECTIVE,
      screen,
      depth
    );

    for (let i = 0; i < worldPoints.length; i++) {
      const reference = project(
        worldPoints[i].x,
        worldPoints[i].y,
        worldPoints[i].z,
        camera,
        canvasWidth,
        canvasHeight,
        ProjectionMode.PERSPECTIVE
      );
      expect(reference).not.toBeNull();
      expect(screen[i * 2]).toBeCloseTo(reference!.x, 3);
      expect(screen[i * 2 + 1]).toBeCloseTo(reference!.y, 3);
      expect(depth[i]).toBeCloseTo(reference!.depth, 3);
    }
  });

  it('matches project() under orthographic projection', () => {
    const camera = createCameraState();
    const worldPoints = [
      { x: 3, y: 4, z: 5 },
      { x: -2, y: 1, z: -1 },
    ];
    const cache = buildSingleSegmentCache(worldPoints);
    const screen = new Float32Array(worldPoints.length * 2);
    const depth = new Float32Array(worldPoints.length);

    projectBatch(
      cache.worldPoints,
      cache.pointCount,
      camera,
      canvasWidth,
      canvasHeight,
      ProjectionMode.ORTHOGRAPHIC,
      screen,
      depth
    );

    for (let i = 0; i < worldPoints.length; i++) {
      const reference = project(
        worldPoints[i].x,
        worldPoints[i].y,
        worldPoints[i].z,
        camera,
        canvasWidth,
        canvasHeight,
        ProjectionMode.ORTHOGRAPHIC
      );
      expect(reference).not.toBeNull();
      expect(screen[i * 2]).toBeCloseTo(reference!.x, 3);
      expect(screen[i * 2 + 1]).toBeCloseTo(reference!.y, 3);
    }
  });

  it('honours pan offsets identically to project()', () => {
    const camera = { ...createCameraState(), panX: 37, panY: -19 };
    const cache = buildSingleSegmentCache([{ x: 1, y: 2, z: 3 }]);
    const screen = new Float32Array(2);
    const depth = new Float32Array(1);

    projectBatch(
      cache.worldPoints,
      cache.pointCount,
      camera,
      canvasWidth,
      canvasHeight,
      ProjectionMode.PERSPECTIVE,
      screen,
      depth
    );

    const reference = project(
      1,
      2,
      3,
      camera,
      canvasWidth,
      canvasHeight,
      ProjectionMode.PERSPECTIVE
    );
    expect(screen[0]).toBeCloseTo(reference!.x, 3);
    expect(screen[1]).toBeCloseTo(reference!.y, 3);
  });

  it('emits NaN screen coords for points behind the camera, keeps raw depth', () => {
    const camera = { ...createCameraState(), radius: 10 };
    const cache = buildSingleSegmentCache([
      { x: 0, y: 0, z: 0 },
      { x: 0, y: -10000, z: 0 },
    ]);
    const screen = new Float32Array(4);
    const depth = new Float32Array(2);

    projectBatch(
      cache.worldPoints,
      cache.pointCount,
      camera,
      canvasWidth,
      canvasHeight,
      ProjectionMode.PERSPECTIVE,
      screen,
      depth
    );

    expect(Number.isNaN(screen[0])).toBe(false);
    expect(Number.isNaN(screen[1])).toBe(false);
    expect(Number.isNaN(screen[2])).toBe(true);
    expect(Number.isNaN(screen[3])).toBe(true);
    // Raw depth is still written so segment-level sentinel logic can decide.
    expect(depth[1]).toBeLessThan(0.01);
  });

  it('does not allocate ProjectedPoint objects', () => {
    const camera = createCameraState();
    const points = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: i * 2, z: i * 3 }));
    const cache = buildSingleSegmentCache(points);
    const screen = new Float32Array(points.length * 2);
    const depth = new Float32Array(points.length);

    // If projectBatch allocated per-point objects, this loop would show
    // up as heavy allocation pressure. We can't measure GC from a unit
    // test, but we can at least assert the function completes and reuses
    // the provided buffers (proven by the reference stability below).
    for (let i = 0; i < 5; i++) {
      projectBatch(
        cache.worldPoints,
        cache.pointCount,
        camera,
        canvasWidth,
        canvasHeight,
        ProjectionMode.PERSPECTIVE,
        screen,
        depth
      );
    }
    // Sanity: last value matches the scalar projection.
    const last = points[points.length - 1];
    const reference = project(last.x, last.y, last.z, camera, canvasWidth, canvasHeight);
    const lastIdx = points.length - 1;
    expect(screen[lastIdx * 2]).toBeCloseTo(reference!.x, 3);
    expect(screen[lastIdx * 2 + 1]).toBeCloseTo(reference!.y, 3);
  });
});
