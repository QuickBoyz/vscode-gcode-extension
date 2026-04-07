import { polylineLength, interpolatePolyline } from '../../webview/playback/geometry';
import { PathPoint } from '../../visualizer/types';

describe('polylineLength', () => {
  it('returns 0 for an empty array', () => {
    expect(polylineLength([])).toBe(0);
  });

  it('returns 0 for a single point', () => {
    const points: PathPoint[] = [{ x: 1, y: 2, z: 3 }];
    expect(polylineLength(points)).toBe(0);
  });

  it('returns the distance between two points on the X axis', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 },
    ];
    expect(polylineLength(points)).toBeCloseTo(3);
  });

  it('returns the distance between two points on the Y axis', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 4, z: 0 },
    ];
    expect(polylineLength(points)).toBeCloseTo(4);
  });

  it('returns the distance between two points on the Z axis', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 5 },
    ];
    expect(polylineLength(points)).toBeCloseTo(5);
  });

  it('returns the 3D Euclidean distance for a diagonal segment', () => {
    // sqrt(3^2 + 4^2) = 5
    const points: PathPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 4, z: 0 },
    ];
    expect(polylineLength(points)).toBeCloseTo(5);
  });

  it('returns the full 3D diagonal distance', () => {
    // sqrt(1^2 + 2^2 + 2^2) = 3
    const points: PathPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 2, z: 2 },
    ];
    expect(polylineLength(points)).toBeCloseTo(3);
  });

  it('sums multiple segments', () => {
    // Two segments of length 5 each = 10
    const points: PathPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 4, z: 0 },
      { x: 6, y: 0, z: 0 },
    ];
    // segment 1: sqrt(9+16) = 5, segment 2: sqrt(9+16) = 5
    expect(polylineLength(points)).toBeCloseTo(10);
  });

  it('handles negative coordinates', () => {
    const points: PathPoint[] = [
      { x: -3, y: 0, z: 0 },
      { x: 0, y: 4, z: 0 },
    ];
    // sqrt(9+16) = 5
    expect(polylineLength(points)).toBeCloseTo(5);
  });

  it('returns 0 for coincident points', () => {
    const points: PathPoint[] = [
      { x: 5, y: 5, z: 5 },
      { x: 5, y: 5, z: 5 },
    ];
    expect(polylineLength(points)).toBeCloseTo(0);
  });
});

describe('interpolatePolyline', () => {
  it('returns { x:0, y:0, z:0 } for an empty array', () => {
    const result = interpolatePolyline([], 0.5);
    expect(result).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('returns the single point for a one-element array at t=0', () => {
    const point: PathPoint = { x: 1, y: 2, z: 3 };
    expect(interpolatePolyline([point], 0)).toEqual(point);
  });

  it('returns the single point for a one-element array at t=1', () => {
    const point: PathPoint = { x: 7, y: 8, z: 9 };
    expect(interpolatePolyline([point], 1)).toEqual(point);
  });

  it('returns the single point for a one-element array at any t', () => {
    const point: PathPoint = { x: 3, y: 3, z: 3 };
    expect(interpolatePolyline([point], 0.5)).toEqual(point);
  });

  it('returns first point at t=0', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
    ];
    const result = interpolatePolyline(points, 0);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
    expect(result.z).toBeCloseTo(0);
  });

  it('returns last point at t=1', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
    ];
    const result = interpolatePolyline(points, 1);
    expect(result.x).toBeCloseTo(10);
    expect(result.y).toBeCloseTo(0);
    expect(result.z).toBeCloseTo(0);
  });

  it('returns midpoint at t=0.5 for a single segment on the X axis', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
    ];
    const result = interpolatePolyline(points, 0.5);
    expect(result.x).toBeCloseTo(5);
    expect(result.y).toBeCloseTo(0);
    expect(result.z).toBeCloseTo(0);
  });

  it('returns quarter point at t=0.25', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 20, y: 0, z: 0 },
    ];
    const result = interpolatePolyline(points, 0.25);
    expect(result.x).toBeCloseTo(5);
    expect(result.y).toBeCloseTo(0);
    expect(result.z).toBeCloseTo(0);
  });

  it('interpolates correctly in 3D', () => {
    const points: PathPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 4, z: 6 },
    ];
    const result = interpolatePolyline(points, 0.5);
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(2);
    expect(result.z).toBeCloseTo(3);
  });

  it('interpolates across segment boundary in a two-segment polyline', () => {
    // Two equal-length segments: [0,0,0]->[10,0,0]->[10,10,0]
    // Each segment has length 10, total = 20
    // t=0.5 should land exactly at the boundary point [10,0,0]
    const points: PathPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 10, y: 10, z: 0 },
    ];
    const result = interpolatePolyline(points, 0.5);
    expect(result.x).toBeCloseTo(10);
    expect(result.y).toBeCloseTo(0);
    expect(result.z).toBeCloseTo(0);
  });

  it('interpolates within the second segment of a two-segment polyline', () => {
    // [0,0,0]->[10,0,0]->[10,10,0], each segment length 10, total 20
    // t=0.75 → 15 units along → 5 into second segment → [10, 5, 0]
    const points: PathPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 10, y: 10, z: 0 },
    ];
    const result = interpolatePolyline(points, 0.75);
    expect(result.x).toBeCloseTo(10);
    expect(result.y).toBeCloseTo(5);
    expect(result.z).toBeCloseTo(0);
  });

  it('interpolates within the first segment of a two-segment polyline', () => {
    // [0,0,0]->[10,0,0]->[10,10,0], each segment length 10, total 20
    // t=0.25 → 5 units along first segment → [5, 0, 0]
    const points: PathPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 10, y: 10, z: 0 },
    ];
    const result = interpolatePolyline(points, 0.25);
    expect(result.x).toBeCloseTo(5);
    expect(result.y).toBeCloseTo(0);
    expect(result.z).toBeCloseTo(0);
  });

  it('clamps t below 0 to first point', () => {
    const points: PathPoint[] = [
      { x: 1, y: 2, z: 3 },
      { x: 10, y: 20, z: 30 },
    ];
    const result = interpolatePolyline(points, -0.5);
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(2);
    expect(result.z).toBeCloseTo(3);
  });

  it('clamps t above 1 to last point', () => {
    const points: PathPoint[] = [
      { x: 1, y: 2, z: 3 },
      { x: 10, y: 20, z: 30 },
    ];
    const result = interpolatePolyline(points, 1.5);
    expect(result.x).toBeCloseTo(10);
    expect(result.y).toBeCloseTo(20);
    expect(result.z).toBeCloseTo(30);
  });

  it('handles unequal segment lengths correctly', () => {
    // Segment 1: [0,0,0]->[1,0,0] length 1
    // Segment 2: [1,0,0]->[4,0,0] length 3
    // Total length = 4
    // t=0.25 → 1 unit along → exactly at [1,0,0]
    const points: PathPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 4, y: 0, z: 0 },
    ];
    const result = interpolatePolyline(points, 0.25);
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(0);
    expect(result.z).toBeCloseTo(0);
  });

  it('handles unequal segment lengths - midway in second segment', () => {
    // Segment 1: [0,0,0]->[1,0,0] length 1
    // Segment 2: [1,0,0]->[4,0,0] length 3
    // Total length = 4
    // t=0.5 → 2 units along → 1 unit into second segment → [2, 0, 0]
    const points: PathPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 4, y: 0, z: 0 },
    ];
    const result = interpolatePolyline(points, 0.5);
    expect(result.x).toBeCloseTo(2);
    expect(result.y).toBeCloseTo(0);
    expect(result.z).toBeCloseTo(0);
  });
});
