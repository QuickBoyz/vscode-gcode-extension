/**
 * Haas G-Code Command Database
 *
 * Provides documentation and descriptions for Haas-specific G-codes and M-codes.
 * Haas is a popular CNC machine manufacturer with mill-specific extensions.
 *
 * Key Haas characteristics:
 * - G187 accuracy control
 * - M95-M99 jump labels
 * - VPS (Vector Partition Smoothing)
 * - Haas-specific control functions
 * - Mill-specific G-codes
 */

import { CommandGroup, GCodeCommandInfo } from '../types';

/**
 * Haas G-Code commands database (includes standard + Haas-specific codes)
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
      group: CommandGroup.MOTION,
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
        'Pause program execution for a specified time. P value is in seconds on Haas controls.',
      group: CommandGroup.MOTION,
      parameters: ['P'],
      example: 'G04 P1.5',
    },
  ],
  [
    'G10',
    {
      command: 'G10',
      name: 'Offset Setting',
      description:
        'Set or modify work offsets and tool offsets from within the program. Haas supports L2 (work offset) and L10/L11 (tool offset) modes.',
      group: CommandGroup.COORDINATE_SYSTEMS,
      parameters: ['L', 'P', 'X', 'Y', 'Z', 'A', 'B', 'C', 'R'],
      example: 'G10 L2 P1 X0 Y0 Z0',
    },
  ],
  [
    'G12',
    {
      command: 'G12',
      name: 'Circular Pocket Milling CW',
      description:
        'Haas-specific: Mill a circular pocket in the clockwise direction. Uses current tool position as center.',
      group: CommandGroup.CANNED_CYCLES,
      parameters: ['I', 'J', 'K', 'Q', 'L', 'F'],
      example: 'G12 I2.0 J0.1 K0.5 Q5 F20.0',
    },
  ],
  [
    'G13',
    {
      command: 'G13',
      name: 'Circular Pocket Milling CCW',
      description:
        'Haas-specific: Mill a circular pocket in the counter-clockwise direction. Uses current tool position as center.',
      group: CommandGroup.CANNED_CYCLES,
      parameters: ['I', 'J', 'K', 'Q', 'L', 'F'],
      example: 'G13 I2.0 J0.1 K0.5 Q5 F20.0',
    },
  ],
  [
    'G17',
    {
      command: 'G17',
      name: 'XY Plane Selection',
      description: 'Select XY plane for circular interpolation and cutter compensation.',
      group: CommandGroup.PLANE_SELECTION,
      example: 'G17',
    },
  ],
  [
    'G18',
    {
      command: 'G18',
      name: 'XZ Plane Selection',
      description: 'Select XZ plane for circular interpolation and cutter compensation.',
      group: CommandGroup.PLANE_SELECTION,
      example: 'G18',
    },
  ],
  [
    'G19',
    {
      command: 'G19',
      name: 'YZ Plane Selection',
      description: 'Select YZ plane for circular interpolation and cutter compensation.',
      group: CommandGroup.PLANE_SELECTION,
      example: 'G19',
    },
  ],
  [
    'G28',
    {
      command: 'G28',
      name: 'Return to Machine Zero',
      description:
        'Return to machine home position through an optional intermediate point. Commonly used before tool changes.',
      group: CommandGroup.MOTION,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C'],
      example: 'G28 G91 Z0',
    },
  ],
  [
    'G40',
    {
      command: 'G40',
      name: 'Cutter Compensation Cancel',
      description: 'Cancel tool radius compensation.',
      group: CommandGroup.COMPENSATION,
      example: 'G40',
    },
  ],
  [
    'G41',
    {
      command: 'G41',
      name: 'Cutter Compensation Left',
      description: 'Tool radius compensation to the left of the programmed path.',
      group: CommandGroup.COMPENSATION,
      parameters: ['D'],
      example: 'G41 D01',
    },
  ],
  [
    'G42',
    {
      command: 'G42',
      name: 'Cutter Compensation Right',
      description: 'Tool radius compensation to the right of the programmed path.',
      group: CommandGroup.COMPENSATION,
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
      group: CommandGroup.COMPENSATION,
      parameters: ['H'],
      example: 'G43 H01 Z1.0',
    },
  ],
  [
    'G49',
    {
      command: 'G49',
      name: 'Cancel Tool Length Offset',
      description: 'Cancel tool length offset compensation.',
      group: CommandGroup.COMPENSATION,
      example: 'G49',
    },
  ],
  [
    'G54',
    {
      command: 'G54',
      name: 'Work Coordinate System 1',
      description: 'Select work coordinate system 1.',
      group: CommandGroup.COORDINATE_SYSTEMS,
      example: 'G54',
    },
  ],
  [
    'G55',
    {
      command: 'G55',
      name: 'Work Coordinate System 2',
      description: 'Select work coordinate system 2.',
      group: CommandGroup.COORDINATE_SYSTEMS,
      example: 'G55',
    },
  ],
  [
    'G56',
    {
      command: 'G56',
      name: 'Work Coordinate System 3',
      description: 'Select work coordinate system 3.',
      group: CommandGroup.COORDINATE_SYSTEMS,
      example: 'G56',
    },
  ],
  [
    'G57',
    {
      command: 'G57',
      name: 'Work Coordinate System 4',
      description: 'Select work coordinate system 4.',
      group: CommandGroup.COORDINATE_SYSTEMS,
      example: 'G57',
    },
  ],
  [
    'G58',
    {
      command: 'G58',
      name: 'Work Coordinate System 5',
      description: 'Select work coordinate system 5.',
      group: CommandGroup.COORDINATE_SYSTEMS,
      example: 'G58',
    },
  ],
  [
    'G59',
    {
      command: 'G59',
      name: 'Work Coordinate System 6',
      description: 'Select work coordinate system 6.',
      group: CommandGroup.COORDINATE_SYSTEMS,
      example: 'G59',
    },
  ],
  [
    'G73',
    {
      command: 'G73',
      name: 'High-Speed Peck Drilling',
      description:
        'Peck drilling cycle with chip breaking. Retracts a small amount between pecks instead of fully retracting.',
      group: CommandGroup.CANNED_CYCLES,
      parameters: ['X', 'Y', 'Z', 'R', 'Q', 'F'],
      example: 'G73 X10.0 Y20.0 Z-20.0 R2.0 Q2.0 F100',
    },
  ],
  [
    'G76',
    {
      command: 'G76',
      name: 'Fine Boring Cycle',
      description:
        'Fine boring cycle. Tool shifts away from bore wall before retract to prevent surface damage.',
      group: CommandGroup.CANNED_CYCLES,
      parameters: ['X', 'Y', 'Z', 'R', 'I', 'J', 'P', 'Q', 'F'],
      example: 'G76 X10.0 Y20.0 Z-10.0 R2.0 Q0.1 F80',
    },
  ],
  [
    'G80',
    {
      command: 'G80',
      name: 'Canned Cycle Cancel',
      description: 'Cancel active canned cycle (drilling, tapping, boring).',
      group: CommandGroup.CANNED_CYCLES,
      example: 'G80',
    },
  ],
  [
    'G81',
    {
      command: 'G81',
      name: 'Drilling Cycle',
      description: 'Simple drilling cycle with rapid retract.',
      group: CommandGroup.CANNED_CYCLES,
      parameters: ['X', 'Y', 'Z', 'R', 'F'],
      example: 'G81 X10.0 Y20.0 Z-5.0 R2.0 F100',
    },
  ],
  [
    'G82',
    {
      command: 'G82',
      name: 'Spot Drilling Cycle',
      description: 'Drilling cycle with dwell at the bottom of the hole.',
      group: CommandGroup.CANNED_CYCLES,
      parameters: ['X', 'Y', 'Z', 'R', 'P', 'F'],
      example: 'G82 X10.0 Y20.0 Z-5.0 R2.0 P0.5 F100',
    },
  ],
  [
    'G83',
    {
      command: 'G83',
      name: 'Peck Drilling Cycle',
      description:
        'Deep hole drilling with pecking. Fully retracts to R plane between pecks for chip clearing.',
      group: CommandGroup.CANNED_CYCLES,
      parameters: ['X', 'Y', 'Z', 'R', 'Q', 'F'],
      example: 'G83 X10.0 Y20.0 Z-20.0 R2.0 Q2.0 F100',
    },
  ],
  [
    'G84',
    {
      command: 'G84',
      name: 'Tapping Cycle',
      description:
        'Right-hand rigid tapping cycle. Haas controls support rigid tapping by default.',
      group: CommandGroup.CANNED_CYCLES,
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
      group: CommandGroup.CANNED_CYCLES,
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
      group: CommandGroup.CANNED_CYCLES,
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
      group: CommandGroup.DISTANCE_MODE,
      example: 'G90',
    },
  ],
  [
    'G91',
    {
      command: 'G91',
      name: 'Incremental Programming',
      description: 'Program in incremental coordinates (relative to current position).',
      group: CommandGroup.DISTANCE_MODE,
      example: 'G91',
    },
  ],
  [
    'G92',
    {
      command: 'G92',
      name: 'Work Coordinate System Offset',
      description:
        'Set work coordinate system offset. Shifts all work coordinate systems by the specified amount.',
      group: CommandGroup.COORDINATE_SYSTEMS,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C'],
      example: 'G92 X0 Y0 Z0',
    },
  ],
  [
    'G94',
    {
      command: 'G94',
      name: 'Feed Per Minute',
      description: 'Feed rate is specified in units (inches or mm) per minute.',
      group: CommandGroup.FEED_RATE_MODE,
      example: 'G94',
    },
  ],
  [
    'G95',
    {
      command: 'G95',
      name: 'Feed Per Revolution',
      description: 'Feed rate is specified in units (inches or mm) per spindle revolution.',
      group: CommandGroup.FEED_RATE_MODE,
      example: 'G95',
    },
  ],
  [
    'G98',
    {
      command: 'G98',
      name: 'Canned Cycle Return to Initial Point',
      description: 'Return to initial Z level after canned cycle operation.',
      group: CommandGroup.CANNED_CYCLES,
      example: 'G98',
    },
  ],
  [
    'G99',
    {
      command: 'G99',
      name: 'Canned Cycle Return to R Point',
      description: 'Return to R plane after canned cycle operation.',
      group: CommandGroup.CANNED_CYCLES,
      example: 'G99',
    },
  ],
  [
    'G103',
    {
      command: 'G103',
      name: 'Block Look-Ahead Limit',
      description:
        'Haas-specific: Limit the number of blocks the control looks ahead. Used to control motion buffering behavior.',
      group: CommandGroup.PROGRAM_CONTROL,
      parameters: ['P'],
      example: 'G103 P1',
    },
  ],
  [
    'G150',
    {
      command: 'G150',
      name: 'Pocket Milling',
      description:
        'Haas-specific: General-purpose pocket milling cycle. Mills rectangular or irregular pocket shapes.',
      group: CommandGroup.CANNED_CYCLES,
      parameters: ['X', 'Y', 'Z', 'I', 'J', 'K', 'P', 'Q', 'R', 'F'],
      example: 'G150 P1 X5.0 Y3.0 Z-0.5 I0.1 K1.0 R0.5 F30.0',
    },
  ],
  [
    'G187',
    {
      command: 'G187',
      name: 'Accuracy Control',
      description:
        'Haas-specific: Accuracy control. Adjusts corner rounding and smoothing behavior. P1=rough, P2=medium, P3=finish.',
      group: CommandGroup.MOTION,
      parameters: ['P', 'E'],
      example: 'G187 P3',
    },
  ],
]);

/**
 * Haas M-Code commands database
 */
export const MCODE_COMMANDS = new Map<string, GCodeCommandInfo>([
  [
    'M00',
    {
      command: 'M00',
      name: 'Program Stop',
      description: 'Pause program execution. Requires operator action to continue.',
      group: CommandGroup.PROGRAM_CONTROL,
      example: 'M00',
    },
  ],
  [
    'M01',
    {
      command: 'M01',
      name: 'Optional Stop',
      description:
        'Conditional program stop. Only stops if the optional stop switch is enabled on the control.',
      group: CommandGroup.PROGRAM_CONTROL,
      example: 'M01',
    },
  ],
  [
    'M02',
    {
      command: 'M02',
      name: 'Program End',
      description: 'End of program without reset to beginning.',
      group: CommandGroup.PROGRAM_CONTROL,
      example: 'M02',
    },
  ],
  [
    'M03',
    {
      command: 'M03',
      name: 'Spindle On CW',
      description: 'Start spindle rotation clockwise.',
      group: CommandGroup.SPINDLE_CONTROL,
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
      example: 'M05',
    },
  ],
  [
    'M06',
    {
      command: 'M06',
      name: 'Tool Change',
      description:
        'Perform automatic tool change. Haas uses T with M06 for tool selection and change.',
      group: CommandGroup.TOOL_CONTROL,
      parameters: ['T'],
      example: 'T01 M06',
    },
  ],
  [
    'M07',
    {
      command: 'M07',
      name: 'Mist Coolant On',
      description: 'Turn on mist coolant.',
      group: CommandGroup.COOLANT_CONTROL,
      example: 'M07',
    },
  ],
  [
    'M08',
    {
      command: 'M08',
      name: 'Flood Coolant On',
      description: 'Turn on flood coolant.',
      group: CommandGroup.COOLANT_CONTROL,
      example: 'M08',
    },
  ],
  [
    'M09',
    {
      command: 'M09',
      name: 'Coolant Off',
      description: 'Turn off all coolant.',
      group: CommandGroup.COOLANT_CONTROL,
      example: 'M09',
    },
  ],
  [
    'M10',
    {
      command: 'M10',
      name: '4th Axis Brake On',
      description: 'Haas-specific: Engage the 4th axis brake clamp.',
      group: CommandGroup.MACHINE_CONTROL,
      example: 'M10',
    },
  ],
  [
    'M11',
    {
      command: 'M11',
      name: '4th Axis Brake Off',
      description: 'Haas-specific: Release the 4th axis brake clamp.',
      group: CommandGroup.MACHINE_CONTROL,
      example: 'M11',
    },
  ],
  [
    'M19',
    {
      command: 'M19',
      name: 'Spindle Orientation',
      description:
        'Orient the spindle to a specific angular position. Used before tool changes or oriented operations.',
      group: CommandGroup.SPINDLE_CONTROL,
      parameters: ['R'],
      example: 'M19 R0',
    },
  ],
  [
    'M30',
    {
      command: 'M30',
      name: 'Program End and Reset',
      description: 'End of program and reset to beginning.',
      group: CommandGroup.PROGRAM_CONTROL,
      example: 'M30',
    },
  ],
  [
    'M80',
    {
      command: 'M80',
      name: 'Auto Door Open',
      description: 'Haas-specific: Open the automatic door.',
      group: CommandGroup.PROGRAM_CONTROL,
      example: 'M80',
    },
  ],
  [
    'M81',
    {
      command: 'M81',
      name: 'Auto Door Close',
      description: 'Haas-specific: Close the automatic door.',
      group: CommandGroup.PROGRAM_CONTROL,
      example: 'M81',
    },
  ],
  [
    'M88',
    {
      command: 'M88',
      name: 'Through-Spindle Coolant On',
      description: 'Haas-specific: Turn on through-spindle coolant (TSC). Requires TSC option.',
      group: CommandGroup.COOLANT_CONTROL,
      example: 'M88',
    },
  ],
  [
    'M89',
    {
      command: 'M89',
      name: 'Through-Spindle Coolant Off',
      description: 'Haas-specific: Turn off through-spindle coolant (TSC).',
      group: CommandGroup.COOLANT_CONTROL,
      example: 'M89',
    },
  ],
  [
    'M95',
    {
      command: 'M95',
      name: 'Sleep',
      description: 'Haas-specific: Wait for external signal before continuing.',
      group: CommandGroup.PROGRAM_CONTROL,
      parameters: ['P'],
      example: 'M95 P1000',
    },
  ],
  [
    'M96',
    {
      command: 'M96',
      name: 'Jump If No Signal',
      description: 'Haas-specific: Conditional jump if no input signal detected.',
      group: CommandGroup.PROGRAM_CONTROL,
      parameters: ['P', 'Q'],
      example: 'M96 P1000 Q1',
    },
  ],
  [
    'M97',
    {
      command: 'M97',
      name: 'Local Subprogram Call',
      description: 'Haas-specific: Call local subprogram by line number.',
      group: CommandGroup.PROGRAM_CONTROL,
      parameters: ['P', 'L'],
      example: 'M97 P100',
    },
  ],
  [
    'M98',
    {
      command: 'M98',
      name: 'Subprogram Call',
      description: 'Call external subprogram by program number.',
      group: CommandGroup.PROGRAM_CONTROL,
      parameters: ['P', 'L'],
      example: 'M98 P1000',
    },
  ],
  [
    'M99',
    {
      command: 'M99',
      name: 'Subprogram Return / Repeat',
      description: 'Return from subprogram or repeat program from beginning.',
      group: CommandGroup.PROGRAM_CONTROL,
      parameters: ['P'],
      example: 'M99',
    },
  ],
]);
