/**
 * G-Code Command Database
 *
 * Provides documentation and descriptions for G-codes and M-codes
 * used in the hover provider.
 */

import { CommandGroup, GCodeCommandInfo } from '../types';

/**
 * G-Code commands database
 */
export const GCODE_COMMANDS = new Map<string, GCodeCommandInfo>([
  [
    'G00',
    {
      command: 'G00',
      name: 'Rapid Positioning',
      description: 'Rapid traverse motion at maximum speed. Used for non-cutting moves.',
      group: CommandGroup.MOTION,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C'],
      example: 'G00 X10.0 Y20.0 Z5.0',
    },
  ],
  [
    'G01',
    {
      command: 'G01',
      name: 'Linear Interpolation',
      description: 'Linear motion at programmed feed rate. Used for cutting in a straight line.',
      group: CommandGroup.MOTION,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C', 'F'],
      example: 'G01 X10.0 Y20.0 F500',
    },
  ],
  [
    'G02',
    {
      command: 'G02',
      name: 'Circular Interpolation CW',
      description:
        'Circular motion clockwise at programmed feed rate. Requires arc center (I, J, K) or radius (R).',
      group: CommandGroup.MOTION,
      parameters: ['X', 'Y', 'Z', 'I', 'J', 'K', 'R', 'F'],
      example: 'G02 X10.0 Y20.0 I5.0 J0.0 F300',
    },
  ],
  [
    'G03',
    {
      command: 'G03',
      name: 'Circular Interpolation CCW',
      description:
        'Circular motion counter-clockwise at programmed feed rate. Requires arc center (I, J, K) or radius (R).',
      group: CommandGroup.MOTION,
      parameters: ['X', 'Y', 'Z', 'I', 'J', 'K', 'R', 'F'],
      example: 'G03 X10.0 Y20.0 I5.0 J0.0 F300',
    },
  ],
  [
    'G04',
    {
      command: 'G04',
      name: 'Dwell',
      description: 'Pause program execution for a specified time.',
      group: CommandGroup.DWELL,
      parameters: ['P', 'X'],
      example: 'G04 P2.0 (Dwell for 2 seconds)',
    },
  ],
  [
    'G10',
    {
      command: 'G10',
      name: 'Coordinate System Setting',
      description:
        'Set or modify coordinate system data from within the program. L2 sets work offsets, L1 sets tool offsets, L20 sets work offsets relative to current position.',
      group: CommandGroup.COORDINATE_SYSTEM,
      parameters: ['L', 'P', 'X', 'Y', 'Z', 'A', 'B', 'C', 'R'],
      example: 'G10 L2 P1 X0 Y0 Z0',
    },
  ],
  [
    'G17',
    {
      command: 'G17',
      name: 'XY Plane Selection',
      description: 'Select XY plane for circular interpolation (G02/G03).',
      group: CommandGroup.PLANE_SELECTION,
      parameters: [],
    },
  ],
  [
    'G18',
    {
      command: 'G18',
      name: 'XZ Plane Selection',
      description: 'Select XZ plane for circular interpolation (G02/G03).',
      group: CommandGroup.PLANE_SELECTION,
      parameters: [],
    },
  ],
  [
    'G19',
    {
      command: 'G19',
      name: 'YZ Plane Selection',
      description: 'Select YZ plane for circular interpolation (G02/G03).',
      group: CommandGroup.PLANE_SELECTION,
      parameters: [],
    },
  ],
  [
    'G20',
    {
      command: 'G20',
      name: 'Inch Units',
      description: 'Set units to inches for all coordinates and feed rates.',
      group: CommandGroup.UNITS,
      parameters: [],
    },
  ],
  [
    'G21',
    {
      command: 'G21',
      name: 'Metric Units',
      description: 'Set units to millimeters for all coordinates and feed rates.',
      group: CommandGroup.UNITS,
      parameters: [],
    },
  ],
  [
    'G28',
    {
      command: 'G28',
      name: 'Return to Home',
      description: 'Return to machine home position through intermediate point if specified.',
      group: CommandGroup.MOTION,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C'],
      example: 'G28 Z0.0 (Home Z-axis through Z0)',
    },
  ],
  [
    'G30',
    {
      command: 'G30',
      name: 'Return to Predefined Position',
      description:
        'Return to a predefined machine position (second home position) through an optional intermediate point.',
      group: CommandGroup.MOTION,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C'],
      example: 'G30 Z0.0',
    },
  ],
  [
    'G40',
    {
      command: 'G40',
      name: 'Cutter Compensation Cancel',
      description: 'Cancel cutter radius compensation.',
      group: CommandGroup.CUTTER_COMPENSATION,
      parameters: [],
    },
  ],
  [
    'G41',
    {
      command: 'G41',
      name: 'Cutter Compensation Left',
      description: 'Enable cutter radius compensation to the left of the programmed path.',
      group: CommandGroup.CUTTER_COMPENSATION,
      parameters: ['D'],
      example: 'G41 D01',
    },
  ],
  [
    'G42',
    {
      command: 'G42',
      name: 'Cutter Compensation Right',
      description: 'Enable cutter radius compensation to the right of the programmed path.',
      group: CommandGroup.CUTTER_COMPENSATION,
      parameters: ['D'],
      example: 'G42 D01',
    },
  ],
  [
    'G43',
    {
      command: 'G43',
      name: 'Tool Length Offset',
      description: 'Apply tool length offset in positive direction.',
      group: CommandGroup.TOOL_LENGTH_OFFSET,
      parameters: ['H'],
      example: 'G43 H01',
    },
  ],
  [
    'G49',
    {
      command: 'G49',
      name: 'Cancel Tool Length Offset',
      description: 'Cancel tool length offset compensation.',
      group: CommandGroup.TOOL_LENGTH_OFFSET,
      parameters: [],
    },
  ],
  [
    'G54',
    {
      command: 'G54',
      name: 'Work Coordinate System 1',
      description: 'Select work coordinate system 1 (offset from machine coordinates).',
      group: CommandGroup.COORDINATE_SYSTEM,
      parameters: [],
    },
  ],
  [
    'G55',
    {
      command: 'G55',
      name: 'Work Coordinate System 2',
      description: 'Select work coordinate system 2 (offset from machine coordinates).',
      group: CommandGroup.COORDINATE_SYSTEM,
      parameters: [],
    },
  ],
  [
    'G56',
    {
      command: 'G56',
      name: 'Work Coordinate System 3',
      description: 'Select work coordinate system 3 (offset from machine coordinates).',
      group: CommandGroup.COORDINATE_SYSTEM,
      parameters: [],
    },
  ],
  [
    'G57',
    {
      command: 'G57',
      name: 'Work Coordinate System 4',
      description: 'Select work coordinate system 4 (offset from machine coordinates).',
      group: CommandGroup.COORDINATE_SYSTEM,
      parameters: [],
    },
  ],
  [
    'G58',
    {
      command: 'G58',
      name: 'Work Coordinate System 5',
      description: 'Select work coordinate system 5 (offset from machine coordinates).',
      group: CommandGroup.COORDINATE_SYSTEM,
      parameters: [],
    },
  ],
  [
    'G59',
    {
      command: 'G59',
      name: 'Work Coordinate System 6',
      description: 'Select work coordinate system 6 (offset from machine coordinates).',
      group: CommandGroup.COORDINATE_SYSTEM,
      parameters: [],
    },
  ],
  [
    'G64',
    {
      command: 'G64',
      name: 'Path Blending',
      description:
        'Enable path blending (continuous path) mode. The controller blends motion between blocks to maintain feed rate. P sets the maximum path deviation tolerance; Q sets the naive cam detector tolerance for colinear segment merging. Omitting P applies blending with no tolerance limit.',
      group: CommandGroup.MOTION,
      parameters: ['P', 'Q'],
      example: 'G64 P0.01 Q0.005',
    },
  ],
  [
    'G80',
    {
      command: 'G80',
      name: 'Cancel Canned Cycle',
      description: 'Cancel active canned cycle (drilling, tapping, boring).',
      group: CommandGroup.CANNED_CYCLE,
      parameters: [],
    },
  ],
  [
    'G81',
    {
      command: 'G81',
      name: 'Drilling Cycle',
      description: 'Simple drilling cycle (rapid to Z, feed to depth, rapid out).',
      group: CommandGroup.CANNED_CYCLE,
      parameters: ['X', 'Y', 'Z', 'R', 'F'],
      example: 'G81 X10.0 Y20.0 Z-5.0 R2.0 F100',
    },
  ],
  [
    'G82',
    {
      command: 'G82',
      name: 'Spot Drilling Cycle',
      description: 'Drilling cycle with dwell at bottom.',
      group: CommandGroup.CANNED_CYCLE,
      parameters: ['X', 'Y', 'Z', 'R', 'P', 'F'],
      example: 'G82 X10.0 Y20.0 Z-5.0 R2.0 P0.5 F100',
    },
  ],
  [
    'G83',
    {
      command: 'G83',
      name: 'Peck Drilling Cycle',
      description: 'Deep hole drilling cycle with chip breaking.',
      group: CommandGroup.CANNED_CYCLE,
      parameters: ['X', 'Y', 'Z', 'R', 'Q', 'F'],
      example: 'G83 X10.0 Y20.0 Z-20.0 R2.0 Q2.0 F100',
    },
  ],
  [
    'G84',
    {
      command: 'G84',
      name: 'Tapping Cycle',
      description: 'Right-hand tapping cycle.',
      group: CommandGroup.CANNED_CYCLE,
      parameters: ['X', 'Y', 'Z', 'R', 'F'],
      example: 'G84 X10.0 Y20.0 Z-15.0 R2.0 F50',
    },
  ],
  [
    'G85',
    {
      command: 'G85',
      name: 'Boring Cycle',
      description: 'Boring cycle (feed in and out).',
      group: CommandGroup.CANNED_CYCLE,
      parameters: ['X', 'Y', 'Z', 'R', 'F'],
      example: 'G85 X10.0 Y20.0 Z-10.0 R2.0 F80',
    },
  ],
  [
    'G86',
    {
      command: 'G86',
      name: 'Boring Cycle with Stop',
      description: 'Boring cycle with spindle stop at bottom.',
      group: CommandGroup.CANNED_CYCLE,
      parameters: ['X', 'Y', 'Z', 'R', 'F'],
      example: 'G86 X10.0 Y20.0 Z-10.0 R2.0 F80',
    },
  ],
  [
    'G87',
    {
      command: 'G87',
      name: 'Back Boring Cycle',
      description: 'Back boring cycle.',
      group: CommandGroup.CANNED_CYCLE,
      parameters: ['X', 'Y', 'Z', 'R', 'I', 'J', 'F'],
      example: 'G87 X10.0 Y20.0 Z-10.0 R2.0 F80',
    },
  ],
  [
    'G88',
    {
      command: 'G88',
      name: 'Boring Cycle with Manual Retract',
      description: 'Boring cycle with spindle stop and manual retract.',
      group: CommandGroup.CANNED_CYCLE,
      parameters: ['X', 'Y', 'Z', 'R', 'P', 'F'],
      example: 'G88 X10.0 Y20.0 Z-10.0 R2.0 P2.0 F80',
    },
  ],
  [
    'G89',
    {
      command: 'G89',
      name: 'Boring Cycle with Dwell',
      description: 'Boring cycle with dwell at bottom.',
      group: CommandGroup.CANNED_CYCLE,
      parameters: ['X', 'Y', 'Z', 'R', 'P', 'F'],
      example: 'G89 X10.0 Y20.0 Z-10.0 R2.0 P1.0 F80',
    },
  ],
  [
    'G90',
    {
      command: 'G90',
      name: 'Absolute Programming',
      description: 'Coordinate values are absolute positions from work zero.',
      group: CommandGroup.DISTANCE_MODE,
      parameters: [],
    },
  ],
  [
    'G91',
    {
      command: 'G91',
      name: 'Incremental Programming',
      description: 'Coordinate values are relative to current position.',
      group: CommandGroup.DISTANCE_MODE,
      parameters: [],
    },
  ],
  [
    'G92',
    {
      command: 'G92',
      name: 'Set Work Coordinate',
      description: 'Set current position as specified coordinate value.',
      group: CommandGroup.COORDINATE_SYSTEM,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C'],
      example: 'G92 X0 Y0 Z0',
    },
  ],
  [
    'G94',
    {
      command: 'G94',
      name: 'Feed Per Minute',
      description: 'Feed rate is in units per minute.',
      group: CommandGroup.FEED_RATE_MODE,
      parameters: [],
    },
  ],
  [
    'G95',
    {
      command: 'G95',
      name: 'Feed Per Revolution',
      description: 'Feed rate is in units per spindle revolution.',
      group: CommandGroup.FEED_RATE_MODE,
      parameters: [],
    },
  ],
  [
    'G98',
    {
      command: 'G98',
      name: 'Return to Initial Point',
      description: 'Canned cycle returns to initial Z level.',
      group: CommandGroup.CANNED_CYCLE,
      parameters: [],
    },
  ],
  [
    'G99',
    {
      command: 'G99',
      name: 'Return to R Point',
      description: 'Canned cycle returns to R plane.',
      group: CommandGroup.CANNED_CYCLE,
      parameters: [],
    },
  ],
]);

/**
 * M-Code commands database
 */
export const MCODE_COMMANDS = new Map<string, GCodeCommandInfo>([
  [
    'M00',
    {
      command: 'M00',
      name: 'Program Stop',
      description: 'Stop program execution. Requires operator intervention to continue.',
      group: CommandGroup.PROGRAM_CONTROL,
      parameters: [],
    },
  ],
  [
    'M01',
    {
      command: 'M01',
      name: 'Optional Stop',
      description: 'Stop program execution if optional stop switch is enabled.',
      group: CommandGroup.PROGRAM_CONTROL,
      parameters: [],
    },
  ],
  [
    'M02',
    {
      command: 'M02',
      name: 'Program End',
      description: 'End of program. Stops spindle and coolant.',
      group: CommandGroup.PROGRAM_CONTROL,
      parameters: [],
    },
  ],
  [
    'M03',
    {
      command: 'M03',
      name: 'Spindle On Clockwise',
      description: 'Start spindle rotation clockwise (viewed from spindle).',
      group: CommandGroup.SPINDLE_CONTROL,
      parameters: ['S'],
      example: 'M03 S1000',
    },
  ],
  [
    'M04',
    {
      command: 'M04',
      name: 'Spindle On Counter-Clockwise',
      description: 'Start spindle rotation counter-clockwise (viewed from spindle).',
      group: CommandGroup.SPINDLE_CONTROL,
      parameters: ['S'],
      example: 'M04 S1000',
    },
  ],
  [
    'M05',
    {
      command: 'M05',
      name: 'Spindle Stop',
      description: 'Stop spindle rotation.',
      group: CommandGroup.SPINDLE_CONTROL,
      parameters: [],
    },
  ],
  [
    'M06',
    {
      command: 'M06',
      name: 'Tool Change',
      description: 'Automatic tool change to specified tool number.',
      group: CommandGroup.TOOL_CONTROL,
      parameters: ['T'],
      example: 'M06 T01',
    },
  ],
  [
    'M07',
    {
      command: 'M07',
      name: 'Mist Coolant On',
      description: 'Turn on mist coolant.',
      group: CommandGroup.COOLANT_CONTROL,
      parameters: [],
    },
  ],
  [
    'M08',
    {
      command: 'M08',
      name: 'Flood Coolant On',
      description: 'Turn on flood coolant.',
      group: CommandGroup.COOLANT_CONTROL,
      parameters: [],
    },
  ],
  [
    'M09',
    {
      command: 'M09',
      name: 'Coolant Off',
      description: 'Turn off all coolant.',
      group: CommandGroup.COOLANT_CONTROL,
      parameters: [],
    },
  ],
  [
    'M30',
    {
      command: 'M30',
      name: 'Program End and Reset',
      description: 'End of program. Stops spindle, coolant, and rewinds program to start.',
      group: CommandGroup.PROGRAM_CONTROL,
      parameters: [],
    },
  ],
  [
    'M98',
    {
      command: 'M98',
      name: 'Subprogram Call',
      description: 'Call a subprogram by program number.',
      group: CommandGroup.PROGRAM_CONTROL,
      parameters: ['P', 'L'],
      example: 'M98 P1000 L2 (Call program O1000 twice)',
    },
  ],
  [
    'M99',
    {
      command: 'M99',
      name: 'Subprogram Return',
      description: 'Return from subprogram to main program.',
      group: CommandGroup.PROGRAM_CONTROL,
      parameters: [],
    },
  ],
]);
