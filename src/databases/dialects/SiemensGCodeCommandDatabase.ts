/**
 * Siemens/Sinumerik G-Code Command Database
 *
 * Provides documentation and descriptions for Siemens-specific G-codes and M-codes.
 * Siemens Sinumerik controls support extended G-code ranges and different syntax.
 *
 * Key Siemens characteristics:
 * - G-codes beyond 99 (extended range)
 * - Different variable syntax (R parameters)
 * - Different coordinate system commands
 * - Advanced interpolation modes
 * - Siemens-specific cycles
 */

import { GCodeCommandInfo } from '../types';

/**
 * Siemens G-Code commands database (includes standard + Siemens-specific codes)
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
        'Circular motion clockwise at programmed feed rate. Requires arc center (I, J, K) or radius (CR).',
      group: 'Motion',
      parameters: ['X', 'Y', 'Z', 'I', 'J', 'K', 'CR', 'F'],
      example: 'G02 X10.0 Y10.0 I5.0 J0 F300',
    },
  ],
  [
    'G03',
    {
      command: 'G03',
      name: 'Circular Interpolation CCW',
      description:
        'Circular motion counter-clockwise at programmed feed rate. Requires arc center (I, J, K) or radius (CR).',
      group: 'Motion',
      parameters: ['X', 'Y', 'Z', 'I', 'J', 'K', 'CR', 'F'],
      example: 'G03 X10.0 Y10.0 I5.0 J0 F300',
    },
  ],
  [
    'G04',
    {
      command: 'G04',
      name: 'Dwell',
      description:
        'Pause program execution for a specified time. On Sinumerik, F parameter specifies dwell time in seconds.',
      group: 'Motion',
      parameters: ['F'],
      example: 'G04 F2.5',
    },
  ],
  [
    'G17',
    {
      command: 'G17',
      name: 'XY Plane Selection',
      description:
        'Select XY plane for circular interpolation and tool radius compensation. Default plane on Sinumerik.',
      group: 'Plane Selection',
      example: 'G17',
    },
  ],
  [
    'G18',
    {
      command: 'G18',
      name: 'XZ Plane Selection',
      description: 'Select XZ plane for circular interpolation and tool radius compensation.',
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
    'G40',
    {
      command: 'G40',
      name: 'Tool Radius Compensation Off',
      description: 'Cancel tool radius compensation.',
      group: 'Compensation',
      example: 'G40',
    },
  ],
  [
    'G41',
    {
      command: 'G41',
      name: 'Tool Radius Compensation Left',
      description: 'Tool radius compensation to the left of the programmed path.',
      group: 'Compensation',
      example: 'G41',
    },
  ],
  [
    'G42',
    {
      command: 'G42',
      name: 'Tool Radius Compensation Right',
      description: 'Tool radius compensation to the right of the programmed path.',
      group: 'Compensation',
      example: 'G42',
    },
  ],
  [
    'G43',
    {
      command: 'G43',
      name: 'Tool Length Offset',
      description:
        'Apply tool length offset. On Sinumerik, tool length compensation is typically handled via D numbers in the tool call.',
      group: 'Compensation',
      parameters: ['H'],
      example: 'G43 H01',
    },
  ],
  [
    'G54',
    {
      command: 'G54',
      name: 'Work Offset 1',
      description:
        'Select work offset/coordinate system 1. On Sinumerik, settable work offsets are also available via FRAMES.',
      group: 'Coordinate Systems',
      example: 'G54',
    },
  ],
  [
    'G55',
    {
      command: 'G55',
      name: 'Work Offset 2',
      description: 'Select work offset/coordinate system 2.',
      group: 'Coordinate Systems',
      example: 'G55',
    },
  ],
  [
    'G56',
    {
      command: 'G56',
      name: 'Work Offset 3',
      description: 'Select work offset/coordinate system 3.',
      group: 'Coordinate Systems',
      example: 'G56',
    },
  ],
  [
    'G57',
    {
      command: 'G57',
      name: 'Work Offset 4',
      description:
        'Select work offset/coordinate system 4. Sinumerik supports G54-G57 as standard settable work offsets.',
      group: 'Coordinate Systems',
      example: 'G57',
    },
  ],
  [
    'G64',
    {
      command: 'G64',
      name: 'Continuous-Path Mode',
      description:
        'Sinumerik-specific: Enable continuous-path mode for smooth motion between blocks. Corners are rounded to maintain feed rate. ADIS/ADISPOS controls the rounding tolerance.',
      group: 'Motion',
      parameters: ['ADIS', 'ADISPOS'],
      example: 'G64 ADIS=0.5',
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
    'G94',
    {
      command: 'G94',
      name: 'Feed Per Minute',
      description: 'Feed rate is specified in mm/min or inches/min.',
      group: 'Feed Rate Mode',
      example: 'G94',
    },
  ],
  [
    'G95',
    {
      command: 'G95',
      name: 'Feed Per Revolution',
      description:
        'Feed rate is specified in mm/rev or inches/rev. Commonly used for turning operations.',
      group: 'Feed Rate Mode',
      example: 'G95',
    },
  ],
  [
    'G110',
    {
      command: 'G110',
      name: 'Pole Programming Relative to Last Programmed Position',
      description:
        'Siemens-specific: Define pole for polar coordinate programming relative to last position.',
      group: 'Coordinate Systems',
      parameters: ['X', 'Y'],
      example: 'G110 X50 Y50',
    },
  ],
  [
    'G111',
    {
      command: 'G111',
      name: 'Pole Programming Relative to Zero Point',
      description:
        'Siemens-specific: Define pole for polar coordinate programming relative to zero point.',
      group: 'Coordinate Systems',
      parameters: ['X', 'Y'],
      example: 'G111 X50 Y50',
    },
  ],
  [
    'G112',
    {
      command: 'G112',
      name: 'Polar Coordinates Relative to Pole',
      description: 'Siemens-specific: Program in polar coordinates (radius and angle).',
      group: 'Coordinate Systems',
      example: 'G112',
    },
  ],
]);

/**
 * Siemens M-Code commands database
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
      description: 'End of program without return to start.',
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
      description:
        'Perform automatic tool change. On Sinumerik, tool changes are typically performed with T and M6 commands.',
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
      name: 'Flood Coolant On',
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
    'M17',
    {
      command: 'M17',
      name: 'Subprogram Return',
      description: 'Siemens-specific: Return from subprogram.',
      group: 'Program Control',
      example: 'M17',
    },
  ],
  [
    'M19',
    {
      command: 'M19',
      name: 'Spindle Orientation',
      description:
        'Orient the spindle to a specific angular position. On Sinumerik, SPOS is also available for spindle positioning.',
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
]);
