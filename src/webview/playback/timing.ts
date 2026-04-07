import { MotionType, PathSegment } from '../../visualizer/types';
import { polylineLength } from './geometry';

/**
 * Computes the time in seconds needed to traverse a path segment at its
 * effective feed rate.
 *
 * - RAPID segments always use `rapidSpeedMmMin`.
 * - All other segment types use the feed rate from `segment.context`, falling
 *   back to `defaultFeedMmMin` when the context is absent or its feed rate is
 *   null.
 * - Feed rates are expressed in mm/min; the function divides by 60 to convert
 *   to mm/s before computing duration = length / speed.
 * - Returns 0 for zero-length segments or when the effective speed is zero.
 */
export function segmentDuration(
  segment: PathSegment,
  rapidSpeedMmMin: number,
  defaultFeedMmMin: number
): number {
  const length = polylineLength(segment.points);
  if (length === 0) {
    return 0;
  }

  const feedMmMin =
    segment.type === MotionType.RAPID
      ? rapidSpeedMmMin
      : (segment.context?.feedRate ?? defaultFeedMmMin);

  if (feedMmMin === 0) {
    return 0;
  }

  const speedMmPerSec = feedMmMin / 60;
  return length / speedMmPerSec;
}
