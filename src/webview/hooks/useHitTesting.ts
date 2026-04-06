import { useCallback, useRef } from 'react';
import { hitTestSegments, ProjectedSegmentData } from '../hitTesting';
import { HIT_TEST_TOLERANCE } from '../constants';

export interface UseHitTestingResult {
  /** Schedule a hit test for the given canvas coordinates (rAF-gated). */
  readonly scheduleHitTest: (x: number, y: number) => void;
}

/**
 * rAF-gated hit testing against the projected segment cache.
 * Calls `onHover` when the hovered segment changes.
 */
export function useHitTesting(
  getProjectedCache: () => readonly ProjectedSegmentData[],
  onHover: (segmentIndex: number | null) => void
): UseHitTestingResult {
  const pendingRef = useRef({ x: 0, y: 0 });
  const scheduledRef = useRef(false);
  const prevIndexRef = useRef<number | null>(null);

  const processHitTest = useCallback(() => {
    scheduledRef.current = false;
    const hit = hitTestSegments(
      pendingRef.current.x,
      pendingRef.current.y,
      getProjectedCache() as ProjectedSegmentData[],
      HIT_TEST_TOLERANCE
    );
    const newIndex = hit ? hit.segmentIndex : null;
    if (newIndex !== prevIndexRef.current) {
      prevIndexRef.current = newIndex;
    }
    // Always notify — the dwell timer needs restarting even if the same segment
    onHover(newIndex);
  }, [getProjectedCache, onHover]);

  const scheduleHitTest = useCallback(
    (x: number, y: number) => {
      pendingRef.current = { x, y };
      if (!scheduledRef.current) {
        scheduledRef.current = true;
        requestAnimationFrame(processHitTest);
      }
    },
    [processHitTest]
  );

  return { scheduleHitTest };
}
