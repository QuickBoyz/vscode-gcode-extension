import { ProjectionMode } from '../visualizer/types';
import { project, createCameraState, DEFAULT_CAMERA_ANGLES } from '../webview/projection';

describe('projection', () => {
  it('projects a point at the origin to canvas center', () => {
    const camera = createCameraState();
    const result = project(0, 0, 0, camera, 400, 300);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(200);
    expect(result!.y).toBeCloseTo(150);
  });

  it('projects Z-up: a point above origin maps above canvas center', () => {
    const camera = createCameraState();
    const result = project(0, 0, 10, camera, 400, 300);
    expect(result).not.toBeNull();
    expect(result!.y).toBeLessThan(150);
  });

  it('returns null for a point behind the camera', () => {
    const camera = { ...createCameraState(), radius: 10 };
    const result = project(0, -10000, 0, camera, 400, 300);
    expect(result).toBeNull();
  });

  it('uses default camera angles', () => {
    expect(DEFAULT_CAMERA_ANGLES.theta).toBeCloseTo(-Math.PI / 4);
    expect(DEFAULT_CAMERA_ANGLES.phi).toBeCloseTo(Math.PI / 5);
  });

  it('creates a camera state with default values', () => {
    const camera = createCameraState();
    expect(camera.theta).toBe(DEFAULT_CAMERA_ANGLES.theta);
    expect(camera.phi).toBe(DEFAULT_CAMERA_ANGLES.phi);
    expect(camera.radius).toBe(200);
    expect(camera.panX).toBe(0);
    expect(camera.panY).toBe(0);
    expect(camera.target).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('accounts for camera pan offset', () => {
    const camera = createCameraState();
    camera.panX = 50;
    camera.panY = -30;
    const result = project(0, 0, 0, camera, 400, 300);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(250);
    expect(result!.y).toBeCloseTo(120);
  });

  it('accounts for camera target offset', () => {
    const camera = createCameraState();
    // When the point equals the target, it should project to canvas center
    camera.target = { x: 100, y: 200, z: 50 };
    const result = project(100, 200, 50, camera, 400, 300);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(200);
    expect(result!.y).toBeCloseTo(150);
  });

  it('returns positive depth for a point in front of the camera', () => {
    const camera = createCameraState();
    const result = project(0, 0, 0, camera, 400, 300);
    expect(result).not.toBeNull();
    expect(result!.depth).toBeGreaterThan(0);
  });

  it('closer points produce larger screen coordinates away from center', () => {
    const camera = createCameraState();
    const near = project(10, 0, 0, camera, 400, 300);
    // Shrink the radius so the same world-space offset appears larger
    camera.radius = 50;
    const nearSmallRadius = project(10, 0, 0, camera, 400, 300);
    expect(near).not.toBeNull();
    expect(nearSmallRadius).not.toBeNull();
    // With a smaller radius (closer camera), the projected offset from centre
    // should be larger (perspective effect)
    const offsetDefault = Math.abs(near!.x - 200);
    const offsetClose = Math.abs(nearSmallRadius!.x - 200);
    expect(offsetClose).toBeGreaterThan(offsetDefault);
  });

  describe('orthographic projection', () => {
    it('scale is constant regardless of depth (unlike perspective)', () => {
      // Project the same world-X offset using two different orbit radii.
      // In orthographic mode scale = fov/radius, so halving the radius
      // should double the screen offset.  This confirms the scale is tied
      // to radius, not to per-point depth.
      const cameraClose = createCameraState();
      cameraClose.radius = 100;
      const cameraFar = createCameraState();
      cameraFar.radius = 200;

      const resultClose = project(10, 0, 0, cameraClose, 400, 300, ProjectionMode.ORTHOGRAPHIC);
      const resultFar = project(10, 0, 0, cameraFar, 400, 300, ProjectionMode.ORTHOGRAPHIC);

      expect(resultClose).not.toBeNull();
      expect(resultFar).not.toBeNull();

      // With half the radius the scale doubles, so the offset from centre doubles
      const offsetClose = Math.abs(resultClose!.x - 200);
      const offsetFar = Math.abs(resultFar!.x - 200);
      expect(offsetClose).toBeCloseTo(offsetFar * 2, 1);
    });

    it('depth values still differ between points at different positions', () => {
      const camera = createCameraState();
      // Two points separated only in the camera depth direction (along Y in world space)
      const pointA = project(0, 0, 0, camera, 400, 300, ProjectionMode.ORTHOGRAPHIC);
      const pointB = project(0, 50, 0, camera, 400, 300, ProjectionMode.ORTHOGRAPHIC);
      expect(pointA).not.toBeNull();
      expect(pointB).not.toBeNull();
      // Depth must differ so painter's algorithm still works in orthographic mode
      expect(pointA!.depth).not.toBeCloseTo(pointB!.depth, 0);
    });

    it('projects a point at the origin to canvas centre', () => {
      const camera = createCameraState();
      const result = project(0, 0, 0, camera, 400, 300, ProjectionMode.ORTHOGRAPHIC);
      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(200);
      expect(result!.y).toBeCloseTo(150);
    });
  });

  describe('perspective projection', () => {
    it('a point with less depth produces a larger screen offset than the same point with more depth', () => {
      // Move the camera closer (smaller radius) to increase scale for perspective
      const cameraClose = createCameraState();
      cameraClose.radius = 50;
      const cameraFar = createCameraState();
      cameraFar.radius = 200;

      const closeResult = project(10, 0, 0, cameraClose, 400, 300, ProjectionMode.PERSPECTIVE);
      const farResult = project(10, 0, 0, cameraFar, 400, 300, ProjectionMode.PERSPECTIVE);

      expect(closeResult).not.toBeNull();
      expect(farResult).not.toBeNull();

      // Closer camera (less depth) must produce a larger offset from centre
      const closeOffset = Math.abs(closeResult!.x - 200);
      const farOffset = Math.abs(farResult!.x - 200);
      expect(closeOffset).toBeGreaterThan(farOffset);
    });
  });
});
