import { useCallback, useRef, useState } from 'react';
import { DWELL_DELAY_MS, GRACE_ZONE_DELAY_MS } from '../constants';

export interface UseDwellTooltipResult {
  /** Segment index whose info panel is currently visible (null = hidden). */
  readonly visibleIndex: number | null;
  /** Call when the hovered segment changes (from hit testing). */
  readonly onHoverChange: (segmentIndex: number | null) => void;
  /** Call when the cursor moves (resets dwell timer, manages grace zone). */
  readonly onCursorMove: (infoPanelVisible: boolean) => void;
  /** Call when dragging starts — hides everything. */
  readonly onDragStart: () => void;
  /** Call when the cursor leaves the canvas. */
  readonly onCanvasLeave: (infoPanelVisible: boolean) => void;
  /** Call when the cursor enters the info panel. */
  readonly onPanelEnter: () => void;
  /** Call when the cursor leaves the info panel. */
  readonly onPanelLeave: () => void;
  /** Whether the cursor is currently inside the info panel. */
  readonly cursorInPanel: boolean;
  /** Force-hide the tooltip. */
  readonly hide: () => void;
}

/**
 * Manages the dwell timer (80ms) and grace zone timer (300ms) state machine
 * for the segment info tooltip.
 */
export function useDwellTooltip(): UseDwellTooltipResult {
  const [visibleIndex, setVisibleIndex] = useState<number | null>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cursorInPanelRef = useRef(false);
  const hoveredRef = useRef<number | null>(null);

  const clearDwell = useCallback(() => {
    if (dwellTimerRef.current !== undefined) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = undefined;
    }
  }, []);

  const clearGrace = useCallback(() => {
    if (graceTimerRef.current !== undefined) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = undefined;
    }
  }, []);

  const hide = useCallback(() => {
    setVisibleIndex(null);
    cursorInPanelRef.current = false;
  }, []);

  const startGraceDismiss = useCallback(() => {
    clearGrace();
    graceTimerRef.current = setTimeout(() => {
      graceTimerRef.current = undefined;
      if (!cursorInPanelRef.current) {
        hide();
      }
    }, GRACE_ZONE_DELAY_MS);
  }, [clearGrace, hide]);

  const startDwell = useCallback(() => {
    clearDwell();
    const idx = hoveredRef.current;
    if (idx !== null) {
      dwellTimerRef.current = setTimeout(() => {
        dwellTimerRef.current = undefined;
        if (hoveredRef.current === idx) {
          setVisibleIndex(idx);
        }
      }, DWELL_DELAY_MS);
    }
  }, [clearDwell]);

  const onHoverChange = useCallback(
    (segmentIndex: number | null) => {
      hoveredRef.current = segmentIndex;
      startDwell();
    },
    [startDwell]
  );

  const onCursorMove = useCallback(
    (infoPanelVisible: boolean) => {
      clearDwell();
      if (infoPanelVisible && !cursorInPanelRef.current) {
        startGraceDismiss();
      } else if (!cursorInPanelRef.current) {
        hide();
      }
    },
    [clearDwell, startGraceDismiss, hide]
  );

  const onDragStart = useCallback(() => {
    hoveredRef.current = null;
    clearDwell();
    clearGrace();
    hide();
  }, [clearDwell, clearGrace, hide]);

  const onCanvasLeave = useCallback(
    (infoPanelVisible: boolean) => {
      clearDwell();
      if (infoPanelVisible && !cursorInPanelRef.current) {
        startGraceDismiss();
      } else if (!cursorInPanelRef.current) {
        hide();
      }
    },
    [clearDwell, startGraceDismiss, hide]
  );

  const onPanelEnter = useCallback(() => {
    cursorInPanelRef.current = true;
    clearGrace();
    clearDwell();
  }, [clearGrace, clearDwell]);

  const onPanelLeave = useCallback(() => {
    cursorInPanelRef.current = false;
    clearGrace();
    hide();
  }, [clearGrace, hide]);

  return {
    visibleIndex,
    onHoverChange,
    onCursorMove,
    onDragStart,
    onCanvasLeave,
    onPanelEnter,
    onPanelLeave,
    cursorInPanel: cursorInPanelRef.current,
    hide,
  };
}
