import React, { useRef } from 'react';
import { useDocumentState, useVisualizerSettings } from '../context/VisualizerContext';
import { usePlaybackSnapshot } from '../context/PlaybackContext';
import { PlaybackStatus } from '../playback/types';
import { ToolPathCanvas } from './ToolPathCanvas';
import { InfoPanel } from './InfoPanel';
import { SegmentStats } from './SegmentStats';
import { EmptyMessage } from './EmptyMessage';
import { LoadingOverlay } from './LoadingOverlay';
import { PlaybackBar } from './PlaybackBar';

export function CanvasArea() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { segments, loading } = useDocumentState();
  const snapshot = usePlaybackSnapshot();
  const { settings, updateSettings } = useVisualizerSettings();
  const isPlaybackActive = snapshot.status !== PlaybackStatus.IDLE;

  return (
    <div id="canvas-wrapper" ref={wrapperRef}>
      <ToolPathCanvas wrapperRef={wrapperRef} />
      {segments.length === 0 && !loading && <EmptyMessage />}
      {loading && <LoadingOverlay />}
      <SegmentStats count={segments.length} />
      <InfoPanel wrapperRef={wrapperRef} />
      {isPlaybackActive && (
        <PlaybackBar
          followSourceLine={settings.playback.followSourceLine}
          onFollowChange={(follow) =>
            updateSettings({ playback: { ...settings.playback, followSourceLine: follow } })
          }
        />
      )}
    </div>
  );
}
