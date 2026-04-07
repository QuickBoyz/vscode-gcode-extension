import React, { useLayoutEffect, useRef } from 'react';
import { MotionType } from '../../visualizer/types';
import { INFO_PANEL_OFFSET_X, INFO_PANEL_OFFSET_Y } from '../constants';
import { useDocumentState, useTooltip } from '../context/VisualizerContext';
import vscode from '../vscodeApi';

interface InfoPanelProps {
  readonly wrapperRef: React.RefObject<HTMLDivElement | null>;
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

export function InfoPanel({ wrapperRef }: InfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { segments, sourceTokens } = useDocumentState();
  const { visibleIndex, anchorPosition, onPanelEnter, onPanelLeave } = useTooltip();

  // Position the panel after render so we can measure its dimensions.
  // Depends on visibleIndex (triggers when a new segment becomes visible)
  // and anchorPosition (captured by the dwell tooltip when the timer fires).
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const wrapper = wrapperRef.current;
    if (!panel || !wrapper || visibleIndex === null) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const cursorX = anchorPosition.x - wrapperRect.left;
    const cursorY = anchorPosition.y - wrapperRect.top;
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
  }, [visibleIndex, anchorPosition, wrapperRef]);

  const segment =
    visibleIndex !== null && visibleIndex < segments.length ? segments[visibleIndex] : null;

  if (visibleIndex === null || !segment) {
    return null;
  }

  const ctx = segment.context;
  const startPoint = segment.points[0];
  const endPoint = segment.points[segment.points.length - 1];
  const extraParams = ctx?.extraParams;
  const lineNum = ctx?.sourceLine;
  const tokens = lineNum !== undefined ? sourceTokens?.[lineNum] : undefined;

  return (
    <div id="info-panel" ref={panelRef} onMouseEnter={onPanelEnter} onMouseLeave={onPanelLeave}>
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
}
