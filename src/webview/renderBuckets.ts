import { MotionType } from '../visualizer/types';

/**
 * Visual style buckets used by the render loop to batch segments into
 * a small number of draw calls. Segments within the same bucket share
 * stroke style, line width and dash pattern so their path primitives
 * can be merged into a single `Path2D` and flushed with one `stroke()`.
 *
 * Correctness note: bucketing does NOT replace painter's-algorithm
 * depth sorting. The render loop walks segments in sorted order and
 * only collapses runs of *contiguous, same-bucket* segments into the
 * same Path2D, so far-to-near ordering is preserved exactly.
 */
export enum StyleBucket {
  FEED = 0,
  RAPID = 1,
  ARC = 2,
}

export const STYLE_BUCKET_COUNT = 3;

export function classifyBucket(motionType: MotionType): StyleBucket {
  switch (motionType) {
    case MotionType.RAPID:
      return StyleBucket.RAPID;
    case MotionType.ARC_CW:
    case MotionType.ARC_CCW:
      return StyleBucket.ARC;
    case MotionType.FEED:
    default:
      return StyleBucket.FEED;
  }
}
