/**
 * G-Code Command Classification Constants
 *
 * Shared command sets used by both the semantic analyzer (for diagnostics)
 * and the visualizer (for tool-path extraction). All values are normalized
 * form (uppercase, zero-padded) as produced by {@link normalizeCommand}.
 *
 * These constants represent standard G-code modal groups and command
 * categories defined in ISO 6983.
 */

// -- Motion commands (Group 1) --

/** All Group 1 modal motion commands. */
export const MODAL_MOTION_COMMANDS = new Set(['G00', 'G01', 'G02', 'G03']);

/** Rapid positioning. */
export const RAPID_COMMANDS = new Set(['G00']);

/** Linear feed move. */
export const FEED_COMMANDS = new Set(['G01']);

/** Clockwise arc interpolation. */
export const ARC_CW_COMMANDS = new Set(['G02']);

/** Counter-clockwise arc interpolation. */
export const ARC_CCW_COMMANDS = new Set(['G03']);

/** Commands that require a feed rate (F) to be set — union of feed + arc. */
export const FEED_REQUIRING_COMMANDS = new Set(['G01', 'G02', 'G03']);

// -- Distance mode (Group 3) --

/** Absolute positioning mode. */
export const ABSOLUTE_COMMANDS = new Set(['G90']);

/** Incremental positioning mode. */
export const INCREMENTAL_COMMANDS = new Set(['G91']);

// -- Plane selection (Group 2) --

/** XY plane selection. */
export const PLANE_XY_COMMAND = 'G17';

/** XZ plane selection. */
export const PLANE_XZ_COMMAND = 'G18';

/** YZ plane selection. */
export const PLANE_YZ_COMMAND = 'G19';

// -- Spindle control --

/** Spindle clockwise (forward). */
export const SPINDLE_CW_COMMAND = 'M03';

/** Spindle counter-clockwise (reverse). */
export const SPINDLE_CCW_COMMAND = 'M04';

/** Spindle stop. */
export const SPINDLE_OFF_COMMAND = 'M05';

// -- Coolant control --

/** Mist coolant on. */
export const COOLANT_MIST_COMMAND = 'M07';

/** Flood coolant on. */
export const COOLANT_FLOOD_COMMAND = 'M08';

/** All coolant off. */
export const COOLANT_OFF_COMMAND = 'M09';

// -- Tool commands --

/** Tool change. */
export const TOOL_CHANGE_COMMAND = 'M06';

// -- Program control --

/** Commands that end the program. */
export const PROGRAM_END_COMMANDS = new Set(['M02', 'M30']);

// -- Home position --

/** Return to machine home via optional intermediate point. */
export const HOME_RETURN_COMMANDS = new Set(['G28']);

// -- Axis parameter letters --

/** Feed rate parameter. */
export const FEED_RATE_AXIS = 'F';

/** Spindle speed parameter. */
export const SPINDLE_SPEED_AXIS = 'S';

/** Tool number parameter. */
export const TOOL_NUMBER_AXIS = 'T';
