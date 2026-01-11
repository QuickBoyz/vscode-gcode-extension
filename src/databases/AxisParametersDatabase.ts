/**
 * Axis parameter information for hover tooltips
 */
export interface AxisParameterInfo {
  axis: string;
  name: string;
  description: string;
  units?: string;
}

/**
 * Axis parameter database
 */
export const AXIS_PARAMETER_INFO = new Map<string, AxisParameterInfo>([
  [
    'X',
    {
      axis: 'X',
      name: 'X-Axis',
      description: 'Primary horizontal axis position',
      units: 'mm or inches',
    },
  ],
  [
    'Y',
    {
      axis: 'Y',
      name: 'Y-Axis',
      description: 'Secondary horizontal axis position',
      units: 'mm or inches',
    },
  ],
  [
    'Z',
    {
      axis: 'Z',
      name: 'Z-Axis',
      description: 'Vertical axis position (typically tool depth)',
      units: 'mm or inches',
    },
  ],
  [
    'A',
    {
      axis: 'A',
      name: 'A-Axis',
      description: 'Rotary axis around X (roll)',
      units: 'degrees',
    },
  ],
  [
    'B',
    {
      axis: 'B',
      name: 'B-Axis',
      description: 'Rotary axis around Y (pitch)',
      units: 'degrees',
    },
  ],
  [
    'C',
    {
      axis: 'C',
      name: 'C-Axis',
      description: 'Rotary axis around Z (yaw)',
      units: 'degrees',
    },
  ],
  [
    'I',
    {
      axis: 'I',
      name: 'Arc Center X',
      description: 'Arc center offset from current X position',
      units: 'mm or inches',
    },
  ],
  [
    'J',
    {
      axis: 'J',
      name: 'Arc Center Y',
      description: 'Arc center offset from current Y position',
      units: 'mm or inches',
    },
  ],
  [
    'K',
    {
      axis: 'K',
      name: 'Arc Center Z',
      description: 'Arc center offset from current Z position',
      units: 'mm or inches',
    },
  ],
  [
    'R',
    {
      axis: 'R',
      name: 'Radius',
      description: 'Arc radius or canned cycle retract plane',
      units: 'mm or inches',
    },
  ],
  [
    'F',
    {
      axis: 'F',
      name: 'Feed Rate',
      description: 'Cutting feed rate',
      units: 'mm/min, inches/min, or per-rev',
    },
  ],
  [
    'S',
    {
      axis: 'S',
      name: 'Spindle Speed',
      description: 'Spindle rotation speed',
      units: 'RPM',
    },
  ],
  [
    'T',
    {
      axis: 'T',
      name: 'Tool Number',
      description: 'Tool number for tool change',
      units: 'tool index',
    },
  ],
  [
    'H',
    {
      axis: 'H',
      name: 'Tool Length Offset',
      description: 'Tool length offset register number',
      units: 'offset index',
    },
  ],
  [
    'D',
    {
      axis: 'D',
      name: 'Tool Diameter Offset',
      description: 'Tool diameter/radius offset register number',
      units: 'offset index',
    },
  ],
  [
    'P',
    {
      axis: 'P',
      name: 'Dwell Time / Program Number',
      description: 'Dwell time in seconds or subprogram number',
      units: 'seconds or program number',
    },
  ],
  [
    'Q',
    {
      axis: 'Q',
      name: 'Peck Depth',
      description: 'Incremental depth for peck drilling cycles',
      units: 'mm or inches',
    },
  ],
  [
    'L',
    {
      axis: 'L',
      name: 'Loop Count',
      description: 'Number of times to repeat subprogram',
      units: 'count',
    },
  ],
]);
