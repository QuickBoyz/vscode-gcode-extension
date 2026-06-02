/**
 * Standard G-code command groups for categorizing commands in completion lists.
 * Used across all dialect databases for consistent grouping and sort ordering.
 */
export enum CommandGroup {
  ARC_MODE = 'Arc Mode',
  CANNED_CYCLE = 'Canned Cycle',
  CANNED_CYCLES = 'Canned Cycles',
  COMPENSATION = 'Compensation',
  COORDINATE_SYSTEM = 'Coordinate System',
  COORDINATE_SYSTEMS = 'Coordinate Systems',
  COOLANT_CONTROL = 'Coolant Control',
  CUTTER_COMPENSATION = 'Cutter Compensation',
  DISTANCE_MODE = 'Distance Mode',
  DWELL = 'Dwell',
  FEED_RATE_MODE = 'Feed Rate Mode',
  IO = 'I/O Control',
  LATHE = 'Lathe',
  LATHE_CYCLE = 'Lathe Cycle',
  MACHINE_CONTROL = 'Machine Control',
  MOTION = 'Motion',
  OVERRIDES = 'Overrides',
  PATH_CONTROL = 'Path Control',
  PLANE_SELECTION = 'Plane Selection',
  PROBING = 'Probing',
  PROGRAM_CONTROL = 'Program Control',
  SPINDLE_CONTROL = 'Spindle Control',
  SPINDLE_MODE = 'Spindle Mode',
  SPINDLE_SYNC = 'Spindle Sync',
  STATE = 'Modal State',
  TOOL_CONTROL = 'Tool Control',
  TOOL_LENGTH_OFFSET = 'Tool Length Offset',
  UNITS = 'Units',
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
  [CommandGroup.ARC_MODE]: '06',
  [CommandGroup.DISTANCE_MODE]: '06',
  [CommandGroup.PATH_CONTROL]: '06',
  [CommandGroup.FEED_RATE_MODE]: '07',
  [CommandGroup.LATHE]: '07',
  [CommandGroup.PROBING]: '08',
  [CommandGroup.SPINDLE_SYNC]: '08',
  [CommandGroup.TOOL_LENGTH_OFFSET]: '08',
  [CommandGroup.CANNED_CYCLE]: '09',
  [CommandGroup.CANNED_CYCLES]: '09',
  [CommandGroup.LATHE_CYCLE]: '09',
  [CommandGroup.DWELL]: '10',
  [CommandGroup.PROGRAM_CONTROL]: '11',
  [CommandGroup.SPINDLE_CONTROL]: '12',
  [CommandGroup.SPINDLE_MODE]: '12',
  [CommandGroup.TOOL_CONTROL]: '13',
  [CommandGroup.COOLANT_CONTROL]: '14',
  [CommandGroup.MACHINE_CONTROL]: '15',
  [CommandGroup.OVERRIDES]: '16',
  [CommandGroup.IO]: '17',
  [CommandGroup.STATE]: '18',
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
