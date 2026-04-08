import { MotionType, VisualizerConfig } from '../visualizer/types';

/** Minimum line thickness in canvas pixels. */
export const MINIMUM_THICKNESS = 0.5;

/** Rapid moves are drawn at this fraction of the normal thickness. */
export const RAPID_THICKNESS_FACTOR = 0.5;

/** Rapid moves are drawn at this opacity. */
export const RAPID_OPACITY = 0.65;

/** Dash pattern for rapid moves: [dash, gap]. */
export const RAPID_DASH_PATTERN: readonly number[] = [5, 6];

/** Fallback colour for unknown motion types. */
export const FALLBACK_SEGMENT_COLOR = '#aaaaaa';

/** Default background colour when the CSS variable is unavailable. */
export const DEFAULT_BACKGROUND_COLOR = '#1e1e1e';

/** Fit-view radius multiplier relative to the bounding-box largest dimension. */
export const FIT_VIEW_RADIUS_FACTOR = 2.0;

/** Default error message when none is provided. */
export const DEFAULT_ERROR_MESSAGE = 'An unknown error occurred';

/** Maximum distance in canvas pixels for a hit test to register. */
export const HIT_TEST_TOLERANCE = 8;

/** Line thickness multiplier for the hover highlight on the overlay. */
export const HOVER_THICKNESS_FACTOR = 3.0;

/** Alpha value for the hover highlight glow. */
export const HOVER_ALPHA = 0.5;

/** Shadow blur radius for the hover highlight. */
export const HOVER_SHADOW_BLUR = 6;

/** Dwell time in milliseconds before showing the info panel. */
export const DWELL_DELAY_MS = 80;

/** Horizontal offset (in CSS pixels) from the cursor to the info panel. */
export const INFO_PANEL_OFFSET_X = 16;

/** Vertical offset (in CSS pixels) from the cursor to the info panel. */
export const INFO_PANEL_OFFSET_Y = 8;

/** Grace zone delay in ms — time allowed for cursor to reach the tooltip. */
export const GRACE_ZONE_DELAY_MS = 300;

/**
 * Returns the user-configured colour for a given motion type.
 */
export function getSegmentColor(motionType: MotionType, settings: VisualizerConfig): string {
  switch (motionType) {
    case MotionType.RAPID:
      return settings.rapidColor;
    case MotionType.FEED:
      return settings.feedColor;
    case MotionType.ARC_CW:
    case MotionType.ARC_CCW:
      return settings.arcColor;
    default:
      return FALLBACK_SEGMENT_COLOR;
  }
}

// ── Playback ──────────────────────────────────────────────────────────

/** Opacity for past (already visited) segments during playback. */
export const PLAYBACK_PAST_OPACITY = 0.4;

/** Tool marker diameter in world units (mm). Shared by cone and cylinder. */
export const TOOL_MARKER_DIAMETER = 3;

/** Tool marker cone (tip) height in world units (mm). */
export const TOOL_CONE_HEIGHT = 3;

/** Tool marker cylinder (body) height in world units (mm). */
export const TOOL_CYLINDER_HEIGHT = 12;

/** Number of points around the marker cross-section circle. */
export const TOOL_MARKER_RESOLUTION = 12;

/** Tool marker body fill opacity. */
export const TOOL_MARKER_OPACITY = 0.35;

/** Tool marker cylinder fill colour. */
export const TOOL_CYLINDER_COLOR = '#b0b0b0';

/** Tool marker cone fill colour (slightly darker than cylinder). */
export const TOOL_CONE_COLOR = '#999999';

/** Tool marker outline colour. */
export const TOOL_MARKER_OUTLINE_COLOR = '#777777';

/** Tool marker outline width. */
export const TOOL_MARKER_OUTLINE_WIDTH = 0.5;

/** Tool tip dot radius in screen pixels. */
export const TOOL_TIP_RADIUS = 5;

/** Tool tip dot fill colour. */
export const TOOL_TIP_COLOR = '#ff4500';

/** Tool tip dot outline colour. */
export const TOOL_TIP_OUTLINE_COLOR = '#1a1a1a';

/** Tool tip dot outline width. */
export const TOOL_TIP_OUTLINE_WIDTH = 1.5;

// ── Shared interaction constants ─────────────────────────────────────

/** Radians per pixel of mouse movement during orbit. */
export const ORBIT_SENSITIVITY = 0.008;

/** Margin in radians from the poles (+/- PI/2) to prevent gimbal lock. */
export const POLE_MARGIN = 0.01;
