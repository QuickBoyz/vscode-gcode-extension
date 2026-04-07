import { FACE_VIEWS, EDGE_VIEWS } from '../../webview/viewCube/views';

const POLE_MARGIN = 0.01;

describe('ViewCube view definitions', () => {
  describe('FACE_VIEWS', () => {
    it('defines exactly 6 faces', () => {
      expect(Object.keys(FACE_VIEWS)).toHaveLength(6);
    });

    it('defines Front view at theta=0, phi=0', () => {
      expect(FACE_VIEWS.Front).toEqual({ theta: 0, phi: 0 });
    });

    it('defines Back view at theta=PI, phi=0', () => {
      expect(FACE_VIEWS.Back).toEqual({ theta: Math.PI, phi: 0 });
    });

    it('defines Right view at theta=-PI/2, phi=0', () => {
      expect(FACE_VIEWS.Right).toEqual({ theta: -Math.PI / 2, phi: 0 });
    });

    it('defines Left view at theta=PI/2, phi=0', () => {
      expect(FACE_VIEWS.Left).toEqual({ theta: Math.PI / 2, phi: 0 });
    });

    it('defines Top view at theta=0, phi near PI/2', () => {
      expect(FACE_VIEWS.Top).toEqual({ theta: 0, phi: Math.PI / 2 - POLE_MARGIN });
    });

    it('defines Bottom view at theta=0, phi near -PI/2', () => {
      expect(FACE_VIEWS.Bottom).toEqual({ theta: 0, phi: -Math.PI / 2 + POLE_MARGIN });
    });

    it('all faces have phi within gimbal-safe range', () => {
      for (const view of Object.values(FACE_VIEWS)) {
        expect(view.phi).toBeGreaterThanOrEqual(-Math.PI / 2 + POLE_MARGIN);
        expect(view.phi).toBeLessThanOrEqual(Math.PI / 2 - POLE_MARGIN);
      }
    });
  });

  describe('EDGE_VIEWS', () => {
    it('defines exactly 12 edges', () => {
      expect(Object.keys(EDGE_VIEWS)).toHaveLength(12);
    });

    it('defines Front-Top edge at theta=0, phi=PI/4', () => {
      expect(EDGE_VIEWS['Front-Top']).toEqual({ theta: 0, phi: Math.PI / 4 });
    });

    it('defines Front-Right edge at theta=-PI/4, phi=0', () => {
      expect(EDGE_VIEWS['Front-Right']).toEqual({ theta: -Math.PI / 4, phi: 0 });
    });

    it('defines Back-Right edge at theta=-3PI/4, phi=0', () => {
      expect(EDGE_VIEWS['Back-Right']).toEqual({ theta: (-3 * Math.PI) / 4, phi: 0 });
    });

    it('all edges have phi within gimbal-safe range', () => {
      for (const view of Object.values(EDGE_VIEWS)) {
        expect(view.phi).toBeGreaterThanOrEqual(-Math.PI / 2 + POLE_MARGIN);
        expect(view.phi).toBeLessThanOrEqual(Math.PI / 2 - POLE_MARGIN);
      }
    });
  });
});
