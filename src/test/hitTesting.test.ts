import {
  pointToSegmentDistance,
  hitTestSegments,
  ProjectedSegmentData,
} from '../webview/hitTesting';

describe('pointToSegmentDistance', () => {
  it('returns 0 for a point lying on the segment', () => {
    // Midpoint of (0,0)-(10,0) is (5,0)
    const distance = pointToSegmentDistance(5, 0, 0, 0, 10, 0);
    expect(distance).toBeCloseTo(0);
  });

  it('returns 0 for a point at the segment start', () => {
    const distance = pointToSegmentDistance(0, 0, 0, 0, 10, 0);
    expect(distance).toBeCloseTo(0);
  });

  it('returns 0 for a point at the segment end', () => {
    const distance = pointToSegmentDistance(10, 0, 0, 0, 10, 0);
    expect(distance).toBeCloseTo(0);
  });

  it('returns perpendicular distance for a point beside the segment midpoint', () => {
    // Point (5, 3) is 3 units above the horizontal segment (0,0)-(10,0)
    const distance = pointToSegmentDistance(5, 3, 0, 0, 10, 0);
    expect(distance).toBeCloseTo(3);
  });

  it('clamps to nearest endpoint when point is beyond segment start', () => {
    // Point (-3, 0) is beyond the start of (0,0)-(10,0), closest is (0,0)
    const distance = pointToSegmentDistance(-3, 0, 0, 0, 10, 0);
    expect(distance).toBeCloseTo(3);
  });

  it('clamps to nearest endpoint when point is beyond segment end', () => {
    // Point (13, 4) is beyond the end of (0,0)-(10,0), closest is (10,0)
    const distance = pointToSegmentDistance(13, 4, 0, 0, 10, 0);
    expect(distance).toBeCloseTo(5); // sqrt(9+16) = 5
  });

  it('handles a degenerate (zero-length) segment', () => {
    // Segment from (5,5) to (5,5) — just a point
    const distance = pointToSegmentDistance(8, 9, 5, 5, 5, 5);
    expect(distance).toBeCloseTo(5); // sqrt(9+16) = 5
  });

  it('handles a diagonal segment', () => {
    // Segment from (0,0) to (10,10), point at (0,10)
    // The perpendicular distance to the line y=x is |0-10|/sqrt(2) = 10/sqrt(2)
    // But projection parameter t = (0*10 + 10*10)/200 = 0.5, so the closest
    // point on the segment is (5,5). Distance = sqrt(25+25) = sqrt(50)
    const distance = pointToSegmentDistance(0, 10, 0, 0, 10, 10);
    expect(distance).toBeCloseTo(Math.sqrt(50));
  });
});

describe('hitTestSegments', () => {
  const segmentA: ProjectedSegmentData = {
    segmentIndex: 0,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
  };

  const segmentB: ProjectedSegmentData = {
    segmentIndex: 1,
    points: [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ],
  };

  const segmentC: ProjectedSegmentData = {
    segmentIndex: 2,
    points: [
      { x: 0, y: 10 },
      { x: 50, y: 10 },
      { x: 100, y: 10 },
    ],
  };

  it('returns the closest segment when multiple are within tolerance', () => {
    // Mouse at (50, 8) — segmentC (y=10) is 2px away, segmentA (y=0) is 8px away
    const result = hitTestSegments(50, 8, [segmentA, segmentB, segmentC], 10);
    expect(result).not.toBeNull();
    expect(result!.segmentIndex).toBe(2);
    expect(result!.distance).toBeCloseTo(2);
  });

  it('returns null when no segment is within tolerance', () => {
    // Mouse at (50, 200) — all segments are far away
    const result = hitTestSegments(50, 200, [segmentA, segmentB, segmentC], 10);
    expect(result).toBeNull();
  });

  it('handles an empty segment list', () => {
    const result = hitTestSegments(50, 50, [], 10);
    expect(result).toBeNull();
  });

  it('skips segments with fewer than 2 points', () => {
    const singlePointSegment: ProjectedSegmentData = {
      segmentIndex: 5,
      points: [{ x: 50, y: 50 }],
    };
    const result = hitTestSegments(50, 50, [singlePointSegment], 10);
    expect(result).toBeNull();
  });

  it('returns the only segment when it is within tolerance', () => {
    const result = hitTestSegments(50, 3, [segmentA], 5);
    expect(result).not.toBeNull();
    expect(result!.segmentIndex).toBe(0);
    expect(result!.distance).toBeCloseTo(3);
  });

  it('correctly handles multi-point polylines', () => {
    // segmentC goes from (0,10) to (50,10) to (100,10)
    // Mouse at (75, 10) should be exactly on the second sub-segment
    const result = hitTestSegments(75, 10, [segmentC], 5);
    expect(result).not.toBeNull();
    expect(result!.segmentIndex).toBe(2);
    expect(result!.distance).toBeCloseTo(0);
  });

  it('picks the nearer segment when two are equidistant from their sides', () => {
    // segmentA at y=0, segmentB at y=50, mouse at (50, 20)
    // Distance to A: 20, distance to B: 30. A is closer.
    const result = hitTestSegments(50, 20, [segmentA, segmentB], 25);
    expect(result).not.toBeNull();
    expect(result!.segmentIndex).toBe(0);
    expect(result!.distance).toBeCloseTo(20);
  });
});
