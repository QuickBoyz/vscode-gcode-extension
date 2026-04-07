import React, { useCallback, useRef } from 'react';
import { useDocumentState, useVisualizerSettings } from '../context/VisualizerContext';
import { ToolPathCanvas } from './ToolPathCanvas';
import { InfoPanel } from './InfoPanel';
import { SegmentStats } from './SegmentStats';
import { EmptyMessage } from './EmptyMessage';
import { LoadingOverlay } from './LoadingOverlay';
import { PlaybackBarWrapper } from './PlaybackBar';

export function CanvasArea() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { segments, loading } = useDocumentState();
  const { settings, updateSettings } = useVisualizerSettings();

  const handleFollowChange = useCallback(
    (follow: boolean) => {
      updateSettings({ playback: { ...settings.playback, followSourceLine: follow } });
    },
    [settings.playback, updateSettings]
  );

  return (
    <div id="canvas-wrapper" ref={wrapperRef}>
      <ToolPathCanvas wrapperRef={wrapperRef} />
      {segments.length === 0 && !loading && <EmptyMessage />}
      {loading && <LoadingOverlay />}
      <SegmentStats count={segments.length} />
      <InfoPanel wrapperRef={wrapperRef} />
      <PlaybackBarWrapper
        followSourceLine={settings.playback.followSourceLine}
        onFollowChange={handleFollowChange}
      />
    </div>
  );
}
