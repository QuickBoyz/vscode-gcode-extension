import React, { useCallback, useRef } from 'react';
import {
  DocumentStatusKind,
  useDocumentState,
  useVisualizerSettings,
} from '../context/VisualizerContext';
import { ToolPathCanvas } from './ToolPathCanvas';
import { InfoPanel } from './InfoPanel';
import { SegmentStats } from './SegmentStats';
import { EmptyMessage } from './EmptyMessage';
import { LoadingOverlay } from './LoadingOverlay';
import { PlaybackBarWrapper } from './PlaybackBar';
import { ViewCube } from './ViewCube';

export function CanvasArea() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { segments, status } = useDocumentState();
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
      <ViewCube />
      {status.kind === DocumentStatusKind.IDLE && <EmptyMessage variant="idle" />}
      {status.kind === DocumentStatusKind.EMPTY && (
        <EmptyMessage variant="empty" filename={status.filename} />
      )}
      {status.kind === DocumentStatusKind.ERROR && (
        <EmptyMessage
          variant="error"
          errorKind={status.errorKind}
          filename={status.filename}
          message={status.message}
          range={status.range}
        />
      )}
      {status.kind === DocumentStatusKind.LOADING && (
        <LoadingOverlay phase={status.phase} filename={status.filename} message={status.message} />
      )}
      <SegmentStats count={segments.length} />
      <InfoPanel wrapperRef={wrapperRef} />
      <PlaybackBarWrapper
        followSourceLine={settings.playback.followSourceLine}
        onFollowChange={handleFollowChange}
      />
    </div>
  );
}
