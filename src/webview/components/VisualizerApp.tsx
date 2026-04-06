import React, { useCallback, useRef, useState } from 'react';
import { PathBounds, PathSegment } from '../../visualizer/types';
import { useExtensionMessages } from '../hooks/useExtensionMessages';
import { useSettings } from '../hooks/useSettings';
import { useDwellTooltip } from '../hooks/useDwellTooltip';
import { DEFAULT_ERROR_MESSAGE } from '../constants';
import { Toolbar } from './Toolbar';
import { ErrorBanner } from './ErrorBanner';
import { CanvasArea } from './CanvasArea';
import { CameraControls } from './ToolPathCanvas';

export const VisualizerApp: React.FC = () => {
  const [segments, setSegments] = useState<PathSegment[]>([]);
  const [bounds, setBounds] = useState<PathBounds | null>(null);
  const [sourceTokens, setSourceTokens] = useState<
    readonly { text: string; type: string }[][] | undefined
  >();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mouseClientX, setMouseClientX] = useState(0);
  const [mouseClientY, setMouseClientY] = useState(0);

  const cameraControlsRef = useRef<CameraControls | null>(null);
  const segmentsRef = useRef<PathSegment[]>(segments);
  segmentsRef.current = segments;
  const boundsRef = useRef<PathBounds | null>(bounds);
  boundsRef.current = bounds;

  const { settings, updateSettings, applyExternalSettings } = useSettings();

  const {
    visibleIndex,
    onHoverChange,
    onCursorMove,
    onDragStart,
    onCanvasLeave,
    onPanelEnter,
    onPanelLeave,
    hide: hideTooltip,
  } = useDwellTooltip();

  const handleCameraReady = useCallback((controls: CameraControls) => {
    cameraControlsRef.current = controls;
  }, []);

  const handleMousePosition = useCallback((clientX: number, clientY: number) => {
    setMouseClientX(clientX);
    setMouseClientY(clientY);
  }, []);

  const handleResetView = useCallback(() => {
    cameraControlsRef.current?.resetView(segmentsRef.current, boundsRef.current);
  }, []);

  // Handle messages from the extension host
  const handleMessage = useCallback(
    (message: unknown) => {
      const msg = message as Record<string, unknown>;
      switch (msg.type) {
        case 'update': {
          setLoading(false);
          setError(null);
          const newSegments = (msg.segments as PathSegment[]) || [];
          const newBounds = (msg.bounds as PathBounds) || null;
          setSegments(newSegments);
          setBounds(newBounds);
          setSourceTokens(msg.sourceTokens as readonly { text: string; type: string }[][] | undefined);
          // Clear stale hover state
          hideTooltip();
          // Defer fitView + render to next tick so state has flushed
          requestAnimationFrame(() => {
            const controls = cameraControlsRef.current;
            if (controls) {
              controls.clearProjectedCache();
              controls.fitView(newSegments, newBounds);
              controls.scheduleRender();
            }
          });
          break;
        }
        case 'updateSettings': {
          const incoming = msg.settings as Record<string, unknown> | undefined;
          if (incoming) {
            applyExternalSettings(incoming);
          }
          break;
        }
        case 'error': {
          setLoading(false);
          setError((msg.message as string) || DEFAULT_ERROR_MESSAGE);
          break;
        }
        case 'loading': {
          setLoading(true);
          break;
        }
      }
    },
    [applyExternalSettings, hideTooltip]
  );

  useExtensionMessages(handleMessage);

  // When settings change via toolbar, re-render canvas
  const handleSettingsChange = useCallback(
    (patch: Parameters<typeof updateSettings>[0]) => {
      updateSettings(patch);
      // Schedule a re-render after settings update
      requestAnimationFrame(() => {
        const controls = cameraControlsRef.current;
        if (controls) {
          controls.clearProjectedCache();
          controls.scheduleRender();
        }
      });
    },
    [updateSettings]
  );

  return (
    <div id="app">
      <Toolbar
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onResetView={handleResetView}
      />
      <ErrorBanner message={error} />
      <CanvasArea
        segments={segments}
        bounds={bounds}
        settings={settings}
        loading={loading}
        hoveredSegmentIndex={visibleIndex}
        infoPanelVisible={visibleIndex !== null}
        sourceTokens={sourceTokens}
        mouseClientX={mouseClientX}
        mouseClientY={mouseClientY}
        onHoverChange={onHoverChange}
        onCursorMove={onCursorMove}
        onCanvasLeave={onCanvasLeave}
        onDragStart={onDragStart}
        onMousePosition={handleMousePosition}
        onCameraReady={handleCameraReady}
        onPanelEnter={onPanelEnter}
        onPanelLeave={onPanelLeave}
      />
    </div>
  );
};
