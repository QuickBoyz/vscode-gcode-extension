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
    'G05',
    {
      command: 'G05',
      name: 'Cubic Spline',
      description:
        'Cubic B-spline motion. P=0 begins a new spline sequence; I/J are the offsets from the start point to the first control point. P=1 continues a sequence; I/J are the offsets from the end point to the second control point of the previous segment (mirrored tangent). X/Y/Z is the end point.',
      group: CommandGroup.MOTION,
      parameters: ['X', 'Y', 'Z', 'I', 'J', 'P'],
      example: 'G05 P0 I0.5 J0.5 X10.0 Y5.0',
    },
  ],
  [
    'G05.1',
    {
      command: 'G05.1',
      name: 'Quadratic B-Spline',
      description:
        'Quadratic B-spline motion. I/J specify the offset from the current position to the control point. X/Y is the end point. Multiple G5.1 blocks can be chained to form a smooth curve.',
      group: CommandGroup.MOTION,
      parameters: ['X', 'Y', 'I', 'J'],
      example: 'G05.1 I2.0 J1.0 X8.0 Y4.0',
    },
  ],
  [
    'G05.2',
    {
      command: 'G05.2',
      name: 'NURBS Add Control Point',
      description:
        'Adds one NURBS control point. X/Y/Z specify the control point coordinates. P sets the point weight (default 1.0). L sets the curve order (degree + 1, e.g. L3 for quadratic) — specified only on the first G5.2 block. Follow with one or more G5.2 blocks then G5.3 to execute.',
      group: CommandGroup.MOTION,
      parameters: ['X', 'Y', 'Z', 'P', 'L'],
      example: 'G05.2 X5.0 Y3.0 P1.0 L3',
    },
  ],
  [
    'G05.3',
    {
      command: 'G05.3',
      name: 'NURBS Execute',
      description:
        'Executes the NURBS curve defined by the preceding G5.2 control points. No parameters. Must follow at least two G5.2 blocks.',
      group: CommandGroup.MOTION,
      example: 'G05.3',
    },
  ],
  [
    'G07',
    {
      command: 'G07',
      name: 'Diameter Mode',
      description:
        'Lathe-specific: X-axis moves are interpreted as diameter values. The actual slide movement is half the programmed X value. This is the typical mode for lathe turning where dimensions are given as diameters.',
      group: CommandGroup.LATHE,
      example: 'G07',
    },
  ],
  [
    'G08',
    {
      command: 'G08',
      name: 'Radius Mode',
      description:
        'Lathe-specific: X-axis moves are interpreted as radius values (the actual slide distance). This is the default LinuxCNC lathe mode. Use G7 to switch to diameter mode.',
      group: CommandGroup.LATHE,
      example: 'G08',
    },
  ],
  [
    'G10',
    {
      command: 'G10',
      name: 'Coordinate System Setting',
      description:
        'Set or modify coordinate system and tool table data from within the program. The L word selects the operation: L0 reloads the tool table from disk; L1 sets a tool table entry (P=tool, R=radius, I/J=lathe angles, Q=orientation); L2 sets a work coordinate system origin (P=1–9 selects G54–G59.3, X/Y/Z/A/B/C are the new origin values in machine coordinates); L10 sets a tool table entry calculated from current position minus a workpiece measurement; L11 sets a tool table entry calculated from current position minus a fixture measurement; L20 sets a work coordinate system origin relative to the current position.',
      group: CommandGroup.COORDINATE_SYSTEM,
      parameters: ['L', 'P', 'X', 'Y', 'Z', 'A', 'B', 'C', 'R', 'I', 'J', 'Q'],
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
    'G17.1',
    {
      command: 'G17.1',
      name: 'UV Plane',
      description:
        'Select UV plane for circular interpolation on machines with UV axes (e.g. hexapod or XYZUVW configurations).',
      group: CommandGroup.PLANE_SELECTION,
      example: 'G17.1',
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
    'G18.1',
    {
      command: 'G18.1',
      name: 'UW Plane',
      description:
        'Select UW plane for circular interpolation on machines with UW axes (e.g. hexapod or XYZUVW configurations).',
      group: CommandGroup.PLANE_SELECTION,
      example: 'G18.1',
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
    'G19.1',
    {
      command: 'G19.1',
      name: 'VW Plane',
      description:
        'Select VW plane for circular interpolation on machines with VW axes (e.g. hexapod or XYZUVW configurations).',
      group: CommandGroup.PLANE_SELECTION,
      example: 'G19.1',
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
      name: 'Go To Predefined Position 1',
      description:
        'Move to the position stored by G28.1. Any specified axis words are used as an intermediate point — the machine moves there first, then continues to the stored position.',
      group: CommandGroup.MOTION,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C'],
      example: 'G28 Z0.0',
    },
  ],
  [
    'G28.1',
    {
      command: 'G28.1',
      name: 'Set Predefined Position 1',
      description:
        'Store the current machine position as predefined position 1 (used by G28). Specify axis words to store only those axes; omit to store all axes.',
      group: CommandGroup.MOTION,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C'],
      example: 'G28.1',
    },
  ],
  [
    'G30',
    {
      command: 'G30',
      name: 'Go To Predefined Position 2',
      description:
        'Move to the position stored by G30.1. Any specified axis words are used as an intermediate point — the machine moves there first, then continues to the stored position.',
      group: CommandGroup.MOTION,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C'],
      example: 'G30 Z0.0',
    },
  ],
  [
    'G30.1',
    {
      command: 'G30.1',
      name: 'Set Predefined Position 2',
      description:
        'Store the current machine position as predefined position 2 (used by G30). Specify axis words to store only those axes; omit to store all axes.',
      group: CommandGroup.MOTION,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C'],
      example: 'G30.1',
    },
  ],
  [
    'G33',
    {
      command: 'G33',
      name: 'Spindle Synchronized Motion',
      description:
        'Linear motion synchronized with spindle rotation. K specifies the distance traveled per spindle revolution (the thread pitch). The spindle encoder must be connected. Used for single-pass threading on lathes.',
      group: CommandGroup.SPINDLE_SYNC,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C', 'K'],
      example: 'G33 Z-20.0 K1.5',
    },
  ],
  [
    'G33.1',
    {
      command: 'G33.1',
      name: 'Rigid Tapping',
      description:
        'Spindle-synchronized tapping cycle. Moves to the target position at K distance per spindle revolution, then reverses the spindle and retracts at the same rate. K is the thread lead (distance per revolution). Requires a spindle encoder.',
      group: CommandGroup.SPINDLE_SYNC,
      parameters: ['X', 'Y', 'Z', 'K'],
      example: 'G33.1 Z-15.0 K1.25',
    },
  ],
  [
    'G38.2',
    {
      command: 'G38.2',
      name: 'Probe Toward, Error On Failure',
      description:
        'Move toward the target point at the specified feed rate until the probe input triggers. Raises an error if the probe does not trigger before reaching the target. The position at trigger is stored in #5061–#5066.',
      group: CommandGroup.PROBING,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C', 'F'],
      example: 'G38.2 Z-10.0 F50',
    },
  ],
  [
    'G38.3',
    {
      command: 'G38.3',
      name: 'Probe Toward, No Error On Failure',
      description:
        'Move toward the target point at the specified feed rate until the probe input triggers. Does not raise an error if the probe does not trigger. The position at trigger (or final position) is stored in #5061–#5066.',
      group: CommandGroup.PROBING,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C', 'F'],
      example: 'G38.3 Z-10.0 F50',
    },
  ],
  [
    'G38.4',
    {
      command: 'G38.4',
      name: 'Probe Away, Error On Failure',
      description:
        'Move away from the target point until the probe input goes inactive (releases). Raises an error if the probe does not release before reaching the target. The position at release is stored in #5061–#5066.',
      group: CommandGroup.PROBING,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C', 'F'],
      example: 'G38.4 Z10.0 F50',
    },
  ],
  [
    'G38.5',
    {
      command: 'G38.5',
      name: 'Probe Away, No Error On Failure',
      description:
        'Move away from the target point until the probe input goes inactive (releases). Does not raise an error if the probe does not release. The position at release (or final position) is stored in #5061–#5066.',
      group: CommandGroup.PROBING,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C', 'F'],
      example: 'G38.5 Z10.0 F50',
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
      description:
        'Enable cutter radius compensation to the left of the programmed path. The tool radius is taken from the tool table entry for the current tool.',
      group: CommandGroup.CUTTER_COMPENSATION,
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
        'Enable cutter radius compensation to the left of the programmed path with an inline radius. D specifies the radius value directly (not a tool table index). L optionally specifies the tool orientation for lathe use.',
      group: CommandGroup.CUTTER_COMPENSATION,
      parameters: ['D', 'L'],
      example: 'G41.1 D5.0',
    },
  ],
  [
    'G42',
    {
      command: 'G42',
      name: 'Cutter Compensation Right',
      description:
        'Enable cutter radius compensation to the right of the programmed path. The tool radius is taken from the tool table entry for the current tool.',
      group: CommandGroup.CUTTER_COMPENSATION,
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
        'Enable cutter radius compensation to the right of the programmed path with an inline radius. D specifies the radius value directly (not a tool table index). L optionally specifies the tool orientation for lathe use.',
      group: CommandGroup.CUTTER_COMPENSATION,
      parameters: ['D', 'L'],
      example: 'G42.1 D5.0',
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
    'G43.1',
    {
      command: 'G43.1',
      name: 'Dynamic Tool Length Offset',
      description:
        'Apply a tool length offset specified inline rather than from the tool table. The Z word (and optionally other axes) specifies the offset value directly. Useful for on-the-fly length compensation without modifying the tool table.',
      group: CommandGroup.TOOL_LENGTH_OFFSET,
      parameters: ['Z'],
      example: 'G43.1 Z25.4',
    },
  ],
  [
    'G43.2',
    {
      command: 'G43.2',
      name: 'Additional Tool Length Offset',
      description:
        'Apply an additional tool length offset on top of the currently active offset. H specifies the tool table index whose length is added to the current compensation. Allows stacking multiple offsets (e.g. tool length + fixture height).',
      group: CommandGroup.TOOL_LENGTH_OFFSET,
      parameters: ['H'],
      example: 'G43.2 H02',
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
    'G52',
    {
      command: 'G52',
      name: 'Local Coordinate Offset',
      description:
        'Set a local coordinate offset within the current work coordinate system. All specified axis values shift the origin of the current WCS by that amount. G52 X0 Y0 Z0 cancels the offset. The offset is not saved to the parameter file.',
      group: CommandGroup.COORDINATE_SYSTEM,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C'],
      example: 'G52 X10.0 Y5.0',
    },
  ],
  [
    'G53',
    {
      command: 'G53',
      name: 'Machine Coordinates',
      description:
        'Non-modal: move in machine coordinates for the current block only, ignoring any active work coordinate system offset. Must be used on the same line as G00 or G01. Returns to the active WCS on the next block.',
      group: CommandGroup.COORDINATE_SYSTEM,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C'],
      example: 'G53 G00 X0 Y0 Z0',
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
    'G59.1',
    {
      command: 'G59.1',
      name: 'Work Coordinate System 7',
      description: 'Select work coordinate system 7 (offset from machine coordinates).',
      group: CommandGroup.COORDINATE_SYSTEM,
      example: 'G59.1',
    },
  ],
  [
    'G59.2',
    {
      command: 'G59.2',
      name: 'Work Coordinate System 8',
      description: 'Select work coordinate system 8 (offset from machine coordinates).',
      group: CommandGroup.COORDINATE_SYSTEM,
      example: 'G59.2',
    },
  ],
  [
    'G59.3',
    {
      command: 'G59.3',
      name: 'Work Coordinate System 9',
      description: 'Select work coordinate system 9 (offset from machine coordinates).',
      group: CommandGroup.COORDINATE_SYSTEM,
      example: 'G59.3',
    },
  ],
  [
    'G61',
    {
      command: 'G61',
      name: 'Exact Path Mode',
      description:
        'Enable exact path mode. The controller follows the programmed path precisely, decelerating at corners as needed to stay on the exact path. Produces the most accurate path but slowest feed at direction changes.',
      group: CommandGroup.PATH_CONTROL,
      example: 'G61',
    },
  ],
  [
    'G61.1',
    {
      command: 'G61.1',
      name: 'Exact Stop Mode',
      description:
        'Enable exact stop mode. The controller comes to a complete stop at the end of each block before starting the next move. Produces very sharp corners but is the slowest path control mode.',
      group: CommandGroup.PATH_CONTROL,
      example: 'G61.1',
    },
  ],
  [
    'G64',
    {
      command: 'G64',
      name: 'Path Blending',
      description:
        'Enable path blending (continuous path) mode. The controller blends motion between blocks to maintain feed rate. P sets the maximum path deviation tolerance; Q sets the naive cam detector tolerance for colinear segment merging. Omitting P applies blending with no tolerance limit.',
      group: CommandGroup.PATH_CONTROL,
      parameters: ['P', 'Q'],
      example: 'G64 P0.01 Q0.005',
    },
  ],
  [
    'G70',
    {
      command: 'G70',
      name: 'Finishing Cycle',
      description:
        'Lathe-specific: Finishing pass cycle. P specifies the line number of the first block of the profile definition and Q the last block. The tool follows the profile contour at the current feed rate without roughing passes. Used after G71 or G72 roughing cycles.',
      group: CommandGroup.LATHE_CYCLE,
      parameters: ['P', 'Q'],
      example: 'G70 P100 Q200',
    },
  ],
  [
    'G71',
    {
      command: 'G71',
      name: 'Rough Turning Cycle',
      description:
        'Lathe-specific: Longitudinal roughing cycle. P and Q specify the line numbers bounding the profile definition. D is the depth of cut per pass. U is the finishing allowance in X (diameter). W is the finishing allowance in Z. F is the feed rate.',
      group: CommandGroup.LATHE_CYCLE,
      parameters: ['P', 'Q', 'D', 'U', 'W', 'F'],
      example: 'G71 P100 Q200 D2.0 U0.5 W0.2 F0.2',
    },
  ],
  [
    'G72',
    {
      command: 'G72',
      name: 'Facing Cycle',
      description:
        'Lathe-specific: Facing roughing cycle (cuts parallel to the X axis). P and Q specify the line numbers bounding the profile definition. D is the depth of cut per pass. U is the finishing allowance in X. W is the finishing allowance in Z. F is the feed rate.',
      group: CommandGroup.LATHE_CYCLE,
      parameters: ['P', 'Q', 'D', 'U', 'W', 'F'],
      example: 'G72 P100 Q200 D1.0 U0.2 W0.2 F0.15',
    },
  ],
  [
    'G73',
    {
      command: 'G73',
      name: 'Chip Break Drilling',
      description:
        'Peck drilling cycle with chip breaking. Drills to each Q peck depth, retracts slightly (does not fully retract to R) to break chips, then continues drilling. Faster than G83 for materials that chip well.',
      group: CommandGroup.CANNED_CYCLE,
      parameters: ['X', 'Y', 'Z', 'R', 'Q', 'F'],
      example: 'G73 X10.0 Y20.0 Z-20.0 R2.0 Q3.0 F100',
    },
  ],
  [
    'G74',
    {
      command: 'G74',
      name: 'Left-Hand Tapping',
      description:
        'Left-hand (counter-clockwise) tapping cycle. The spindle runs counter-clockwise to cut left-hand threads. Feeds to depth at F, reverses spindle clockwise, and retracts. R is the reference plane. Q is optional peck depth.',
      group: CommandGroup.CANNED_CYCLE,
      parameters: ['X', 'Y', 'Z', 'R', 'Q', 'F'],
      example: 'G74 X10.0 Y20.0 Z-15.0 R2.0 F50',
    },
  ],
  [
    'G76',
    {
      command: 'G76',
      name: 'Threading Cycle',
      description:
        'Lathe-specific: Multi-pass threading cycle. P is the thread pitch (distance per revolution). Z is the final thread depth (end Z). I is the thread taper (difference in radius from start to end; 0 for straight thread). J is the first pass cut depth. K is the total thread depth (cut until this depth is reached). Optional: R controls depth degression (1.0=constant depth, default), Q sets the compound angle, H sets the number of spring passes, E sets the end taper length, L sets spring-pass direction.',
      group: CommandGroup.LATHE_CYCLE,
      parameters: ['P', 'Z', 'I', 'J', 'K', 'R', 'Q', 'H', 'E', 'L'],
      example: 'G76 P1.5 Z-20.0 I0 J0.2 K0.9',
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
      name: 'Drilling Cycle With Dwell',
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
      description:
        'Deep hole drilling cycle with chip breaking. Fully retracts to R between pecks.',
      group: CommandGroup.CANNED_CYCLE,
      parameters: ['X', 'Y', 'Z', 'R', 'Q', 'F'],
      example: 'G83 X10.0 Y20.0 Z-20.0 R2.0 Q2.0 F100',
    },
  ],
  [
    'G84',
    {
      command: 'G84',
      name: 'Right-Hand Tapping',
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
      name: 'Boring Cycle Feed Out',
      description: 'Boring cycle: feeds in to depth and feeds back out at the same rate.',
      group: CommandGroup.CANNED_CYCLE,
      parameters: ['X', 'Y', 'Z', 'R', 'F'],
      example: 'G85 X10.0 Y20.0 Z-10.0 R2.0 F80',
    },
  ],
  [
    'G86',
    {
      command: 'G86',
      name: 'Boring Cycle Stop Rapid Out',
      description: 'Boring cycle: feeds in to depth, stops spindle, then rapids out.',
      group: CommandGroup.CANNED_CYCLE,
      parameters: ['X', 'Y', 'Z', 'R', 'F'],
      example: 'G86 X10.0 Y20.0 Z-10.0 R2.0 F80',
    },
  ],
  [
    'G87',
    {
      command: 'G87',
      name: 'Back Boring',
      description:
        'Back boring cycle. Not implemented in LinuxCNC — the block is accepted but produces no motion.',
      group: CommandGroup.CANNED_CYCLE,
      parameters: ['X', 'Y', 'Z', 'R', 'I', 'J', 'F'],
      example: 'G87 X10.0 Y20.0 Z-10.0 R2.0 F80',
    },
  ],
  [
    'G88',
    {
      command: 'G88',
      name: 'Boring Cycle Manual Out',
      description:
        'Boring cycle with spindle stop and manual retract. Not implemented in LinuxCNC — the block is accepted but produces no motion.',
      group: CommandGroup.CANNED_CYCLE,
      parameters: ['X', 'Y', 'Z', 'R', 'P', 'F'],
      example: 'G88 X10.0 Y20.0 Z-10.0 R2.0 P2.0 F80',
    },
  ],
  [
    'G89',
    {
      command: 'G89',
      name: 'Boring Cycle Dwell Feed Out',
      description: 'Boring cycle with dwell at bottom, then feeds back out.',
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
      description: 'Coordinate values are absolute positions from the active work zero.',
      group: CommandGroup.DISTANCE_MODE,
      parameters: [],
    },
  ],
  [
    'G90.1',
    {
      command: 'G90.1',
      name: 'Absolute Arc Centers',
      description:
        'Arc center offsets (I, J, K) are interpreted as absolute coordinates in the current work coordinate system. Affects G02/G03 arc definitions.',
      group: CommandGroup.ARC_MODE,
      example: 'G90.1',
    },
  ],
  [
    'G91',
    {
      command: 'G91',
      name: 'Incremental Distance Mode',
      description: 'Coordinate values are relative to the current position.',
      group: CommandGroup.DISTANCE_MODE,
      parameters: [],
    },
  ],
  [
    'G91.1',
    {
      command: 'G91.1',
      name: 'Incremental Arc Centers',
      description:
        'Arc center offsets (I, J, K) are interpreted as incremental distances from the arc start point. This is the default LinuxCNC behavior. Affects G02/G03 arc definitions.',
      group: CommandGroup.ARC_MODE,
      example: 'G91.1',
    },
  ],
  [
    'G92',
    {
      command: 'G92',
      name: 'Coordinate Offset',
      description:
        'Set the current position to the specified coordinate values by shifting the active work coordinate system. The offset is saved to the parameter file and persists across restarts.',
      group: CommandGroup.COORDINATE_SYSTEM,
      parameters: ['X', 'Y', 'Z', 'A', 'B', 'C'],
      example: 'G92 X0 Y0 Z0',
    },
  ],
  [
    'G92.1',
    {
      command: 'G92.1',
      name: 'Clear G92 Offset',
      description:
        'Reset all G92 offsets to zero and clear the saved offset from the parameter file.',
      group: CommandGroup.COORDINATE_SYSTEM,
      example: 'G92.1',
    },
  ],
  [
    'G92.2',
    {
      command: 'G92.2',
      name: 'Suspend G92 Offset',
      description:
        'Suspend (disable) the G92 offset without clearing it from the parameter file. The offset can be restored with G92.3.',
      group: CommandGroup.COORDINATE_SYSTEM,
      example: 'G92.2',
    },
  ],
  [
    'G92.3',
    {
      command: 'G92.3',
      name: 'Restore G92 Offset',
      description:
        'Restore the G92 offset that was previously saved to the parameter file (either by G92 or left over from a suspended session).',
      group: CommandGroup.COORDINATE_SYSTEM,
      example: 'G92.3',
    },
  ],
  [
    'G93',
    {
      command: 'G93',
      name: 'Inverse Time Feed',
      description:
        'Feed rate mode where the F word means "complete this move in 1/F minutes". A higher F value produces a faster move. Must specify a new F on every motion block while G93 is active.',
      group: CommandGroup.FEED_RATE_MODE,
      example: 'G93',
    },
  ],
  [
    'G94',
    {
      command: 'G94',
      name: 'Units Per Minute Feed',
      description: 'Feed rate is in units (inches or mm) per minute. This is the default mode.',
      group: CommandGroup.FEED_RATE_MODE,
      parameters: [],
    },
  ],
  [
    'G95',
    {
      command: 'G95',
      name: 'Units Per Revolution Feed',
      description: 'Feed rate is in units per spindle revolution. Requires a spindle encoder.',
      group: CommandGroup.FEED_RATE_MODE,
      parameters: [],
    },
  ],
  [
    'G96',
    {
      command: 'G96',
      name: 'Constant Surface Speed',
      description:
        'Lathe-specific: Spindle speed is controlled to maintain a constant surface speed. S specifies the surface speed (feet/min in inch mode, m/min in metric mode). D optionally sets the maximum spindle RPM.',
      group: CommandGroup.SPINDLE_MODE,
      parameters: ['S', 'D'],
      example: 'G96 S200 D3000',
    },
  ],
  [
    'G97',
    {
      command: 'G97',
      name: 'Constant RPM',
      description:
        'Spindle speed is a fixed RPM regardless of position. This is the default spindle mode. S specifies the spindle speed in revolutions per minute.',
      group: CommandGroup.SPINDLE_MODE,
      parameters: ['S'],
      example: 'G97 S1500',
    },
  ],
  [
    'G98',
    {
      command: 'G98',
      name: 'Return To Initial Level',
      description: 'Canned cycle returns to the initial Z level (the Z height before the cycle).',
      group: CommandGroup.CANNED_CYCLE,
      parameters: [],
    },
  ],
  [
    'G99',
    {
      command: 'G99',
      name: 'Return To R Plane',
      description: 'Canned cycle returns to the R plane (retract level) between holes.',
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
      description: 'Start spindle rotation clockwise (viewed from spindle nose).',
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
      description: 'Start spindle rotation counter-clockwise (viewed from spindle nose).',
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
    'M19',
    {
      command: 'M19',
      name: 'Orient Spindle',
      description:
        'Orient the spindle to a defined angular position. The target angle and speed are configured in the HAL/INI rather than passed as parameters. Used before tool changes on machines with spindle orientation hardware.',
      group: CommandGroup.SPINDLE_CONTROL,
      example: 'M19',
    },
  ],
  [
    'M30',
    {
      command: 'M30',
      name: 'Program End And Rewind',
      description: 'End of program. Stops spindle, coolant, and rewinds the program to the start.',
      group: CommandGroup.PROGRAM_CONTROL,
      parameters: [],
    },
  ],
  [
    'M48',
    {
      command: 'M48',
      name: 'Enable Overrides',
      description:
        'Re-enable feed rate and spindle speed overrides after they were disabled by M49. Both override controls are restored to the positions set by the operator.',
      group: CommandGroup.OVERRIDES,
      example: 'M48',
    },
  ],
  [
    'M49',
    {
      command: 'M49',
      name: 'Disable Overrides',
      description:
        'Disable the feed rate and spindle speed override controls. Overrides are locked at 100% regardless of the operator control positions. Use M48 to re-enable.',
      group: CommandGroup.OVERRIDES,
      example: 'M49',
    },
  ],
  [
    'M50',
    {
      command: 'M50',
      name: 'Feed Override Control',
      description:
        'Enable or disable the feed rate override control independently. P1 enables (default); P0 disables and locks feed rate at 100%.',
      group: CommandGroup.OVERRIDES,
      parameters: ['P'],
      example: 'M50 P0',
    },
  ],
  [
    'M51',
    {
      command: 'M51',
      name: 'Spindle Override Control',
      description:
        'Enable or disable the spindle speed override control independently. P1 enables (default); P0 disables and locks spindle speed at 100%.',
      group: CommandGroup.OVERRIDES,
      parameters: ['P'],
      example: 'M51 P0',
    },
  ],
  [
    'M52',
    {
      command: 'M52',
      name: 'Adaptive Feed Control',
      description:
        'Enable or disable the adaptive feed input. P1 enables adaptive feed (HAL pin motion.adaptive-feed scales the feed rate); P0 disables adaptive feed.',
      group: CommandGroup.OVERRIDES,
      parameters: ['P'],
      example: 'M52 P1',
    },
  ],
  [
    'M53',
    {
      command: 'M53',
      name: 'Feed Hold Control',
      description:
        'Enable or disable the feed hold input. P1 enables feed hold (the HAL pin motion.feed-hold can pause motion); P0 disables the feed hold input.',
      group: CommandGroup.OVERRIDES,
      parameters: ['P'],
      example: 'M53 P1',
    },
  ],
  [
    'M60',
    {
      command: 'M60',
      name: 'Pallet Change Pause',
      description:
        'Pause program execution for a pallet change. Like M00 but intended for automatic pallet changers. Requires operator (or APC) action to resume.',
      group: CommandGroup.PROGRAM_CONTROL,
      example: 'M60',
    },
  ],
  [
    'M61',
    {
      command: 'M61',
      name: 'Set Current Tool',
      description:
        'Set the current tool number without performing a tool change. Q specifies the tool number. Useful for synchronizing LinuxCNC tool state with a manually loaded tool.',
      group: CommandGroup.TOOL_CONTROL,
      parameters: ['Q'],
      example: 'M61 Q3',
    },
  ],
  [
    'M62',
    {
      command: 'M62',
      name: 'Digital Output On Synchronized',
      description:
        'Turn a digital output on, synchronized with the start of the next motion. P specifies the output pin number (0-based). The output change is queued and applied when the next motion begins.',
      group: CommandGroup.IO,
      parameters: ['P'],
      example: 'M62 P0',
    },
  ],
  [
    'M63',
    {
      command: 'M63',
      name: 'Digital Output Off Synchronized',
      description:
        'Turn a digital output off, synchronized with the start of the next motion. P specifies the output pin number (0-based). The output change is queued and applied when the next motion begins.',
      group: CommandGroup.IO,
      parameters: ['P'],
      example: 'M63 P0',
    },
  ],
  [
    'M64',
    {
      command: 'M64',
      name: 'Digital Output On Immediate',
      description:
        'Turn a digital output on immediately, without waiting for motion sync. P specifies the output pin number (0-based). Takes effect as soon as the interpreter reads this block.',
      group: CommandGroup.IO,
      parameters: ['P'],
      example: 'M64 P1',
    },
  ],
  [
    'M65',
    {
      command: 'M65',
      name: 'Digital Output Off Immediate',
      description:
        'Turn a digital output off immediately, without waiting for motion sync. P specifies the output pin number (0-based). Takes effect as soon as the interpreter reads this block.',
      group: CommandGroup.IO,
      parameters: ['P'],
      example: 'M65 P1',
    },
  ],
  [
    'M66',
    {
      command: 'M66',
      name: 'Wait On Input',
      description:
        'Wait for a digital or analog input to reach a specified state. P selects a digital input pin; E selects an analog input channel. L sets the wait mode: 0=immediate read (no wait), 1=wait for rising edge, 2=wait for falling edge, 3=wait for high, 4=wait for low. Q sets the timeout in seconds; 0 waits indefinitely.',
      group: CommandGroup.IO,
      parameters: ['P', 'E', 'L', 'Q'],
      example: 'M66 P0 L3 Q5.0',
    },
  ],
  [
    'M67',
    {
      command: 'M67',
      name: 'Analog Output Synchronized',
      description:
        'Set an analog output value, synchronized with the start of the next motion. E specifies the output channel number (0-based). Q specifies the value to set.',
      group: CommandGroup.IO,
      parameters: ['E', 'Q'],
      example: 'M67 E0 Q7.5',
    },
  ],
  [
    'M68',
    {
      command: 'M68',
      name: 'Analog Output Immediate',
      description:
        'Set an analog output value immediately, without waiting for motion sync. E specifies the output channel number (0-based). Q specifies the value to set.',
      group: CommandGroup.IO,
      parameters: ['E', 'Q'],
      example: 'M68 E0 Q3.2',
    },
  ],
  [
    'M70',
    {
      command: 'M70',
      name: 'Save Modal State',
      description:
        'Save the current modal state (active G/M codes and settings) to an internal stack. The saved state can be restored with M72. Used at the start of subroutines to preserve caller state.',
      group: CommandGroup.STATE,
      example: 'M70',
    },
  ],
  [
    'M71',
    {
      command: 'M71',
      name: 'Invalidate Saved State',
      description:
        'Invalidate (discard) the modal state previously saved by M70. After M71, an M72 restore will have no effect. Used to prevent accidental state restoration.',
      group: CommandGroup.STATE,
      example: 'M71',
    },
  ],
  [
    'M72',
    {
      command: 'M72',
      name: 'Restore Modal State',
      description:
        'Restore the modal state previously saved by M70. Active G/M codes and settings are reset to the values at the time of the M70 call. Used at the end of subroutines to restore caller state.',
      group: CommandGroup.STATE,
      example: 'M72',
    },
  ],
  [
    'M73',
    {
      command: 'M73',
      name: 'Save And Auto-Restore Modal State',
      description:
        'Save the current modal state and automatically restore it when the current subroutine returns (on ENDSUB or RETURN). Equivalent to M70 at the start plus M72 on every exit path.',
      group: CommandGroup.STATE,
      example: 'M73',
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
