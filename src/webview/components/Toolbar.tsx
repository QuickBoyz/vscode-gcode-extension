import React from 'react';
import { ProjectionMode, VisualizerConfig } from '../../visualizer/types';

interface ToolbarProps {
  readonly settings: VisualizerConfig;
  readonly onSettingsChange: (patch: Partial<VisualizerConfig>) => void;
  readonly onResetView: () => void;
}

export function Toolbar({ settings, onSettingsChange, onResetView }: ToolbarProps) {
  return (
    <div id="toolbar">
      <div className="ctrl-group">
        <label htmlFor="rapidColor">Rapid:</label>
        <input
          type="color"
          id="rapidColor"
          value={settings.rapidColor}
          title="Rapid move colour"
          onChange={(e) => onSettingsChange({ rapidColor: e.target.value })}
        />
      </div>
      <div className="ctrl-group">
        <label htmlFor="feedColor">Feed:</label>
        <input
          type="color"
          id="feedColor"
          value={settings.feedColor}
          title="Feed move colour"
          onChange={(e) => onSettingsChange({ feedColor: e.target.value })}
        />
      </div>
      <div className="ctrl-group">
        <label htmlFor="arcColor">Arc:</label>
        <input
          type="color"
          id="arcColor"
          value={settings.arcColor}
          title="Arc move colour"
          onChange={(e) => onSettingsChange({ arcColor: e.target.value })}
        />
      </div>
      <div className="ctrl-group">
        <label htmlFor="thickness">Thickness:</label>
        <input
          type="range"
          id="thickness"
          min="0.5"
          max="5"
          step="0.5"
          value={settings.lineThickness}
          title="Line thickness"
          onChange={(e) => onSettingsChange({ lineThickness: parseFloat(e.target.value) })}
        />
        <span className="thickness-val">{settings.lineThickness}</span>
      </div>
      <button id="btnReset" title="Reset camera to fit the whole part" onClick={onResetView}>
        Reset View
      </button>
      <button
        id="btnToggleGrid"
        title="Toggle grid visibility"
        className={settings.showGrid ? 'active' : ''}
        onClick={() => onSettingsChange({ showGrid: !settings.showGrid })}
      >
        Grid
      </button>
      <button
        id="btnToggleRapid"
        title="Toggle rapid move visibility"
        className={settings.showRapidMoves ? 'active' : ''}
        onClick={() => onSettingsChange({ showRapidMoves: !settings.showRapidMoves })}
      >
        Rapid
      </button>
      <button
        id="btnToggleProjection"
        title="Toggle perspective/orthographic projection"
        onClick={() =>
          onSettingsChange({
            projection:
              settings.projection === ProjectionMode.PERSPECTIVE
                ? ProjectionMode.ORTHOGRAPHIC
                : ProjectionMode.PERSPECTIVE,
          })
        }
      >
        {settings.projection === ProjectionMode.PERSPECTIVE ? 'Persp' : 'Ortho'}
      </button>
      <span className="hint">
        Left drag: rotate &nbsp;&middot;&nbsp; Shift+drag / Right drag: pan &nbsp;&middot;&nbsp;
        Scroll: zoom
      </span>
    </div>
  );
}
