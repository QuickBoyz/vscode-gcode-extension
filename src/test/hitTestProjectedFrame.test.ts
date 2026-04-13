import { hitTestProjectedFrame, ProjectedFrame } from '../webview/hitTesting';

function makeFrame(
  pointsPerSegment: readonly { start: number; count: number }[],
  screen: readonly number[]
): ProjectedFrame {
  const segmentStart = new Uint32Array(pointsPerSegment.map((s) => s.start));
  const segmentLength = new Uint32Array(pointsPerSegment.map((s) => s.count));
  const drawnSegments = new Uint32Array(pointsPerSegment.map((_, i) => i));
  return {
    screen: Float32Array.from(screen),
    segmentStart,
    segmentLength,
    drawnSegments,
    drawnCount: pointsPerSegment.length,
  };
}

describe('hitTestProjectedFrame', () => {
  // Segment A: (0,0)-(100,0)    — points 0..1
  // Segment B: (0,50)-(100,50)  — points 2..3
  // Segment C: (0,10)-(50,10)-(100,10)  — points 4..6
  const frame = makeFrame(
    [
      { start: 0, count: 2 },
      { start: 2, count: 2 },
      { start: 4, count: 3 },
    ],
    [/* A */ 0, 0, 100, 0, /* B */ 0, 50, 100, 50, /* C */ 0, 10, 50, 10, 100, 10]
  );

  it('returns the closest drawn segment when multiple are in tolerance', () => {
    const result = hitTestProjectedFrame(50, 8, frame, 10);
    expect(result).not.toBeNull();
    expect(result!.segmentIndex).toBe(2);
    expect(result!.distance).toBeCloseTo(2);
  });

  it('returns null when no segment is in tolerance', () => {
    const result = hitTestProjectedFrame(50, 200, frame, 10);
    expect(result).toBeNull();
  });

  it('only considers segments listed in drawnSegments', () => {
    // Hide segment C by excluding it from drawnSegments. Mouse at (50,8)
    // — now the nearest visible segment is A (y=0, distance 8).
    const hiddenFrame: ProjectedFrame = {
      ...frame,
      drawnSegments: Uint32Array.from([0, 1]),
      drawnCount: 2,
    };
    const result = hitTestProjectedFrame(50, 8, hiddenFrame, 10);
    expect(result).not.toBeNull();
    expect(result!.segmentIndex).toBe(0);
    expect(result!.distance).toBeCloseTo(8);
  });

  it('skips edges that touch a NaN (behind-camera) endpoint', () => {
    // Segment with 3 points where the middle one is behind the camera.
    // Edge 0-1 and edge 1-2 both touch NaN → only a fully invalid segment.
    const nanFrame = makeFrame([{ start: 0, count: 3 }], [0, 0, NaN, NaN, 100, 0]);
    const result = hitTestProjectedFrame(50, 0, nanFrame, 5);
    expect(result).toBeNull();
  });

  it('returns the valid sub-edge when only one endpoint is NaN', () => {
    // Points: valid-valid-NaN. Only edge 0-1 is valid.
    const nanFrame = makeFrame([{ start: 0, count: 3 }], [0, 0, 100, 0, NaN, NaN]);
    const result = hitTestProjectedFrame(50, 0, nanFrame, 5);
    expect(result).not.toBeNull();
    expect(result!.segmentIndex).toBe(0);
    expect(result!.distance).toBeCloseTo(0);
  });

  it('handles an empty frame', () => {
    const emptyFrame: ProjectedFrame = {
      screen: new Float32Array(0),
      segmentStart: new Uint32Array(0),
      segmentLength: new Uint32Array(0),
      drawnSegments: new Uint32Array(0),
      drawnCount: 0,
    };
    expect(hitTestProjectedFrame(0, 0, emptyFrame, 10)).toBeNull();
  });

  it('skips segments with fewer than 2 points', () => {
    const degenerate = makeFrame([{ start: 0, count: 1 }], [50, 50]);
    expect(hitTestProjectedFrame(50, 50, degenerate, 10)).toBeNull();
  });
});
