import React, { useLayoutEffect, useRef } from 'react';
import { MotionType, PathSegment } from '../../visualizer/types';
import { INFO_PANEL_OFFSET_X, INFO_PANEL_OFFSET_Y } from '../constants';
import vscode from '../vscodeApi';

/**
 * Captures the mouse position at the moment the tooltip becomes visible
 * so the panel stays anchored instead of following the cursor.
 */
function useAnchoredPosition(
  segmentIndex: number | null,
  mouseClientX: number,
  mouseClientY: number
): { readonly x: number; readonly y: number } {
  const anchorRef = useRef({ x: 0, y: 0 });
  const prevIndexRef = useRef<number | null>(null);

  if (segmentIndex !== null && prevIndexRef.current !== segmentIndex) {
    anchorRef.current = { x: mouseClientX, y: mouseClientY };
  }
  prevIndexRef.current = segmentIndex;

  return anchorRef.current;
}

interface InfoPanelProps {
  readonly segment: PathSegment | null;
  readonly segmentIndex: number | null;
  readonly sourceTokens: readonly { text: string; type: string }[][] | undefined;
  readonly mouseClientX: number;
  readonly mouseClientY: number;
  readonly wrapperRef: React.RefObject<HTMLDivElement | null>;
  readonly onMouseEnter: () => void;
  readonly onMouseLeave: () => void;
}

function formatMotionType(type: MotionType): string {
  switch (type) {
    case MotionType.RAPID:
      return 'Rapid';
    case MotionType.FEED:
      return 'Feed';
    case MotionType.ARC_CW:
      return 'Arc CW';
    case MotionType.ARC_CCW:
      return 'Arc CCW';
    default:
      return 'Unknown';
  }
}

export const InfoPanel: React.FC<InfoPanelProps> = ({
  segment,
  segmentIndex,
  sourceTokens,
  mouseClientX,
  mouseClientY,
  wrapperRef,
  onMouseEnter,
  onMouseLeave,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const anchor = useAnchoredPosition(segmentIndex, mouseClientX, mouseClientY);

  // Position the panel after render so we can measure its dimensions.
  // Only re-run when the visible segment changes (anchor updates), not on every cursor move.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const wrapper = wrapperRef.current;
    if (!panel || !wrapper || segmentIndex === null) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const cursorX = anchor.x - wrapperRect.left;
    const cursorY = anchor.y - wrapperRect.top;
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;

    let panelX = cursorX - panelWidth - INFO_PANEL_OFFSET_X;
    if (panelX < 0) {
      panelX = cursorX + INFO_PANEL_OFFSET_X;
    }

    let panelY = cursorY - INFO_PANEL_OFFSET_Y;
    if (panelY + panelHeight > wrapperRect.height) {
      panelY = wrapperRect.height - panelHeight;
    }
    if (panelY < 0) {
      panelY = 0;
    }

    panel.style.left = `${panelX}px`;
    panel.style.top = `${panelY}px`;
  }, [segmentIndex, anchor, wrapperRef]);

  if (segmentIndex === null || !segment) {
    return <div id="info-panel" />;
  }

  const ctx = segment.context;
  const startPoint = segment.points[0];
  const endPoint = segment.points[segment.points.length - 1];
  const extraParams = ctx?.extraParams;
  const lineNum = ctx?.sourceLine;
  const tokens = lineNum !== undefined ? sourceTokens?.[lineNum] : undefined;

  return (
    <div id="info-panel" ref={panelRef} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div id="info-type">{formatMotionType(segment.type)}</div>
      <div id="info-source">
        {lineNum !== undefined && <span className="token-line-num">{`Line ${lineNum + 1}: `}</span>}
        {tokens?.map((token, i) => (
          <span key={i} className={`token-${token.type}`}>
            {token.text}
          </span>
        ))}
      </div>
      <div id="info-feed">
        {ctx?.feedRate !== null && ctx?.feedRate !== undefined ? `Feed: ${ctx.feedRate}` : ''}
      </div>
      <div id="info-spindle">
        {ctx?.spindleSpeed !== null && ctx?.spindleSpeed !== undefined
          ? `Spindle: ${ctx.spindleSpeed}`
          : ''}
      </div>
      <div id="info-coords">
        {`X:${startPoint.x.toFixed(3)} Y:${startPoint.y.toFixed(3)} Z:${startPoint.z.toFixed(3)}`}
        {' → '}
        {`X:${endPoint.x.toFixed(3)} Y:${endPoint.y.toFixed(3)} Z:${endPoint.z.toFixed(3)}`}
      </div>
      <div id="info-extra">
        {extraParams && Object.keys(extraParams).length > 0
          ? Object.entries(extraParams)
              .map(([axis, value]) => `${axis}:${value.toFixed(3)}`)
              .join(' ')
          : ''}
      </div>
      {ctx && lineNum !== undefined && (
        <button
          id="info-goto"
          type="button"
          onClick={() => vscode.postMessage({ type: 'navigateToLine', line: lineNum })}
        >
          {`Go to line ${lineNum + 1}`}
        </button>
      )}
    </div>
  );
};
