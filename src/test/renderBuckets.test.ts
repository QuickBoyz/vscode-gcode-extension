import { MotionType } from '../visualizer/types';
import { classifyBucket, StyleBucket } from '../webview/renderBuckets';

describe('classifyBucket', () => {
  it('classifies rapid moves', () => {
    expect(classifyBucket(MotionType.RAPID)).toBe(StyleBucket.RAPID);
  });

  it('classifies feed moves', () => {
    expect(classifyBucket(MotionType.FEED)).toBe(StyleBucket.FEED);
  });

  it('folds G2 and G3 arcs into the same bucket', () => {
    expect(classifyBucket(MotionType.ARC_CW)).toBe(StyleBucket.ARC);
    expect(classifyBucket(MotionType.ARC_CCW)).toBe(StyleBucket.ARC);
  });
});
