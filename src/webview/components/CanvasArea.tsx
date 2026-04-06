import React from 'react';
import { PathBounds, PathSegment, VisualizerConfig } from '../../visualizer/types';
import { ToolPathCanvas, CameraControls } from './ToolPathCanvas';
import { InfoPanel } from './InfoPanel';
import { SegmentStats } from './SegmentStats';
import { EmptyMessage } from './EmptyMessage';
import { LoadingOverlay } from './LoadingOverlay';

interface CanvasAreaProps {
  readonly segments: PathSegment[];
  readonly bounds: PathBounds | null;
  readonly settings: VisualizerConfig;
  readonly loading: boolean;
  readonly hoveredSegmentIndex: number | null;
  readonly infoPanelVisible: boolean;
  readonly sourceTokens: readonly { text: string; type: string }[][] | undefined;
  readonly mouseClientX: number;
  readonly mouseClientY: number;
  readonly onHoverChange: (index: number | null) => void;
  readonly onCursorMove: (infoPanelVisible: boolean) => void;
  readonly onCanvasLeave: (infoPanelVisible: boolean) => void;
  readonly onDragStart: () => void;
  readonly onMousePosition: (clientX: number, clientY: number) => void;
  readonly onCameraReady: (controls: CameraControls) => void;
  readonly onPanelEnter: () => void;
  readonly onPanelLeave: () => void;
}

export const CanvasArea: React.FC<CanvasAreaProps> = ({
  segments,
  bounds,
  settings,
  loading,
  hoveredSegmentIndex,
  infoPanelVisible,
  sourceTokens,
  mouseClientX,
  mouseClientY,
  onHoverChange,
  onCursorMove,
  onCanvasLeave,
  onDragStart,
  onMousePosition,
  onCameraReady,
  onPanelEnter,
  onPanelLeave,
}) => {
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const hoveredSegment =
    hoveredSegmentIndex !== null && hoveredSegmentIndex < segments.length
      ? segments[hoveredSegmentIndex]
      : null;

  return (
    <div id="canvas-wrapper" ref={wrapperRef}>
      <ToolPathCanvas
        segments={segments}
        bounds={bounds}
        settings={settings}
        hoveredSegmentIndex={hoveredSegmentIndex}
        onHoverChange={onHoverChange}
        onCursorMove={onCursorMove}
        onCanvasLeave={onCanvasLeave}
        onDragStart={onDragStart}
        infoPanelVisible={infoPanelVisible}
        onMousePosition={onMousePosition}
        wrapperRef={wrapperRef}
        onCameraReady={onCameraReady}
      />
      <EmptyMessage visible={segments.length === 0 && !loading} />
      <LoadingOverlay visible={loading} />
      <SegmentStats count={segments.length} />
      <InfoPanel
        segment={hoveredSegment}
        segmentIndex={infoPanelVisible ? hoveredSegmentIndex : null}
        sourceTokens={sourceTokens}
        mouseClientX={mouseClientX}
        mouseClientY={mouseClientY}
        wrapperRef={wrapperRef}
        onMouseEnter={onPanelEnter}
        onMouseLeave={onPanelLeave}
      />
    </div>
  );
};
