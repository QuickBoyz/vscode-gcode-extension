/**
 * Fanuc G-Code Command Database
 *
 * Provides documentation and descriptions for Fanuc-specific G-codes and M-codes.
 * Fanuc is an industry-standard control system used in mills and lathes.
 *
 * Key Fanuc characteristics:
 * - G65 macro call system
 * - Numeric variables #1-#999
 * - G41.1/G42.1 dynamic tool radius compensation
 * - M98/M99 subprogram calls
 * - Fanuc-specific canned cycles
 */

import { GCodeCommandInfo } from '../types';

/**
 * Fanuc G-Code commands database
 */
export const GCODE_COMMANDS = new Map<string, GCodeCommandInfo>([
  [
    'G00',
    {
      command: 'G00',
      name: 'Rapid Positioning',
      description: 'Rapid traverse motion at maximum speed. Used for non-cutting moves.',
      group: 'Motion',
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
      group: 'Motion',
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
      group: 'Motion',
      parameters: ['X', 'Y', 'Z', 'I', 'J', 'K', 'R', 'F'],
      example: 'G02 X10.0 Y10.0 I5.0 J0 F300',
    },
  ],
  [
    'G03',
    {
      command: 'G03',
      name: 'Circular Interpolation CCW',
      description:
        'Circular motion counter-clockwise at programmed feed rate. Requires arc center (I, J, K) or radius (R).',
      group: 'Motion',
      parameters: ['X', 'Y', 'Z', 'I', 'J', 'K', 'R', 'F'],
      example: 'G03 X10.0 Y10.0 I5.0 J0 F300',
    },
  ],
  [
    'G04',
    {
      command: 'G04',
      name: 'Dwell',
      description:
        'Pause program execution for a specified time (P in seconds or X in milliseconds).',
      group: 'Motion',
      parameters: ['P', 'X'],
      example: 'G04 P2.5',
    },
  ],
  [
    'G10',
    {
      command: 'G10',
      name: 'Data Setting',
      description:
        'Set or modify work offsets and tool offsets from within the program. L2 sets work coordinate offsets, L10/L11 sets tool geometry/wear offsets.',
      group: 'Coordinate Systems',
      parameters: ['L', 'P', 'X', 'Y', 'Z', 'A', 'B', 'C', 'R'],
      example: 'G10 L2 P1 X0 Y0 Z0',
    },
  ],
  [
    'G17',
    {
      command: 'G17',
      name: 'XY Plane Selection',
      description: 'Select XY plane for circular interpolation and tool radius compensation.',
      group: 'Plane Selection',
      example: 'G17',
    },
  ],
  [
    'G18',
    {
      command: 'G18',
      name: 'ZX Plane Selection',
      description: 'Select ZX plane for circular interpolation and tool radius compensation.',
      group: 'Plane Selection',
      example: 'G18',
    },
  ],
  [
    'G19',
    {
      command: 'G19',
      name: 'YZ Plane Selection',
      description: 'Select YZ plane for circular interpolation and tool radius compensation.',
      group: 'Plane Selection',
      example: 'G19',
    },
  ],
  [
    'G28',
    {
      command: 'G28',
      name: 'Return to Reference Point',
      description:
        'Return to machine reference point (home position) through an optional intermediate point. Commonly used before tool changes.',
      group: 'Motion',
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C'],
      example: 'G28 G91 Z0',
    },
  ],
  [
    'G30',
    {
      command: 'G30',
      name: 'Return to 2nd Reference Point',
      description:
        'Return to the second reference point (2nd home position) through an optional intermediate point.',
      group: 'Motion',
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C'],
      example: 'G30 G91 Z0',
    },
  ],
  [
    'G40',
    {
      command: 'G40',
      name: 'Cutter Compensation Cancel',
      description: 'Cancel tool radius compensation.',
      group: 'Compensation',
      example: 'G40',
    },
  ],
  [
    'G41',
    {
      command: 'G41',
      name: 'Cutter Compensation Left',
      description: 'Tool radius compensation to the left of the programmed path.',
      group: 'Compensation',
      parameters: ['D'],
      example: 'G41 D01',
    },
  ],
  [
    'G41.1',
    {
      command: 'G41.1',
      name: 'Dynamic Cutter Compensation Left',
      description:
        'Dynamic tool radius compensation left. Allows inline specification of tool radius.',
      group: 'Compensation',
      parameters: ['D', 'L'],
      example: 'G41.1 D0.5',
    },
  ],
  [
    'G42',
    {
      command: 'G42',
      name: 'Cutter Compensation Right',
      description: 'Tool radius compensation to the right of the programmed path.',
      group: 'Compensation',
      parameters: ['D'],
      example: 'G42 D01',
    },
  ],
  [
    'G42.1',
    {
      command: 'G42.1',
      name: 'Dynamic Cutter Compensation Right',
      description:
        'Dynamic tool radius compensation right. Allows inline specification of tool radius.',
      group: 'Compensation',
      parameters: ['D', 'L'],
      example: 'G42.1 D0.5',
    },
  ],
  [
    'G43',
    {
      command: 'G43',
      name: 'Tool Length Offset',
      description: 'Apply tool length offset (plus).',
      group: 'Compensation',
      parameters: ['H'],
      example: 'G43 H01 Z100',
    },
  ],
  [
    'G49',
    {
      command: 'G49',
      name: 'Tool Length Offset Cancel',
      description: 'Cancel tool length offset.',
      group: 'Compensation',
      example: 'G49',
    },
  ],
  [
    'G54',
    {
      command: 'G54',
      name: 'Work Coordinate System 1',
      description: 'Select work coordinate system 1.',
      group: 'Coordinate Systems',
      example: 'G54',
    },
  ],
  [
    'G55',
    {
      command: 'G55',
      name: 'Work Coordinate System 2',
      description: 'Select work coordinate system 2.',
      group: 'Coordinate Systems',
      example: 'G55',
    },
  ],
  [
    'G56',
    {
      command: 'G56',
      name: 'Work Coordinate System 3',
      description: 'Select work coordinate system 3.',
      group: 'Coordinate Systems',
      example: 'G56',
    },
  ],
  [
    'G57',
    {
      command: 'G57',
      name: 'Work Coordinate System 4',
      description: 'Select work coordinate system 4.',
      group: 'Coordinate Systems',
      example: 'G57',
    },
  ],
  [
    'G58',
    {
      command: 'G58',
      name: 'Work Coordinate System 5',
      description: 'Select work coordinate system 5.',
      group: 'Coordinate Systems',
      example: 'G58',
    },
  ],
  [
    'G59',
    {
      command: 'G59',
      name: 'Work Coordinate System 6',
      description: 'Select work coordinate system 6.',
      group: 'Coordinate Systems',
      example: 'G59',
    },
  ],
  [
    'G65',
    {
      command: 'G65',
      name: 'Macro Call',
      description:
        'Call a macro subprogram with argument passing. Fanuc-specific macro call system.',
      group: 'Program Control',
      parameters: [
        'P',
        'A',
        'B',
        'C',
        'D',
        'E',
        'F',
        'H',
        'I',
        'J',
        'K',
        'M',
        'Q',
        'R',
        'S',
        'T',
        'U',
        'V',
        'W',
        'X',
        'Y',
        'Z',
      ],
      example: 'G65 P9010 A10.0 B20.0',
    },
  ],
  [
    'G73',
    {
      command: 'G73',
      name: 'High-Speed Peck Drilling Cycle',
      description:
        'Peck drilling cycle with chip breaking. Retracts a small amount between pecks for chip breaking instead of fully retracting.',
      group: 'Canned Cycles',
      parameters: ['X', 'Y', 'Z', 'R', 'Q', 'F'],
      example: 'G73 X10.0 Y20.0 Z-20.0 R2.0 Q2.0 F100',
    },
  ],
  [
    'G80',
    {
      command: 'G80',
      name: 'Canned Cycle Cancel',
      description: 'Cancel active canned cycle.',
      group: 'Canned Cycles',
      example: 'G80',
    },
  ],
  [
    'G81',
    {
      command: 'G81',
      name: 'Drilling Cycle',
      description: 'Simple drilling cycle with rapid retract.',
      group: 'Canned Cycles',
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
      group: 'Canned Cycles',
      parameters: ['X', 'Y', 'Z', 'R', 'P', 'F'],
      example: 'G82 X10.0 Y20.0 Z-5.0 R2.0 P1000 F100',
    },
  ],
  [
    'G83',
    {
      command: 'G83',
      name: 'Peck Drilling Cycle',
      description: 'Deep hole drilling with pecking (chip breaking).',
      group: 'Canned Cycles',
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
      group: 'Canned Cycles',
      parameters: ['X', 'Y', 'Z', 'R', 'F'],
      example: 'G84 X10.0 Y20.0 Z-15.0 R2.0 F50',
    },
  ],
  [
    'G85',
    {
      command: 'G85',
      name: 'Boring Cycle',
      description: 'Boring cycle with feed in and feed out.',
      group: 'Canned Cycles',
      parameters: ['X', 'Y', 'Z', 'R', 'F'],
      example: 'G85 X10.0 Y20.0 Z-10.0 R2.0 F100',
    },
  ],
  [
    'G86',
    {
      command: 'G86',
      name: 'Boring Cycle with Stop',
      description: 'Boring cycle with spindle stop at bottom before rapid retract.',
      group: 'Canned Cycles',
      parameters: ['X', 'Y', 'Z', 'R', 'F'],
      example: 'G86 X10.0 Y20.0 Z-10.0 R2.0 F80',
    },
  ],
  [
    'G90',
    {
      command: 'G90',
      name: 'Absolute Programming',
      description: 'Program in absolute coordinates (relative to work zero).',
      group: 'Distance Mode',
      example: 'G90',
    },
  ],
  [
    'G91',
    {
      command: 'G91',
      name: 'Incremental Programming',
      description: 'Program in incremental coordinates (relative to current position).',
      group: 'Distance Mode',
      example: 'G91',
    },
  ],
  [
    'G92',
    {
      command: 'G92',
      name: 'Work Coordinate System Shift',
      description: 'Set work coordinate system offset.',
      group: 'Coordinate Systems',
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C'],
      example: 'G92 X0 Y0 Z0',
    },
  ],
  [
    'G94',
    {
      command: 'G94',
      name: 'Feed Per Minute',
      description: 'Feed rate in units per minute.',
      group: 'Feed Rate Mode',
      example: 'G94',
    },
  ],
  [
    'G95',
    {
      command: 'G95',
      name: 'Feed Per Revolution',
      description: 'Feed rate in units per spindle revolution.',
      group: 'Feed Rate Mode',
      example: 'G95',
    },
  ],
  [
    'G98',
    {
      command: 'G98',
      name: 'Canned Cycle Return to Initial Point',
      description: 'Return to initial Z level in canned cycles.',
      group: 'Canned Cycles',
      example: 'G98',
    },
  ],
  [
    'G99',
    {
      command: 'G99',
      name: 'Canned Cycle Return to R Point',
      description: 'Return to R level in canned cycles.',
      group: 'Canned Cycles',
      example: 'G99',
    },
  ],
]);

/**
 * Fanuc M-Code commands database
 */
export const MCODE_COMMANDS = new Map<string, GCodeCommandInfo>([
  [
    'M00',
    {
      command: 'M00',
      name: 'Program Stop',
      description: 'Pause program execution. Requires operator action to continue.',
      group: 'Program Control',
      example: 'M00',
    },
  ],
  [
    'M01',
    {
      command: 'M01',
      name: 'Optional Stop',
      description: 'Conditional program stop (if optional stop switch is on).',
      group: 'Program Control',
      example: 'M01',
    },
  ],
  [
    'M02',
    {
      command: 'M02',
      name: 'Program End',
      description: 'End of program. Resets to start of program.',
      group: 'Program Control',
      example: 'M02',
    },
  ],
  [
    'M03',
    {
      command: 'M03',
      name: 'Spindle On CW',
      description: 'Start spindle rotation clockwise.',
      group: 'Spindle Control',
      parameters: ['S'],
      example: 'M03 S1000',
    },
  ],
  [
    'M04',
    {
      command: 'M04',
      name: 'Spindle On CCW',
      description: 'Start spindle rotation counter-clockwise.',
      group: 'Spindle Control',
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
      group: 'Spindle Control',
      example: 'M05',
    },
  ],
  [
    'M06',
    {
      command: 'M06',
      name: 'Tool Change',
      description: 'Perform automatic tool change.',
      group: 'Tool Control',
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
      group: 'Coolant Control',
      example: 'M07',
    },
  ],
  [
    'M08',
    {
      command: 'M08',
      name: 'Coolant On',
      description: 'Turn on flood coolant.',
      group: 'Coolant Control',
      example: 'M08',
    },
  ],
  [
    'M09',
    {
      command: 'M09',
      name: 'Coolant Off',
      description: 'Turn off all coolant.',
      group: 'Coolant Control',
      example: 'M09',
    },
  ],
  [
    'M19',
    {
      command: 'M19',
      name: 'Spindle Orientation',
      description: 'Orient the spindle to a specific angular position.',
      group: 'Spindle Control',
      example: 'M19',
    },
  ],
  [
    'M30',
    {
      command: 'M30',
      name: 'Program End and Reset',
      description: 'End of program and reset to beginning.',
      group: 'Program Control',
      example: 'M30',
    },
  ],
  [
    'M98',
    {
      command: 'M98',
      name: 'Subprogram Call',
      description: 'Call a subprogram. Fanuc standard subprogram call.',
      group: 'Program Control',
      parameters: ['P', 'L'],
      example: 'M98 P1000',
    },
  ],
  [
    'M99',
    {
      command: 'M99',
      name: 'Subprogram Return',
      description: 'Return from subprogram to main program.',
      group: 'Program Control',
      example: 'M99',
    },
  ],
]);
