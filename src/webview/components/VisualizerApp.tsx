import React from 'react';
import {
  VisualizerProvider,
  useDocumentState,
  useVisualizerSettings,
  useCameraControls,
} from '../context/VisualizerContext';
import { Toolbar } from './Toolbar';
import { ErrorBanner } from './ErrorBanner';
import { CanvasArea } from './CanvasArea';

function VisualizerLayout() {
  const { error } = useDocumentState();
  const { settings, updateSettings } = useVisualizerSettings();
  const { resetView } = useCameraControls();

  return (
    <div id="app">
      <Toolbar settings={settings} onSettingsChange={updateSettings} onResetView={resetView} />
      {error && <ErrorBanner message={error} />}
      <CanvasArea />
    </div>
  );
}

export function VisualizerApp() {
  return (
    <VisualizerProvider>
      <VisualizerLayout />
    </VisualizerProvider>
  );
}
