/**
 * Arc plane selection for G17/G18/G19.
 *
 * Each plane defines which two axes are "in-plane" (where the circular
 * interpolation happens), which axis is the "normal" (helical travel),
 * and which offset letters (I/J/K) specify the arc centre.
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
 * Lowercase to match {@link PathPoint} property names (used for dynamic indexing).
 */
export type AxisKey = 'x' | 'y' | 'z';

/**
 * Offset letter restricted to I/J/K, which are used in G-code to specify
 * the arc centre relative to the start point.
 * Uppercase to match the parser's axis parameter convention.
 */
export type OffsetKey = 'I' | 'J' | 'K';

/**
 * Configuration that describes how a particular arc plane maps onto
 * the X/Y/Z coordinate system.
 *
 * By using this configuration object the arc math becomes fully
 * plane-agnostic — no conditionals are needed inside the interpolation
 * loop.
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
    offsetFirst: 'I',
    offsetSecond: 'J',
  },
  [ArcPlane.XZ]: {
    inPlaneFirst: 'x',
    inPlaneSecond: 'z',
    normal: 'y',
    offsetFirst: 'I',
    offsetSecond: 'K',
  },
  [ArcPlane.YZ]: {
    inPlaneFirst: 'y',
    inPlaneSecond: 'z',
    normal: 'x',
    offsetFirst: 'J',
    offsetSecond: 'K',
  },
};
