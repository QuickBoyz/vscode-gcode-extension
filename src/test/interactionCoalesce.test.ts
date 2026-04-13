/**
 * Unit tests for mousemove coalescing in setupInteraction (#143).
 *
 * Runs in the plain-ts Jest environment (no jsdom), so we stub the
 * global `window` with a minimal event-target before importing the
 * module under test.
 */

type Listener = (event: unknown) => void;

function makeTarget() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    listeners,
    addEventListener: (type: string, cb: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    },
    removeEventListener: (type: string, cb: Listener) => {
      listeners.get(type)?.delete(cb);
    },
    dispatch: (type: string, event: unknown) => {
      const set = listeners.get(type);
      if (!set) return;
      for (const cb of Array.from(set)) cb(event);
    },
  };
}

// Install a window stub BEFORE importing interaction.ts, because the
// module doesn't itself reference `window` at import time (it does
// inside setupInteraction) — but the stub must be present when that
// runs.
const windowStub = makeTarget() as ReturnType<typeof makeTarget> & {
  requestAnimationFrame: (cb: FrameRequestCallback) => number;
  cancelAnimationFrame: (handle: number) => void;
};
windowStub.requestAnimationFrame = () => 0;
windowStub.cancelAnimationFrame = () => {};
(globalThis as unknown as { window: typeof windowStub }).window = windowStub;

import { setupInteraction } from '../webview/interaction';
import { CameraState } from '../webview/types';
import { ORBIT_SENSITIVITY } from '../webview/constants';

function createCanvasStub() {
  const target = makeTarget();
  const canvas = {
    classList: { add: jest.fn(), remove: jest.fn() },
    addEventListener: target.addEventListener,
    removeEventListener: target.removeEventListener,
  } as unknown as HTMLCanvasElement;
  return { canvas, target };
}

function createCamera(): CameraState {
  return {
    theta: 0,
    phi: 0,
    radius: 100,
    panX: 0,
    panY: 0,
  } as CameraState;
}

function installManualRaf() {
  const pending: FrameRequestCallback[] = [];
  const handles: number[] = [];
  let nextHandle = 1;
  const raf = jest.fn((cb: FrameRequestCallback) => {
    pending.push(cb);
    const h = nextHandle++;
    handles.push(h);
    return h;
  });
  const caf = jest.fn((_handle: number) => {
    pending.length = 0;
  });
  function flush() {
    const batch = pending.splice(0);
    for (const cb of batch) cb(0);
  }
  return { raf, caf, flush, pending };
}

describe('setupInteraction mousemove coalescing', () => {
  it('collapses a burst of mousemoves into one camera update per rAF', () => {
    const { canvas, target: canvasTarget } = createCanvasStub();
    const camera = createCamera();
    const onCameraChange = jest.fn();
    const { raf, caf, flush } = installManualRaf();

    setupInteraction(canvas, camera, onCameraChange, undefined, {
      requestAnimationFrame: raf,
      cancelAnimationFrame: caf,
    });

    canvasTarget.dispatch('mousedown', {
      button: 0,
      shiftKey: false,
      clientX: 100,
      clientY: 100,
      preventDefault: jest.fn(),
    });

    for (let i = 1; i <= 10; i++) {
      windowStub.dispatch('mousemove', { clientX: 100 + i, clientY: 100 + i });
    }

    expect(onCameraChange).not.toHaveBeenCalled();
    expect(raf).toHaveBeenCalledTimes(1);
    expect(camera.theta).toBe(0);
    expect(camera.phi).toBe(0);

    flush();
    expect(onCameraChange).toHaveBeenCalledTimes(1);
    expect(camera.theta).toBeCloseTo(-10 * ORBIT_SENSITIVITY);
    expect(camera.phi).toBeCloseTo(10 * ORBIT_SENSITIVITY);
  });

  it('schedules a new rAF for the next burst after the previous one flushed', () => {
    const { canvas, target: canvasTarget } = createCanvasStub();
    const camera = createCamera();
    const onCameraChange = jest.fn();
    const { raf, caf, flush } = installManualRaf();

    setupInteraction(canvas, camera, onCameraChange, undefined, {
      requestAnimationFrame: raf,
      cancelAnimationFrame: caf,
    });

    canvasTarget.dispatch('mousedown', {
      button: 0,
      shiftKey: false,
      clientX: 0,
      clientY: 0,
      preventDefault: jest.fn(),
    });

    windowStub.dispatch('mousemove', { clientX: 5, clientY: 0 });
    flush();
    windowStub.dispatch('mousemove', { clientX: 10, clientY: 0 });
    flush();

    expect(raf).toHaveBeenCalledTimes(2);
    expect(onCameraChange).toHaveBeenCalledTimes(2);
  });

  it('drops pending delta on mouseup so buffered events cannot replay after the gesture ends', () => {
    const { canvas, target: canvasTarget } = createCanvasStub();
    const camera = createCamera();
    const onCameraChange = jest.fn();
    const { raf, caf, flush } = installManualRaf();

    setupInteraction(canvas, camera, onCameraChange, undefined, {
      requestAnimationFrame: raf,
      cancelAnimationFrame: caf,
    });

    canvasTarget.dispatch('mousedown', {
      button: 0,
      shiftKey: false,
      clientX: 0,
      clientY: 0,
      preventDefault: jest.fn(),
    });
    windowStub.dispatch('mousemove', { clientX: 50, clientY: 0 });
    expect(raf).toHaveBeenCalledTimes(1);

    windowStub.dispatch('mouseup', {});
    flush();

    expect(camera.theta).toBe(0);
    expect(onCameraChange).not.toHaveBeenCalled();
    expect(caf).toHaveBeenCalledTimes(1);
  });

  it('ignores mousemove entirely when no drag is in progress', () => {
    const { canvas } = createCanvasStub();
    const camera = createCamera();
    const onCameraChange = jest.fn();
    const { raf, caf, flush } = installManualRaf();

    setupInteraction(canvas, camera, onCameraChange, undefined, {
      requestAnimationFrame: raf,
      cancelAnimationFrame: caf,
    });

    windowStub.dispatch('mousemove', { clientX: 100, clientY: 100 });
    flush();

    expect(raf).not.toHaveBeenCalled();
    expect(onCameraChange).not.toHaveBeenCalled();
    expect(camera.theta).toBe(0);
    expect(camera.phi).toBe(0);
  });
});
