import { CameraState } from '../types';

/**
 * Normalize an angular delta to the range [-PI, PI] for shortest-path interpolation.
 */
export function normalizeAngle(delta: number): number {
  let normalized = delta % (2 * Math.PI);
  if (normalized > Math.PI) {
    normalized -= 2 * Math.PI;
  } else if (normalized < -Math.PI) {
    normalized += 2 * Math.PI;
  }
  return normalized;
}

/**
 * Ease-out quadratic: fast start, gradual deceleration.
 */
function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * Smoothly animates the camera from its current theta/phi to the target values.
 *
 * Mutates the camera state in place on each frame and calls `onFrame` to
 * trigger a canvas re-render. Uses shortest angular path for theta.
 *
 * @param camera     - The mutable camera state object
 * @param target     - Destination angles `{ theta, phi }`
 * @param duration   - Animation duration in milliseconds
 * @param onFrame    - Called each frame to trigger re-render (e.g. `scheduleRender`)
 * @param onComplete - Optional callback when animation finishes
 * @returns A cancel function that stops the animation
 */
export function animateCamera(
  camera: CameraState,
  target: { readonly theta: number; readonly phi: number },
  duration: number,
  onFrame: () => void,
  onComplete?: () => void
): () => void {
  // Guard: instant snap for zero or negative duration
  if (duration <= 0) {
    camera.theta = target.theta;
    camera.phi = target.phi;
    onFrame();
    onComplete?.();
    return () => {};
  }

  const startTheta = camera.theta;
  const startPhi = camera.phi;
  const deltaTheta = normalizeAngle(target.theta - startTheta);
  const deltaPhi = target.phi - startPhi;

  let rafId: number | null = null;
  let cancelled = false;
  let startTime: number | null = null;

  function step(timestamp: number): void {
    if (cancelled) return;

    if (startTime === null) {
      startTime = timestamp;
    }

    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOut(progress);

    camera.theta = startTheta + deltaTheta * eased;
    camera.phi = startPhi + deltaPhi * eased;
    onFrame();

    if (progress < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      rafId = null;
      // Snap to exact target
      camera.theta = target.theta;
      camera.phi = target.phi;
      onFrame();
      onComplete?.();
    }
  }

  rafId = requestAnimationFrame(step);

  return () => {
    cancelled = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}
