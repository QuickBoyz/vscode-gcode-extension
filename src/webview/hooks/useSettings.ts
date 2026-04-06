import { useCallback, useState } from 'react';
import { ProjectionMode, VisualizerConfig } from '../../visualizer/types';
import vscode from '../vscodeApi';

const DEFAULT_SETTINGS: VisualizerConfig = {
  rapidColor: '#ff6b6b',
  feedColor: '#4ecdc4',
  arcColor: '#45b7d1',
  lineThickness: 1,
  showGrid: true,
  gridSpacing: 10,
  showRapidMoves: true,
  projection: ProjectionMode.PERSPECTIVE,
};

export interface UseSettingsResult {
  readonly settings: VisualizerConfig;
  readonly updateSettings: (patch: Partial<VisualizerConfig>) => void;
  readonly applyExternalSettings: (patch: Partial<VisualizerConfig>) => void;
}

/**
 * Manages the visualizer settings state. Changes are synced to the
 * extension host via postMessage so they can be persisted.
 */
export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<VisualizerConfig>(DEFAULT_SETTINGS);

  const updateSettings = useCallback((patch: Partial<VisualizerConfig>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      vscode.postMessage({ type: 'settingsChange', settings: next });
      return next;
    });
  }, []);

  /** Apply settings from the extension without posting back. */
  const applyExternalSettings = useCallback((patch: Partial<VisualizerConfig>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return { settings, updateSettings, applyExternalSettings };
}
