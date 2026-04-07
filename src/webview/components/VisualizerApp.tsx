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

export function VisualizerApp() {
  const { error } = useDocumentState();
  const { settings, updateSettings } = useVisualizerSettings();
  const { resetView } = useCameraControls();

  return (
    <VisualizerProvider>
      <div id="app">
        <Toolbar settings={settings} onSettingsChange={updateSettings} onResetView={resetView} />
        {error && <ErrorBanner message={error} />}
        <CanvasArea />
      </div>
    </VisualizerProvider>
  );
}
