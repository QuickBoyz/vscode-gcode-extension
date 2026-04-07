import React, { useCallback, useRef } from 'react';
import {
  VisualizerProvider,
  useDocumentState,
  useVisualizerSettings,
  useCameraControls,
  useRenderNow,
} from '../context/VisualizerContext';
import {
  PlaybackProvider,
  usePlaybackSnapshot,
  usePlaybackActions,
} from '../context/PlaybackContext';
import { PlaybackStatus } from '../playback/types';
import { PathSegment } from '../../visualizer/types';
import { Toolbar } from './Toolbar';
import { ErrorBanner } from './ErrorBanner';
import { CanvasArea } from './CanvasArea';

function VisualizerLayout() {
  const { error } = useDocumentState();
  const { settings, updateSettings } = useVisualizerSettings();
  const { resetView } = useCameraControls();
  const snapshot = usePlaybackSnapshot();
  const { play, stop } = usePlaybackActions();

  const isPlaybackActive = snapshot.status !== PlaybackStatus.IDLE;

  const handlePlaybackToggle = useCallback(() => {
    if (isPlaybackActive) {
      stop();
    } else {
      play();
    }
  }, [isPlaybackActive, play, stop]);

  return (
    <div id="app">
      <Toolbar
        settings={settings}
        onSettingsChange={updateSettings}
        onResetView={resetView}
        onPlayback={handlePlaybackToggle}
        isPlaybackActive={isPlaybackActive}
      />
      {error && <ErrorBanner message={error} />}
      <CanvasArea />
    </div>
  );
}

function PlaybackBridge({ children }: { readonly children: React.ReactNode }) {
  const { segments } = useDocumentState();
  const { settings } = useVisualizerSettings();
  const renderNow = useRenderNow();

  const segmentsRef = useRef<PathSegment[]>(segments);
  segmentsRef.current = segments;

  return (
    <PlaybackProvider
      segmentsRef={segmentsRef}
      renderNow={renderNow}
      rapidSpeed={settings.playback.rapidSpeed}
      defaultFeedRate={settings.playback.defaultFeedRate}
      followSourceLine={settings.playback.followSourceLine}
    >
      {children}
    </PlaybackProvider>
  );
}

export function VisualizerApp() {
  return (
    <VisualizerProvider>
      <PlaybackBridge>
        <VisualizerLayout />
      </PlaybackBridge>
    </VisualizerProvider>
  );
}
