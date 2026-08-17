/**
 * Arc plane selection for G17/G18/G19.
 *
 * Each plane defines which two axes are "in-plane" (where the circular
 * interpolation happens), which axis is the "normal" (helical travel),
 * and which offset letters (I/J/K) specify the arc centre.
 *
 * The in-plane axes always follow the cyclic order (x, y) → (y, z) →
 * (z, x), so the cross product of the first in-plane axis with the
 * second equals the positive normal axis
 * (`inPlaneFirst × inPlaneSecond = +normal`). This invariant guarantees
 * that, viewed from the positive normal axis, the interpolation angle
 * increases counter-clockwise — hence G3 (CCW) sweeps positively and
 * G2 (CW) sweeps negatively, matching the LinuxCNC/NIST convention.
 */

/**
 * The three standard arc planes selectable via G17, G18, G19.
 */
export enum ArcPlane {
  /** G17: arcs in XY, I/J offsets, Z is the helical (normal) axis. */
  XY = 'xy',
  /** G18: arcs in XZ, I/K offsets, Y is the helical (normal) axis. */
  XZ = 'xz',
  /** G19: arcs in YZ, J/K offsets, X is the helical (normal) axis. */
  YZ = 'yz',
}

/**
 * Axis identifier restricted to the three Cartesian axes.
 */
export type AxisKey = 'x' | 'y' | 'z';

/**
 * Offset letter restricted to I/J/K, which are used in G-code to specify
 * the arc centre relative to the start point.
 */
export type OffsetKey = 'i' | 'j' | 'k';

/**
 * Configuration that describes how a particular arc plane maps onto
 * the X/Y/Z coordinate system.
 *
 * By using this configuration object the arc math becomes fully
 * plane-agnostic — no conditionals are needed inside the interpolation
 * loop.
 *
 * The in-plane axes must follow the cyclic order (x, y) → (y, z) →
 * (z, x), so that `inPlaneFirst × inPlaneSecond = +normal`. This
 * invariant makes the interpolation angle increase counter-clockwise
 * when viewed from the positive normal axis, which in turn means G3
 * (CCW) sweeps positively and G2 (CW) sweeps negatively, matching the
 * LinuxCNC/NIST convention.
 */
export interface ArcPlaneConfig {
  /** First in-plane axis (maps to the "cosine" component). */
  readonly inPlaneFirst: AxisKey;
  /** Second in-plane axis (maps to the "sine" component). */
  readonly inPlaneSecond: AxisKey;
  /** Normal axis — linear (helical) interpolation direction. */
  readonly normal: AxisKey;
  /** Offset letter for the first in-plane axis (I, J, or K). */
  readonly offsetFirst: OffsetKey;
  /** Offset letter for the second in-plane axis (I, J, or K). */
  readonly offsetSecond: OffsetKey;
}

/**
 * Immutable lookup from {@link ArcPlane} to its axis configuration.
 */
export const ARC_PLANE_CONFIGS: Readonly<Record<ArcPlane, ArcPlaneConfig>> = {
  [ArcPlane.XY]: {
    inPlaneFirst: 'x',
    inPlaneSecond: 'y',
    normal: 'z',
    offsetFirst: 'i',
    offsetSecond: 'j',
  },
  [ArcPlane.XZ]: {
    inPlaneFirst: 'z',
    inPlaneSecond: 'x',
    normal: 'y',
    offsetFirst: 'k',
    offsetSecond: 'i',
  },
  [ArcPlane.YZ]: {
    inPlaneFirst: 'y',
    inPlaneSecond: 'z',
    normal: 'x',
    offsetFirst: 'j',
    offsetSecond: 'k',
  },
};
