import { POLE_MARGIN } from '../constants';

/**
 * Target camera angles for a predefined view.
 */
export interface ViewTarget {
  readonly theta: number;
  readonly phi: number;
}

/**
 * Camera angles for the 6 face views (orthographic axes).
 */
export const FACE_VIEWS: Readonly<Record<string, ViewTarget>> = {
  Front: { theta: 0, phi: 0 },
  Back: { theta: Math.PI, phi: 0 },
  Right: { theta: Math.PI / 2, phi: 0 },
  Left: { theta: -Math.PI / 2, phi: 0 },
  Top: { theta: 0, phi: Math.PI / 2 - POLE_MARGIN },
  Bottom: { theta: 0, phi: -Math.PI / 2 + POLE_MARGIN },
} as const;

/**
 * Camera angles for the 12 edge views (midpoint between adjacent faces).
 */
export const EDGE_VIEWS: Readonly<Record<string, ViewTarget>> = {
  'Front-Top': { theta: 0, phi: Math.PI / 4 },
  'Front-Bottom': { theta: 0, phi: -Math.PI / 4 },
  'Front-Right': { theta: Math.PI / 4, phi: 0 },
  'Front-Left': { theta: -Math.PI / 4, phi: 0 },
  'Back-Top': { theta: Math.PI, phi: Math.PI / 4 },
  'Back-Bottom': { theta: Math.PI, phi: -Math.PI / 4 },
  'Back-Right': { theta: (3 * Math.PI) / 4, phi: 0 },
  'Back-Left': { theta: (-3 * Math.PI) / 4, phi: 0 },
  'Right-Top': { theta: Math.PI / 2, phi: Math.PI / 4 },
  'Right-Bottom': { theta: Math.PI / 2, phi: -Math.PI / 4 },
  'Left-Top': { theta: -Math.PI / 2, phi: Math.PI / 4 },
  'Left-Bottom': { theta: -Math.PI / 2, phi: -Math.PI / 4 },
} as const;
