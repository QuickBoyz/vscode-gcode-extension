import { animateCamera, normalizeAngle } from '../../webview/viewCube/animation';
import { CameraState } from '../../webview/types';

function createCamera(theta = 0, phi = 0): CameraState {
  return {
    theta,
    phi,
    radius: 200,
    panX: 0,
    panY: 0,
    target: { x: 0, y: 0, z: 0 },
  };
}

describe('normalizeAngle', () => {
  it('returns 0 for delta of 0', () => {
    expect(normalizeAngle(0)).toBe(0);
  });

  it('wraps positive delta > PI to negative', () => {
    // 3PI/2 should become -PI/2 (shorter path)
    const result = normalizeAngle((3 * Math.PI) / 2);
    expect(result).toBeCloseTo(-Math.PI / 2);
  });

  it('wraps negative delta < -PI to positive', () => {
    // -3PI/2 should become PI/2
    const result = normalizeAngle((-3 * Math.PI) / 2);
    expect(result).toBeCloseTo(Math.PI / 2);
  });

  it('keeps delta within [-PI, PI] unchanged', () => {
    expect(normalizeAngle(Math.PI / 4)).toBeCloseTo(Math.PI / 4);
    expect(normalizeAngle(-Math.PI / 4)).toBeCloseTo(-Math.PI / 4);
  });

  it('normalizes exactly PI to PI', () => {
    expect(normalizeAngle(Math.PI)).toBeCloseTo(Math.PI);
  });

  it('normalizes exactly -PI to -PI', () => {
    expect(normalizeAngle(-Math.PI)).toBeCloseTo(-Math.PI);
  });
});

describe('animateCamera', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    let frameId = 0;
    let frameTime = 0;
    const frameDurationMs = 16;
    // rAF doesn't exist in Node — define stubs so spyOn can attach
    globalThis.requestAnimationFrame = (() => 0) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      frameId++;
      frameTime += frameDurationMs;
      const scheduledFrameTime = frameTime;
      setTimeout(() => cb(scheduledFrameTime), frameDurationMs);
      return frameId;
    });
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {
      // no-op in test
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('snaps camera to exact target values after animation completes', () => {
    const camera = createCamera(0, 0);
    const onFrame = jest.fn();
    const onComplete = jest.fn();

    animateCamera(camera, { theta: Math.PI / 2, phi: Math.PI / 4 }, 100, onFrame, onComplete);

    // Advance past the animation duration
    jest.advanceTimersByTime(200);

    expect(camera.theta).toBe(Math.PI / 2);
    expect(camera.phi).toBe(Math.PI / 4);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onFrame during animation', () => {
    const camera = createCamera(0, 0);
    const onFrame = jest.fn();

    animateCamera(camera, { theta: Math.PI / 2, phi: 0 }, 100, onFrame);

    jest.advanceTimersByTime(50);

    expect(onFrame).toHaveBeenCalled();
  });

  it('cancel function stops the animation', () => {
    const camera = createCamera(0, 0);
    const onFrame = jest.fn();
    const onComplete = jest.fn();

    const cancel = animateCamera(
      camera,
      { theta: Math.PI / 2, phi: Math.PI / 4 },
      100,
      onFrame,
      onComplete
    );

    cancel();
    jest.advanceTimersByTime(200);

    // Camera should NOT have reached the target
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('takes shortest angular path for theta', () => {
    // Start at theta=3PI/4, target theta=-3PI/4
    // Direct delta is -3PI/2 but shortest path is PI/2 (go the other way)
    const camera = createCamera((3 * Math.PI) / 4, 0);
    const onFrame = jest.fn();

    animateCamera(camera, { theta: (-3 * Math.PI) / 4, phi: 0 }, 100, onFrame);

    // After partial progress, theta should have moved in the positive direction
    // (shorter path from 3PI/4 to -3PI/4 is via PI)
    jest.advanceTimersByTime(50);

    // Theta should be somewhere between 3PI/4 and PI (not going backwards through 0)
    expect(camera.theta).toBeGreaterThanOrEqual((3 * Math.PI) / 4 - 0.01);
  });

  it('snaps instantly when duration is zero', () => {
    const camera = createCamera(0, 0);
    const onFrame = jest.fn();
    const onComplete = jest.fn();

    animateCamera(camera, { theta: Math.PI / 2, phi: Math.PI / 4 }, 0, onFrame, onComplete);

    expect(camera.theta).toBe(Math.PI / 2);
    expect(camera.phi).toBe(Math.PI / 4);
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('does nothing when already at target', () => {
    const camera = createCamera(Math.PI / 2, Math.PI / 4);
    const onFrame = jest.fn();
    const onComplete = jest.fn();

    animateCamera(camera, { theta: Math.PI / 2, phi: Math.PI / 4 }, 100, onFrame, onComplete);

    jest.advanceTimersByTime(200);

    expect(camera.theta).toBe(Math.PI / 2);
    expect(camera.phi).toBe(Math.PI / 4);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
