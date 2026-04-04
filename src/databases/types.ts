/**
 * Standard G-code command groups for categorizing commands in completion lists.
 * Used across all dialect databases for consistent grouping and sort ordering.
 */
export enum CommandGroup {
  MOTION = 'Motion',
  COMPENSATION = 'Compensation',
  CUTTER_COMPENSATION = 'Cutter Compensation',
  COORDINATE_SYSTEM = 'Coordinate System',
  COORDINATE_SYSTEMS = 'Coordinate Systems',
  PLANE_SELECTION = 'Plane Selection',
  UNITS = 'Units',
  DISTANCE_MODE = 'Distance Mode',
  FEED_RATE_MODE = 'Feed Rate Mode',
  TOOL_LENGTH_OFFSET = 'Tool Length Offset',
  CANNED_CYCLE = 'Canned Cycle',
  CANNED_CYCLES = 'Canned Cycles',
  DWELL = 'Dwell',
  PROGRAM_CONTROL = 'Program Control',
  SPINDLE_CONTROL = 'Spindle Control',
  TOOL_CONTROL = 'Tool Control',
  COOLANT_CONTROL = 'Coolant Control',
  MACHINE_CONTROL = 'Machine Control',
}

/**
 * Sort order for command groups in completion lists.
 * Lower numbers appear first. Groups not listed default to DEFAULT_GROUP_SORT_PREFIX.
 */
export const GROUP_SORT_ORDER: Readonly<Record<CommandGroup, string>> = {
  [CommandGroup.MOTION]: '01',
  [CommandGroup.COMPENSATION]: '02',
  [CommandGroup.CUTTER_COMPENSATION]: '02',
  [CommandGroup.COORDINATE_SYSTEM]: '03',
  [CommandGroup.COORDINATE_SYSTEMS]: '03',
  [CommandGroup.PLANE_SELECTION]: '04',
  [CommandGroup.UNITS]: '05',
  [CommandGroup.DISTANCE_MODE]: '06',
  [CommandGroup.FEED_RATE_MODE]: '07',
  [CommandGroup.TOOL_LENGTH_OFFSET]: '08',
  [CommandGroup.CANNED_CYCLE]: '09',
  [CommandGroup.CANNED_CYCLES]: '09',
  [CommandGroup.DWELL]: '10',
  [CommandGroup.PROGRAM_CONTROL]: '11',
  [CommandGroup.SPINDLE_CONTROL]: '12',
  [CommandGroup.TOOL_CONTROL]: '13',
  [CommandGroup.COOLANT_CONTROL]: '14',
  [CommandGroup.MACHINE_CONTROL]: '15',
};

/**
 * Default group sort order prefix for unlisted groups
 */
export const DEFAULT_GROUP_SORT_PREFIX = '99';

export interface GCodeCommandInfo {
  command: string;
  name: string;
  description: string;
  group?: CommandGroup;
  parameters?: string[];
  example?: string;
}
