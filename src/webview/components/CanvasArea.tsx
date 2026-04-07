import React, { useRef } from 'react';
import { useDocumentState } from '../context/VisualizerContext';
import { ToolPathCanvas } from './ToolPathCanvas';
import { InfoPanel } from './InfoPanel';
import { SegmentStats } from './SegmentStats';
import { EmptyMessage } from './EmptyMessage';
import { LoadingOverlay } from './LoadingOverlay';

export function CanvasArea() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { segments, loading } = useDocumentState();

  return (
    <div id="canvas-wrapper" ref={wrapperRef}>
      <ToolPathCanvas wrapperRef={wrapperRef} />
      {segments.length === 0 && !loading && <EmptyMessage />}
      {loading && <LoadingOverlay />}
      <SegmentStats count={segments.length} />
      <InfoPanel wrapperRef={wrapperRef} />
    </div>
  );
}
