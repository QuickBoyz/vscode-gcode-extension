import React, { useRef } from 'react';
import {
  VisualizerProvider,
  useDocumentState,
  useVisualizerSettings,
  useCameraControls,
  useScheduleRender,
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

  const handlePlaybackToggle = () => {
    if (isPlaybackActive) {
      stop();
    } else {
      play();
    }
  };

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
  const scheduleRender = useScheduleRender();

  const segmentsRef = useRef<PathSegment[]>(segments);
  segmentsRef.current = segments;

  return (
    <PlaybackProvider
      segmentsRef={segmentsRef}
      scheduleRender={scheduleRender}
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
