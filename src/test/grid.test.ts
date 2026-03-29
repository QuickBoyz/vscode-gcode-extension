import { computeGridExtent } from '../webview/grid';
import { PathBounds } from '../visualizer/types';

describe('computeGridExtent', () => {
  it('snaps grid boundaries outward to the nearest grid interval', () => {
    const bounds: PathBounds = {
      min: { x: 3.7, y: 5.1, z: 0 },
      max: { x: 47.2, y: 82.6, z: 0 },
    };
    const gridSpacing = 10;
    const extent = computeGridExtent(bounds, gridSpacing);

    // minX: floor((3.7 - 10) / 10) * 10 = floor(-0.63) * 10 = -1 * 10 = -10
    expect(extent.minX).toBe(-10);
    // maxX: ceil((47.2 + 10) / 10) * 10 = ceil(5.72) * 10 = 6 * 10 = 60
    expect(extent.maxX).toBe(60);
    // minY: floor((5.1 - 10) / 10) * 10 = floor(-0.49) * 10 = -1 * 10 = -10
    expect(extent.minY).toBe(-10);
    // maxY: ceil((82.6 + 10) / 10) * 10 = ceil(9.26) * 10 = 10 * 10 = 100
    expect(extent.maxY).toBe(100);
  });

  it('adds one interval of padding beyond the bounding box on each side', () => {
    const bounds: PathBounds = {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 100, y: 100, z: 0 },
    };
    const gridSpacing = 10;
    const extent = computeGridExtent(bounds, gridSpacing);

    // Padding of one interval (10) on each side, no snap required since bounds are already aligned
    expect(extent.minX).toBe(-10);
    expect(extent.maxX).toBe(110);
    expect(extent.minY).toBe(-10);
    expect(extent.maxY).toBe(110);
  });

  it('produces a reasonable extent for zero-sized bounds (single point)', () => {
    const bounds: PathBounds = {
      min: { x: 25, y: 25, z: 0 },
      max: { x: 25, y: 25, z: 0 },
    };
    const gridSpacing = 10;
    const extent = computeGridExtent(bounds, gridSpacing);

    // Extent must contain the single point
    expect(extent.minX).toBeLessThanOrEqual(25);
    expect(extent.maxX).toBeGreaterThanOrEqual(25);
    expect(extent.minY).toBeLessThanOrEqual(25);
    expect(extent.maxY).toBeGreaterThanOrEqual(25);

    // Extent should be non-degenerate (has positive area)
    expect(extent.maxX).toBeGreaterThan(extent.minX);
    expect(extent.maxY).toBeGreaterThan(extent.minY);
  });

  it('works correctly with a grid spacing of 1', () => {
    const bounds: PathBounds = {
      min: { x: 0.3, y: 1.7, z: 0 },
      max: { x: 4.9, y: 9.2, z: 0 },
    };
    const gridSpacing = 1;
    const extent = computeGridExtent(bounds, gridSpacing);

    // minX: floor((0.3 - 1) / 1) * 1 = floor(-0.7) = -1
    expect(extent.minX).toBe(-1);
    // maxX: ceil((4.9 + 1) / 1) * 1 = ceil(5.9) = 6
    expect(extent.maxX).toBe(6);
    // minY: floor((1.7 - 1) / 1) * 1 = floor(0.7) = 0
    expect(extent.minY).toBe(0);
    // maxY: ceil((9.2 + 1) / 1) * 1 = ceil(10.2) = 11
    expect(extent.maxY).toBe(11);
  });

  it('handles bounds that are already aligned to the grid interval', () => {
    const bounds: PathBounds = {
      min: { x: 10, y: 20, z: 0 },
      max: { x: 50, y: 80, z: 0 },
    };
    const gridSpacing = 10;
    const extent = computeGridExtent(bounds, gridSpacing);

    // With one interval of padding, the extent expands exactly by gridSpacing on each side
    expect(extent.minX).toBe(0);
    expect(extent.maxX).toBe(60);
    expect(extent.minY).toBe(10);
    expect(extent.maxY).toBe(90);
  });
});
