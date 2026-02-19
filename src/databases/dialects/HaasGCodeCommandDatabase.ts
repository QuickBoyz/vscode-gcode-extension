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

import { GCodeCommandInfo } from '../types';

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
    'G187',
    {
      command: 'G187',
      name: 'Accuracy Control',
      description:
        'Haas-specific accuracy control. Adjusts corner rounding and smoothing behavior.',
      group: 'Motion',
      parameters: ['P'],
      example: 'G187 P1',
    },
  ],
  // Standard codes abbreviated for brevity - would include full set in production
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
      group: 'Program Control',
      example: 'M00',
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
    'M95',
    {
      command: 'M95',
      name: 'Sleep',
      description: 'Haas-specific: Wait for external signal before continuing.',
      group: 'Program Control',
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
      group: 'Program Control',
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
      group: 'Program Control',
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
      group: 'Program Control',
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
      group: 'Program Control',
      parameters: ['P'],
      example: 'M99',
    },
  ],
]);
