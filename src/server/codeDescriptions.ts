/**
 * G-code and M-code descriptions for hover tooltips
 */

import { FuncCall, FunctionType } from "../entities/expressions";
import { Command } from "../entities/statements";

/**
 * Mapping of G-code numbers to their descriptions
 * Based on LinuxCNC documentation: https://linuxcnc.org/docs/html/gcode/g-code.html
 */
export const G_CODE_DESCRIPTIONS: Record<number, string> = {
  // Motion codes
  0: "Coordinated Motion at Rapid Rate",
  1: "Coordinated Motion at Feed Rate",
  2: "Coordinated Helical Motion at Feed Rate (clockwise)",
  3: "Coordinated Helical Motion at Feed Rate (counter-clockwise)",
  4: "Dwell",
  5: "Cubic Spline",
  5.1: "Quadratic B-Spline",
  5.2: "NURBS, add control point",
  5.3: "NURBS, end of block",

  // Lathe modes
  7: "Diameter Mode (lathe)",
  8: "Radius Mode (lathe)",

  // Tool table and coordinate system setting
  // Note: G10 L0, G10 L1, etc. are G10 with L parameter - not separate codes
  10: "Tool Table and Coordinate System Setting (use with L parameter)",

  // Plane selection
  17: "Select XY plane",
  18: "Select XZ plane",
  19: "Select YZ plane",
  19.1: "Select UV plane",

  // Unit selection
  20: "Set Units of Measure to inches",
  21: "Set Units of Measure to millimeters",

  // Predefined positions
  28: "Go to Predefined Position",
  28.1: "Go to Predefined Position (set)",
  30: "Go to Predefined Position",
  30.1: "Go to Predefined Position (set)",

  // Spindle synchronized motion
  33: "Spindle Synchronized Motion",
  33.1: "Rigid Tapping",

  // Probing
  38.2: "Probing toward workpiece, signal error on failure",
  38.3: "Probing toward workpiece, stop on contact",
  38.4: "Probing away from workpiece, signal error on failure",
  38.5: "Probing away from workpiece, stop on contact",

  // Cutter compensation
  40: "Cancel Cutter Compensation",
  41: "Cutter Compensation (left)",
  42: "Cutter Compensation (right)",
  41.1: "Dynamic Cutter Compensation (left)",
  42.1: "Dynamic Cutter Compensation (right)",

  // Tool length compensation
  43: "Use Tool Length Offset from Tool Table",
  43.1: "Dynamic Tool Length Offset",
  43.2: "Apply additional Tool Length Offset",
  49: "Cancel Tool Length Offset",

  // Coordinate systems
  52: "Local Coordinate System Offset",
  53: "Move in Machine Coordinates",
  54: "Select Coordinate System (1)",
  55: "Select Coordinate System (2)",
  56: "Select Coordinate System (3)",
  57: "Select Coordinate System (4)",
  58: "Select Coordinate System (5)",
  59: "Select Coordinate System (6)",
  59.1: "Select Coordinate System (7)",
  59.2: "Select Coordinate System (8)",
  59.3: "Select Coordinate System (9)",

  // Path control modes
  61: "Exact Path Mode",
  61.1: "Exact Stop Mode",
  64: "Path Control Mode with Optional Tolerance",

  // Lathe cycles
  70: "Lathe finishing cycle",
  71: "Lathe roughing cycle",
  72: "Lathe roughing cycle",

  // Canned cycles
  73: "Drilling Cycle with Chip Breaking",
  74: "Left-hand Tapping Cycle with Dwell",
  76: "Multi-pass Threading Cycle (Lathe)",
  80: "Cancel Motion Modes",
  81: "Drilling Cycle",
  82: "Drilling Cycle with Dwell",
  83: "Drilling Cycle with Peck",
  84: "Right-hand Tapping Cycle with Dwell",
  85: "Boring Cycle, No Dwell, Feed Out",
  86: "Boring Cycle, Stop, Rapid Out",
  87: "Back-boring Cycle (not yet implemented)",
  88: "Boring Cycle, Stop, Manual Out (not yet implemented)",
  89: "Boring Cycle, Dwell, Feed Out",

  // Distance modes
  90: "Absolute Distance Mode",
  91: "Incremental Distance Mode",
  90.1: "Absolute Distance Mode for I, J & K offsets",
  91.1: "Incremental Distance Mode for I, J & K offsets",

  // Coordinate system offset
  92: "Coordinate System Offset",
  92.1: "Reset G92 Offsets (erase)",
  92.2: "Reset G92 Offsets (keep stored)",
  92.3: "Restore G92 Offsets",

  // Feed rate modes
  93: "Inverse Time Feed Rate Mode",
  94: "Units per Minute Feed Rate Mode",
  95: "Units per Revolution Feed Rate Mode",

  // Spindle control modes
  96: "Constant Surface Speed Mode",
  97: "RPM Mode",

  // Canned cycle return levels
  98: "Canned Cycle Return to Initial Position",
  99: "Canned Cycle Return to R Position",

  // Scaling (if supported)
  50: "Cancel scaling",
  51: "Scale coordinate system",
};

/**
 * Mapping of M-code numbers to their descriptions
 */
export const M_CODE_DESCRIPTIONS: Record<number, string> = {
  // Program control
  0: "Program stop (optional restart)",
  1: "Optional program stop",
  2: "End of program",
  30: "End of program, rewind to start",

  // Spindle control
  3: "Spindle on (clockwise)",
  4: "Spindle on (counter-clockwise)",
  5: "Spindle stop",
  19: "Spindle orientation",

  // Tool control
  6: "Tool change",
  7: "Mist coolant on",
  8: "Flood coolant on",
  9: "Coolant off",

  // Program flow
  98: "Subprogram call",
  99: "Subprogram return / End of program",

  // Feed rate
  48: "Feed rate override enable",
  49: "Feed rate override disable",
};

/**
 * Get description for a G-code
 */
export function getGCodeDescription(code: number): string | undefined {
  return G_CODE_DESCRIPTIONS[code];
}

/**
 * Get description for an M-code
 */
export function getMCodeDescription(code: number): string | undefined {
  return M_CODE_DESCRIPTIONS[code];
}

/**
 * Mapping of built-in function names to their descriptions
 */
export const FUNCTION_DESCRIPTIONS: Record<FunctionType, string> = {
  // Trigonometric functions
  SIN: "Sine function - returns the sine of an angle in radians",
  COS: "Cosine function - returns the cosine of an angle in radians",
  TAN: "Tangent function - returns the tangent of an angle in radians",
  ASIN: "Arcsine function - returns the angle in radians whose sine is the given value",
  ACOS: "Arccosine function - returns the angle in radians whose cosine is the given value",
  ATAN: "Arctangent function - returns the angle in radians whose tangent is the given value",

  // Rounding functions
  FIX: "Truncate (floor) - rounds down to the nearest integer",
  FUP: "Round up (ceiling) - rounds up to the nearest integer",
  ROUND: "Round - rounds to the nearest integer",

  // Mathematical functions
  LN: "Natural logarithm - returns the natural logarithm (base e) of a number",
  SQRT: "Square root - returns the square root of a number",
  ABS: "Absolute value - returns the absolute value of a number",

  // Comparison functions
  MIN: "Minimum - returns the smaller of two values",
  MAX: "Maximum - returns the larger of two values",

  // Modulo operator/function
  MOD: "Modulo - returns the remainder after division of two numbers",
};

/**
 * Get description for a built-in function
 */
export function getFunctionDescription(
  functionName: FunctionType
): string | undefined {
  return FUNCTION_DESCRIPTIONS[functionName];
}

/**
 * Format a code description for hover display
 */
export function formatCodeDescription(stmt: Command): string {
  const codeText = `${stmt.getType().charAt(0)}${stmt
    .getCode()
    .toString()
    .padStart(2, "0")}`;
  return `**${codeText}:** ${stmt.getDescription()}`;
}

/**
 * Format a function description for hover display
 */
export function formatFunctionDescription(stmt: FuncCall): string {
  return `**${stmt
    .getFunctionName()
    .toUpperCase()}:** ${stmt.getDescription()}`;
}
