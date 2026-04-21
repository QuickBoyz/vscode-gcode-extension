import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { PathBounds, PathSegment, VisualizerConfig } from '../../visualizer/types';
import { CameraState } from '../types';
import { DEFAULT_ERROR_MESSAGE } from '../constants';
import { useExtensionMessages } from '../hooks/useExtensionMessages';
import { useSettings } from '../hooks/useSettings';
import { useDwellTooltip } from '../hooks/useDwellTooltip';
import { CameraControls } from '../components/ToolPathCanvas';
import {
  DocumentState,
  ErrorKind,
  INITIAL_DOCUMENT_STATE,
  SourceTokens,
  WebviewMessage,
  documentReducer,
} from './documentReducer';

export { DocumentStatusKind, ErrorKind, LoadingPhase } from './documentReducer';
export type { DocumentStatus } from './documentReducer';

// ── Context value types ─────────────────────────────────────────────

interface VisualizerStateValue {
  readonly document: DocumentState;
  readonly settings: VisualizerConfig;
  readonly tooltip: {
    readonly visibleIndex: number | null;
    readonly anchorPosition: { readonly x: number; readonly y: number };
  };
}

interface VisualizerActionsValue {
  readonly updateSettings: (patch: Partial<VisualizerConfig>) => void;
  readonly resetView: () => void;
  readonly registerCameraControls: (controls: CameraControls) => void;
  readonly scheduleRender: () => void;
  /** Render immediately (synchronous). Use from within an existing rAF callback. */
  readonly renderNow: () => void;
  readonly cameraRef: React.RefObject<CameraState | null>;
  readonly registerCameraState: (camera: CameraState) => void;
  readonly registerAnimationCancel: (cancel: (() => void) | null) => void;
  readonly cancelAnimation: () => void;
  readonly registerCameraChangeListener: (listener: () => void) => () => void;
  readonly notifyCameraChange: () => void;
  readonly updateMousePosition: (clientX: number, clientY: number) => void;
  readonly tooltip: {
    readonly onHoverChange: (index: number | null) => void;
    readonly onCursorMove: (infoPanelVisible: boolean) => void;
    readonly onDragStart: () => void;
    readonly onCanvasLeave: (infoPanelVisible: boolean) => void;
    readonly onPanelEnter: () => void;
    readonly onPanelLeave: () => void;
  };
}

// ── Contexts ────────────────────────────────────────────────────────

const StateContext = createContext<VisualizerStateValue | null>(null);
const ActionsContext = createContext<VisualizerActionsValue | null>(null);

// ── Provider ────────────────────────────────────────────────────────

export function VisualizerProvider({ children }: { readonly children: React.ReactNode }) {
  const [document, dispatch] = useReducer(documentReducer, INITIAL_DOCUMENT_STATE);
  const { settings, updateSettings: rawUpdateSettings, applyExternalSettings } = useSettings();

  const mousePositionRef = useRef({ x: 0, y: 0 });
  const cameraControlsRef = useRef<CameraControls | null>(null);
  const cameraStateRef = useRef<CameraState | null>(null);
  const segmentsRef = useRef<PathSegment[]>(document.segments);
  segmentsRef.current = document.segments;
  const boundsRef = useRef<PathBounds | null>(document.bounds);
  boundsRef.current = document.bounds;

  const {
    visibleIndex,
    anchorPosition,
    onHoverChange,
    onCursorMove,
    onDragStart,
    onCanvasLeave,
    onPanelEnter,
    onPanelLeave,
    hide: hideTooltip,
  } = useDwellTooltip(mousePositionRef);

  // ── Camera controls ───────────────────────────────────────────────

  const registerCameraControls = useCallback((controls: CameraControls) => {
    cameraControlsRef.current = controls;
  }, []);

  const registerCameraState = useCallback((camera: CameraState) => {
    cameraStateRef.current = camera;
  }, []);

  const animationCancelRef = useRef<(() => void) | null>(null);

  const registerAnimationCancel = useCallback((cancel: (() => void) | null) => {
    animationCancelRef.current = cancel;
  }, []);

  const cancelAnimation = useCallback(() => {
    animationCancelRef.current?.();
    animationCancelRef.current = null;
  }, []);

  const cameraChangeListenersRef = useRef<Set<() => void>>(new Set());

  const registerCameraChangeListener = useCallback((listener: () => void): (() => void) => {
    cameraChangeListenersRef.current.add(listener);
    return () => {
      cameraChangeListenersRef.current.delete(listener);
    };
  }, []);

  const notifyCameraChange = useCallback(() => {
    for (const listener of cameraChangeListenersRef.current) {
      listener();
    }
  }, []);

  const resetView = useCallback(() => {
    cameraControlsRef.current?.resetView(segmentsRef.current, boundsRef.current);
    notifyCameraChange();
  }, [notifyCameraChange]);

  const scheduleRender = useCallback(() => {
    cameraControlsRef.current?.scheduleRender();
  }, []);

  const renderNow = useCallback(() => {
    cameraControlsRef.current?.renderNow();
  }, []);

  // ── Settings (triggers canvas re-render) ──────────────────────────

  const updateSettings = useCallback(
    (patch: Partial<VisualizerConfig>) => {
      rawUpdateSettings(patch);
      requestAnimationFrame(() => {
        const controls = cameraControlsRef.current;
        if (controls) {
          controls.clearProjectedCache();
          controls.scheduleRender();
        }
      });
    },
    [rawUpdateSettings]
  );

  // ── Mouse position (stored in ref, no re-renders) ────────────────

  const updateMousePosition = useCallback((clientX: number, clientY: number) => {
    mousePositionRef.current = { x: clientX, y: clientY };
  }, []);

  // ── Extension messages ────────────────────────────────────────────

  const handleMessage = useCallback(
    (message: unknown) => {
      const msg = message as WebviewMessage;
      switch (msg.type) {
        case 'update': {
          const segments = msg.segments ?? [];
          dispatch({
            type: 'update',
            segments,
            bounds: msg.bounds ?? null,
            sourceTokens: msg.sourceTokens as SourceTokens | undefined,
            referencedVariables: msg.referencedVariables ?? [],
            settingsVariables: msg.settingsVariables ?? [],
          });
          hideTooltip();
          window.__gcodeVisualizerState = { totalSegments: segments.length };
          requestAnimationFrame(() => {
            const controls = cameraControlsRef.current;
            if (controls) {
              controls.clearProjectedCache();
              controls.fitView(segments, msg.bounds ?? null);
              controls.scheduleRender();
              notifyCameraChange();
            }
            // Double-rAF: signal ready after the canvas render frame has been queued.
            requestAnimationFrame(() => {
              window.__gcodeVisualizerReady = true;
            });
          });
          break;
        }
        case 'updateSettings': {
          applyExternalSettings(msg.settings);
          break;
        }
        case 'error': {
          dispatch({
            type: 'error',
            errorKind: msg.errorKind ?? ErrorKind.UNKNOWN,
            message: msg.message || DEFAULT_ERROR_MESSAGE,
            range: msg.range ?? null,
          });
          break;
        }
        case 'loading': {
          dispatch({ type: 'loading', phase: msg.phase, filename: msg.filename, message: msg.message });
          break;
        }
      }
    },
    [applyExternalSettings, hideTooltip, notifyCameraChange]
  );

  useExtensionMessages(handleMessage);

  // ── Screenshot harness: camera control messages ───────────────────

  const resetViewRef = useRef(resetView);
  resetViewRef.current = resetView;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'cameraControl') return;
      if (event.data.action === 'resetView') {
        resetViewRef.current();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ── Context values ────────────────────────────────────────────────

  const stateValue = useMemo<VisualizerStateValue>(
    () => ({
      document,
      settings,
      tooltip: { visibleIndex, anchorPosition },
    }),
    [document, settings, visibleIndex, anchorPosition]
  );

  const actionsValue = useMemo<VisualizerActionsValue>(
    () => ({
      updateSettings,
      resetView,
      registerCameraControls,
      scheduleRender,
      renderNow,
      cameraRef: cameraStateRef,
      registerCameraState,
      registerAnimationCancel,
      cancelAnimation,
      registerCameraChangeListener,
      notifyCameraChange,
      updateMousePosition,
      tooltip: {
        onHoverChange,
        onCursorMove,
        onDragStart,
        onCanvasLeave,
        onPanelEnter,
        onPanelLeave,
      },
    }),
    [
      updateSettings,
      resetView,
      registerCameraControls,
      scheduleRender,
      renderNow,
      registerCameraState,
      registerAnimationCancel,
      cancelAnimation,
      registerCameraChangeListener,
      notifyCameraChange,
      updateMousePosition,
      onHoverChange,
      onCursorMove,
      onDragStart,
      onCanvasLeave,
      onPanelEnter,
      onPanelLeave,
    ]
  );

  return (
    <StateContext.Provider value={stateValue}>
      <ActionsContext.Provider value={actionsValue}>{children}</ActionsContext.Provider>
    </StateContext.Provider>
  );
}

// ── Consumer hooks ──────────────────────────────────────────────────

function useVisualizerState(): VisualizerStateValue {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error('useVisualizerState must be used within VisualizerProvider');
  return ctx;
}

function useVisualizerActions(): VisualizerActionsValue {
  const ctx = useContext(ActionsContext);
  if (!ctx) throw new Error('useVisualizerActions must be used within VisualizerProvider');
  return ctx;
}

/** Document data: segments, bounds, sourceTokens, error, loading. */
export function useDocumentState(): DocumentState {
  return useVisualizerState().document;
}

/** Visualizer settings and the update function. */
export function useVisualizerSettings(): {
  readonly settings: VisualizerConfig;
  readonly updateSettings: (patch: Partial<VisualizerConfig>) => void;
} {
  const { settings } = useVisualizerState();
  const { updateSettings } = useVisualizerActions();
  return { settings, updateSettings };
}

/** Tooltip visibility, anchor position, and interaction handlers. */
export function useTooltip(): {
  readonly visibleIndex: number | null;
  readonly anchorPosition: { readonly x: number; readonly y: number };
  readonly onHoverChange: (index: number | null) => void;
  readonly onCursorMove: (infoPanelVisible: boolean) => void;
  readonly onDragStart: () => void;
  readonly onCanvasLeave: (infoPanelVisible: boolean) => void;
  readonly onPanelEnter: () => void;
  readonly onPanelLeave: () => void;
} {
  const { tooltip } = useVisualizerState();
  const { tooltip: actions } = useVisualizerActions();
  return { ...tooltip, ...actions };
}

/** Camera state ref for direct access (e.g. ViewCube sync). */
export function useCameraRef(): React.RefObject<CameraState | null> {
  return useVisualizerActions().cameraRef;
}

/** Camera control registration and reset. */
export function useCameraControls(): {
  readonly registerCameraControls: (controls: CameraControls) => void;
  readonly registerCameraState: (camera: CameraState) => void;
  readonly resetView: () => void;
} {
  const { registerCameraControls, registerCameraState, resetView } = useVisualizerActions();
  return { registerCameraControls, registerCameraState, resetView };
}

/** Mouse position ref update (no re-renders). */
export function useMousePosition(): {
  readonly updateMousePosition: (clientX: number, clientY: number) => void;
} {
  const { updateMousePosition } = useVisualizerActions();
  return { updateMousePosition };
}

/** Register/unregister the active ViewCube animation cancel function. */
export function useAnimationCancel(): {
  readonly registerAnimationCancel: (cancel: (() => void) | null) => void;
} {
  const { registerAnimationCancel } = useVisualizerActions();
  return { registerAnimationCancel };
}

/** Cancel any in-progress ViewCube animation. */
export function useCancelAnimation(): () => void {
  return useVisualizerActions().cancelAnimation;
}

/** Trigger a canvas re-render via the registered camera controls. */
export function useScheduleRender(): () => void {
  return useVisualizerActions().scheduleRender;
}

/** Render the canvas immediately (synchronous). Use from within rAF callbacks. */
export function useRenderNow(): () => void {
  return useVisualizerActions().renderNow;
}

/** Register a listener called whenever the camera changes (e.g. canvas drag). Returns cleanup. */
export function useRegisterCameraChangeListener(): (listener: () => void) => () => void {
  return useVisualizerActions().registerCameraChangeListener;
}

/** Notify all registered camera-change listeners. */
export function useNotifyCameraChange(): () => void {
  return useVisualizerActions().notifyCameraChange;
}
