import { segmentDuration } from '../../webview/playback/timing';
import { MotionType, PathSegment } from '../../visualizer/types';

const RAPID_SPEED = 3000; // mm/min
const DEFAULT_FEED = 300; // mm/min

function makeSegment(
  type: MotionType,
  lengthMm: number,
  feedRate: number | null = null
): PathSegment {
  return {
    type,
    points: [
      { x: 0, y: 0, z: 0 },
      { x: lengthMm, y: 0, z: 0 },
    ],
    context: { sourceLine: 0, feedRate, spindleSpeed: null },
  };
}

function makeSegmentNoContext(type: MotionType, lengthMm: number): PathSegment {
  return {
    type,
    points: [
      { x: 0, y: 0, z: 0 },
      { x: lengthMm, y: 0, z: 0 },
    ],
  };
}

describe('segmentDuration', () => {
  describe('feed segments', () => {
    it('computes duration for a feed segment with explicit feed rate', () => {
      // 100mm at F600 mm/min = 600/60 = 10 mm/s → 100/10 = 10 seconds
      const segment = makeSegment(MotionType.FEED, 100, 600);
      expect(segmentDuration(segment, RAPID_SPEED, DEFAULT_FEED)).toBeCloseTo(10, 5);
    });

    it('uses defaultFeedMmMin when context feed rate is null', () => {
      // 100mm at DEFAULT_FEED=300 mm/min = 5 mm/s → 100/5 = 20 seconds
      const segment = makeSegment(MotionType.FEED, 100, null);
      expect(segmentDuration(segment, RAPID_SPEED, DEFAULT_FEED)).toBeCloseTo(20, 5);
    });

    it('uses defaultFeedMmMin when segment has no context', () => {
      // 60mm at DEFAULT_FEED=300 mm/min = 5 mm/s → 60/5 = 12 seconds
      const segment = makeSegmentNoContext(MotionType.FEED, 60);
      expect(segmentDuration(segment, RAPID_SPEED, DEFAULT_FEED)).toBeCloseTo(12, 5);
    });
  });

  describe('rapid segments', () => {
    it('uses rapidSpeedMmMin regardless of context feed rate', () => {
      // 300mm at RAPID_SPEED=3000 mm/min = 50 mm/s → 300/50 = 6 seconds
      const segment = makeSegment(MotionType.RAPID, 300, 600);
      expect(segmentDuration(segment, RAPID_SPEED, DEFAULT_FEED)).toBeCloseTo(6, 5);
    });

    it('uses rapidSpeedMmMin even when context feed rate is null', () => {
      // 150mm at RAPID_SPEED=3000 mm/min = 50 mm/s → 150/50 = 3 seconds
      const segment = makeSegment(MotionType.RAPID, 150, null);
      expect(segmentDuration(segment, RAPID_SPEED, DEFAULT_FEED)).toBeCloseTo(3, 5);
    });

    it('uses rapidSpeedMmMin when segment has no context', () => {
      // 3000mm at RAPID_SPEED=3000 mm/min = 50 mm/s → 3000/50 = 60 seconds
      const segment = makeSegmentNoContext(MotionType.RAPID, 3000);
      expect(segmentDuration(segment, RAPID_SPEED, DEFAULT_FEED)).toBeCloseTo(60, 5);
    });
  });

  describe('arc segments', () => {
    it('uses context feed rate for arc_cw segment', () => {
      // 120mm at F360 mm/min = 6 mm/s → 120/6 = 20 seconds
      const segment = makeSegment(MotionType.ARC_CW, 120, 360);
      expect(segmentDuration(segment, RAPID_SPEED, DEFAULT_FEED)).toBeCloseTo(20, 5);
    });

    it('uses defaultFeedMmMin for arc_ccw segment with null feed rate', () => {
      // 150mm at DEFAULT_FEED=300 mm/min = 5 mm/s → 150/5 = 30 seconds
      const segment = makeSegment(MotionType.ARC_CCW, 150, null);
      expect(segmentDuration(segment, RAPID_SPEED, DEFAULT_FEED)).toBeCloseTo(30, 5);
    });
  });

  describe('edge cases', () => {
    it('returns 0 for a zero-length segment', () => {
      const segment = makeSegment(MotionType.FEED, 0, 600);
      expect(segmentDuration(segment, RAPID_SPEED, DEFAULT_FEED)).toBe(0);
    });

    it('returns 0 when rapidSpeedMmMin is zero for a rapid segment', () => {
      const segment = makeSegment(MotionType.RAPID, 100, null);
      expect(segmentDuration(segment, 0, DEFAULT_FEED)).toBe(0);
    });

    it('returns 0 when effective feed rate is zero for a feed segment', () => {
      const segment = makeSegment(MotionType.FEED, 100, 0);
      expect(segmentDuration(segment, RAPID_SPEED, 0)).toBe(0);
    });

    it('returns 0 when defaultFeedMmMin is zero and context feed rate is null', () => {
      const segment = makeSegment(MotionType.FEED, 100, null);
      expect(segmentDuration(segment, RAPID_SPEED, 0)).toBe(0);
    });

    it('handles a segment with a single point (no length)', () => {
      const segment: PathSegment = {
        type: MotionType.FEED,
        points: [{ x: 5, y: 5, z: 5 }],
        context: { sourceLine: 0, feedRate: 600, spindleSpeed: null },
      };
      expect(segmentDuration(segment, RAPID_SPEED, DEFAULT_FEED)).toBe(0);
    });
  });
});
