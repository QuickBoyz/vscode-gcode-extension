import * as fs from 'fs';
import * as path from 'path';
import { GCodeLexer } from '../lexer/GCodeLexer';
import { LinuxCNCParser } from '../parser/dialects/LinuxCNCParser';
import { GCodePathExtractor } from '../visualizer/GCodePathExtractor';
import { MotionType, ToolPathData } from '../visualizer/types';
import { VariableEnvironment } from '../visualizer/VariableEnvironment';

describe('GCodePathExtractor', () => {
  /**
   * Helper: tokenise, parse, and extract path data from a G-code string.
   */
  function extract(input: string): ToolPathData {
    const lexer = new GCodeLexer();
    const tokens = lexer.tokenize(input);
    const parser = new LinuxCNCParser(tokens, input);
    const ast = parser.parseProgram();
    const extractor = new GCodePathExtractor();
    return extractor.extract(ast);
  }

  // ---------------------------------------------------------------------------
  // Basic extraction
  // ---------------------------------------------------------------------------

  it('returns empty segments for an empty file', () => {
    const data = extract('');
    expect(data.segments).toHaveLength(0);
  });

  it('returns empty segments for comments only', () => {
    const data = extract('; just a comment\n(another comment)');
    expect(data.segments).toHaveLength(0);
  });

  it('extracts a single linear feed move (G1)', () => {
    const data = extract('G1 X10 Y20');
    expect(data.segments).toHaveLength(1);
    expect(data.segments[0].type).toBe(MotionType.FEED);
    expect(data.segments[0].points[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(data.segments[0].points[1]).toEqual({ x: 10, y: 20, z: 0 });
  });

  it('extracts a single rapid move (G0)', () => {
    const data = extract('G0 X5 Y5 Z5');
    expect(data.segments).toHaveLength(1);
    expect(data.segments[0].type).toBe(MotionType.RAPID);
    expect(data.segments[0].points[1]).toEqual({ x: 5, y: 5, z: 5 });
  });

  it('handles G00 and G01 (zero-padded) command names', () => {
    const data = extract('G00 X1\nG01 X2');
    expect(data.segments[0].type).toBe(MotionType.RAPID);
    expect(data.segments[1].type).toBe(MotionType.FEED);
  });

  // ---------------------------------------------------------------------------
  // Position tracking
  // ---------------------------------------------------------------------------

  it('tracks position across consecutive moves', () => {
    const data = extract('G1 X10 Y0\nG1 X10 Y20\nG1 X0 Y20');
    expect(data.segments).toHaveLength(3);
    expect(data.segments[0].points[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(data.segments[0].points[1]).toEqual({ x: 10, y: 0, z: 0 });
    expect(data.segments[1].points[0]).toEqual({ x: 10, y: 0, z: 0 });
    expect(data.segments[1].points[1]).toEqual({ x: 10, y: 20, z: 0 });
    expect(data.segments[2].points[0]).toEqual({ x: 10, y: 20, z: 0 });
    expect(data.segments[2].points[1]).toEqual({ x: 0, y: 20, z: 0 });
  });

  it('preserves Z across moves that do not mention Z', () => {
    const data = extract('G0 X0 Y0 Z5\nG1 X10 Y0');
    expect(data.segments[1].points[1]).toEqual({ x: 10, y: 0, z: 5 });
  });

  // ---------------------------------------------------------------------------
  // Absolute / incremental mode
  // ---------------------------------------------------------------------------

  it('handles G91 incremental mode', () => {
    const data = extract('G91\nG1 X10\nG1 X5');
    expect(data.segments[0].points[1]).toEqual({ x: 10, y: 0, z: 0 });
    expect(data.segments[1].points[0]).toEqual({ x: 10, y: 0, z: 0 });
    expect(data.segments[1].points[1]).toEqual({ x: 15, y: 0, z: 0 });
  });

  it('switches back to G90 absolute mode', () => {
    const data = extract('G91\nG1 X10\nG90\nG1 X20');
    // Incremental: 0 → 10
    expect(data.segments[0].points[1]).toEqual({ x: 10, y: 0, z: 0 });
    // Absolute: → 20 (not 10+20)
    expect(data.segments[1].points[1]).toEqual({ x: 20, y: 0, z: 0 });
  });

  // ---------------------------------------------------------------------------
  // Arc moves
  // ---------------------------------------------------------------------------

  it('classifies G2 as ARC_CW', () => {
    const data = extract('G2 X10 Y0 I5 J0');
    expect(data.segments).toHaveLength(1);
    expect(data.segments[0].type).toBe(MotionType.ARC_CW);
  });

  it('classifies G3 as ARC_CCW', () => {
    const data = extract('G3 X10 Y0 I5 J0');
    expect(data.segments[0].type).toBe(MotionType.ARC_CCW);
  });

  it('produces multiple points for an arc', () => {
    const data = extract('G2 X10 Y0 I5 J0');
    // Arc should have more than 2 points (interpolated)
    expect(data.segments[0].points.length).toBeGreaterThan(2);
  });

  it('arc first point equals current position', () => {
    const data = extract('G1 X5 Y0\nG2 X10 Y0 I2.5 J0');
    const arcSeg = data.segments[1];
    expect(arcSeg.points[0]).toEqual({ x: 5, y: 0, z: 0 });
  });

  it('handles arc with zero radius gracefully', () => {
    const data = extract('G2 X0 Y0 I0 J0');
    expect(data.segments).toHaveLength(1);
    // Zero radius -> should produce start+end points only
    expect(data.segments[0].points.length).toBeLessThanOrEqual(2);
  });

  it('handles arc with missing I/J (defaults to 0)', () => {
    const data = extract('G2 X10 Y0');
    expect(data.segments).toHaveLength(1);
  });

  it('handles multiple arcs in sequence', () => {
    const data = extract('G2 X10 Y0 I5 J0\nG3 X0 Y0 I-5 J0');
    expect(data.segments).toHaveLength(2);
    expect(data.segments[0].type).toBe(MotionType.ARC_CW);
    expect(data.segments[1].type).toBe(MotionType.ARC_CCW);
    // Both arcs should have interpolated points
    expect(data.segments[0].points.length).toBeGreaterThan(2);
    expect(data.segments[1].points.length).toBeGreaterThan(2);
  });

  it('handles full circle arc (start == end with non-zero I/J)', () => {
    // Full circle: start and end are the same point, centre offset by I
    const data = extract('G1 X10 Y0\nG2 X10 Y0 I-5 J0');
    const arcSeg = data.segments[1];
    expect(arcSeg.type).toBe(MotionType.ARC_CW);
    // Full circle should produce many interpolated points
    expect(arcSeg.points.length).toBeGreaterThan(10);
    // First and last points should be the same (start == end)
    const first = arcSeg.points[0];
    const last = arcSeg.points[arcSeg.points.length - 1];
    expect(first.x).toBeCloseTo(last.x, 5);
    expect(first.y).toBeCloseTo(last.y, 5);
  });

  // ---------------------------------------------------------------------------
  // Negative axis values
  // ---------------------------------------------------------------------------

  it('handles negative axis values with unary minus', () => {
    const data = extract('G1 X-10 Y-20 Z-5');
    expect(data.segments).toHaveLength(1);
    expect(data.segments[0].points[1]).toEqual({ x: -10, y: -20, z: -5 });
  });

  // ---------------------------------------------------------------------------
  // Non-motion commands are ignored
  // ---------------------------------------------------------------------------

  it('ignores M-codes, S, F, T parameters', () => {
    const data = extract('M3 S1000\nF100\nT1\nM30');
    expect(data.segments).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Bounding box
  // ---------------------------------------------------------------------------

  it('computes correct bounding box', () => {
    const data = extract('G1 X10 Y20 Z5\nG1 X-5 Y0 Z0');
    expect(data.bounds.min).toEqual({ x: -5, y: 0, z: 0 });
    expect(data.bounds.max).toEqual({ x: 10, y: 20, z: 5 });
  });

  it('returns zero bounds for empty path', () => {
    const data = extract('');
    expect(data.bounds.min).toEqual({ x: 0, y: 0, z: 0 });
    expect(data.bounds.max).toEqual({ x: 0, y: 0, z: 0 });
  });

  // ---------------------------------------------------------------------------
  // Real-world-style program
  // ---------------------------------------------------------------------------

  it('handles a realistic multi-command program', () => {
    const program = `
G90
G0 X0 Y0 Z5
G1 Z-1 F100
G1 X50 Y0 F200
G1 X50 Y50
G1 X0 Y50
G1 X0 Y0
G0 Z5
M30
    `;
    const data = extract(program);
    expect(data.segments.length).toBeGreaterThanOrEqual(7);
    // Rapid moves should be RAPID type
    const rapidSegs = data.segments.filter((s) => s.type === MotionType.RAPID);
    expect(rapidSegs.length).toBeGreaterThanOrEqual(2);
  });

  // ---------------------------------------------------------------------------
  // Variable and expression resolution
  // ---------------------------------------------------------------------------

  it('resolves named variables in axis values', () => {
    const data = extract('#<xpos> = 50\nG1 X#<xpos> Y20');
    expect(data.segments).toHaveLength(1);
    expect(data.segments[0].points[1]).toEqual({ x: 50, y: 20, z: 0 });
  });

  it('evaluates arithmetic in variable assignments', () => {
    const data = extract('#<base> = 10\n#<offset> = [#<base> + 5]\nG1 X#<offset>');
    expect(data.segments).toHaveLength(1);
    expect(data.segments[0].points[1]).toEqual({ x: 15, y: 0, z: 0 });
  });

  it('resolves numbered variables', () => {
    const data = extract('#100 = 30\nG1 X#100');
    expect(data.segments).toHaveLength(1);
    expect(data.segments[0].points[1]).toEqual({ x: 30, y: 0, z: 0 });
  });

  it('evaluates expressions in axis parameters', () => {
    const data = extract('#<base> = 100\nG1 X[#<base> - 50] Y[#<base> * 2]');
    expect(data.segments).toHaveLength(1);
    expect(data.segments[0].points[1]).toEqual({ x: 50, y: 200, z: 0 });
  });

  // ---------------------------------------------------------------------------
  // WHILE loops
  // ---------------------------------------------------------------------------

  it('iterates WHILE loops', () => {
    const program = `
#<i> = 0
O100 WHILE [#<i> LT 3]
  G1 X#<i>
  #<i> = [#<i> + 1]
O100 ENDWHILE
    `;
    const data = extract(program);
    expect(data.segments).toHaveLength(3);
  });

  it('handles nested WHILE loops', () => {
    const program = `
#<row> = 0
O100 WHILE [#<row> LT 2]
  #<col> = 0
  O200 WHILE [#<col> LT 2]
    G1 X#<col> Y#<row>
    #<col> = [#<col> + 1]
  O200 ENDWHILE
  #<row> = [#<row> + 1]
O100 ENDWHILE
    `;
    const data = extract(program);
    // 2 rows x 2 cols = 4 motion commands
    expect(data.segments).toHaveLength(4);
  });

  // ---------------------------------------------------------------------------
  // IF/ELSE branching
  // ---------------------------------------------------------------------------

  it('handles IF/ELSE branching', () => {
    const program = `
#<flag> = 1
O100 IF [#<flag> EQ 1]
  G1 X10
O100 ELSE
  G1 X20
O100 ENDIF
    `;
    const data = extract(program);
    expect(data.segments).toHaveLength(1);
    expect(data.segments[0].points[1].x).toBe(10);
  });

  it('takes ELSE branch when IF condition is false', () => {
    const program = `
#<flag> = 0
O100 IF [#<flag> EQ 1]
  G1 X10
O100 ELSE
  G1 X20
O100 ENDIF
    `;
    const data = extract(program);
    expect(data.segments).toHaveLength(1);
    expect(data.segments[0].points[1].x).toBe(20);
  });

  // ---------------------------------------------------------------------------
  // Modal G-code (standalone axis parameters reuse last motion command)
  // ---------------------------------------------------------------------------

  it('handles modal G01 with standalone axis parameters', () => {
    const data = extract('G01 X10 Y20 F1000\nX15 Y25\nX20 Y30');
    expect(data.segments).toHaveLength(3);
    expect(data.segments[0].type).toBe(MotionType.FEED);
    expect(data.segments[1].type).toBe(MotionType.FEED);
    expect(data.segments[2].type).toBe(MotionType.FEED);
    expect(data.segments[0].points[1]).toEqual({ x: 10, y: 20, z: 0 });
    expect(data.segments[1].points[1]).toEqual({ x: 15, y: 25, z: 0 });
    expect(data.segments[2].points[1]).toEqual({ x: 20, y: 30, z: 0 });
  });

  it('handles modal G00 with standalone axis parameters', () => {
    const data = extract('G00 X5 Y5\nX10 Y10\nX15 Y15');
    expect(data.segments).toHaveLength(3);
    expect(data.segments[0].type).toBe(MotionType.RAPID);
    expect(data.segments[1].type).toBe(MotionType.RAPID);
    expect(data.segments[2].type).toBe(MotionType.RAPID);
  });

  it('switches modal command when a new G-code is issued', () => {
    const data = extract('G00 X5 Y5\nX10 Y10\nG01 X20 Y20 F500\nX25 Y25');
    expect(data.segments).toHaveLength(4);
    expect(data.segments[0].type).toBe(MotionType.RAPID);
    expect(data.segments[1].type).toBe(MotionType.RAPID);
    expect(data.segments[2].type).toBe(MotionType.FEED);
    expect(data.segments[3].type).toBe(MotionType.FEED);
  });

  it('ignores standalone axis parameters before any motion command', () => {
    const data = extract('X10 Y20\nG01 X30 Y40');
    // Only the G01 move should produce a segment
    expect(data.segments).toHaveLength(1);
    expect(data.segments[0].points[1]).toEqual({ x: 30, y: 40, z: 0 });
  });

  it('handles CAM-style program with modal moves and Z plunges', () => {
    const program = `
G90
G00 X0 Y0 Z10
X7.57 Y7.57
G01 Z-3 F500
X7.512 Y7.63 F1000
X7.455 Y7.691
X7.4 Y7.754
G00 Z10
X0 Y0
    `;
    const data = extract(program);
    // G00 X0 Y0 Z10 (1), X7.57 Y7.57 (2), G01 Z-3 (3),
    // X7.512... (4), X7.455... (5), X7.4... (6), G00 Z10 (7), X0 Y0 (8)
    expect(data.segments).toHaveLength(8);
    // First two are rapid
    expect(data.segments[0].type).toBe(MotionType.RAPID);
    expect(data.segments[1].type).toBe(MotionType.RAPID);
    // Then feed moves
    expect(data.segments[2].type).toBe(MotionType.FEED);
    expect(data.segments[3].type).toBe(MotionType.FEED);
    expect(data.segments[4].type).toBe(MotionType.FEED);
    expect(data.segments[5].type).toBe(MotionType.FEED);
    // Back to rapid
    expect(data.segments[6].type).toBe(MotionType.RAPID);
    expect(data.segments[7].type).toBe(MotionType.RAPID);
  });

  it('handles cut-out.ngc CAM file with modal moves', () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'cut-out.ngc');
    if (!fs.existsSync(fixturePath)) return;
    const fixture = fs.readFileSync(fixturePath, 'utf-8');
    const data = extract(fixture);
    // CAM file should produce many segments from modal G01 moves
    expect(data.segments.length).toBeGreaterThan(100);
  });

  // ---------------------------------------------------------------------------
  // Motion context (source line, modal F/S)
  // ---------------------------------------------------------------------------

  it('attaches source line to each segment', () => {
    const data = extract('G0 X0 Y0\nG1 X10 Y20 F500');
    expect(data.segments).toHaveLength(2);
    expect(data.segments[0].context?.sourceLine).toBe(0);
    expect(data.segments[1].context?.sourceLine).toBe(1);
  });

  it('tracks modal feed rate from F parameter', () => {
    const data = extract('G1 X10 F500\nG1 X20');
    expect(data.segments[0].context?.feedRate).toBe(500);
    // F500 persists modally
    expect(data.segments[1].context?.feedRate).toBe(500);
  });

  it('updates feed rate when a new F value appears', () => {
    const data = extract('G1 X10 F500\nG1 X20 F1000');
    expect(data.segments[0].context?.feedRate).toBe(500);
    expect(data.segments[1].context?.feedRate).toBe(1000);
  });

  it('tracks modal spindle speed from S parameter', () => {
    const data = extract('G1 X10 S12000 F500\nG1 X20');
    expect(data.segments[0].context?.spindleSpeed).toBe(12000);
    expect(data.segments[1].context?.spindleSpeed).toBe(12000);
  });

  it('reports null feed rate and spindle speed before they are set', () => {
    const data = extract('G0 X10 Y10');
    expect(data.segments[0].context?.feedRate).toBeNull();
    expect(data.segments[0].context?.spindleSpeed).toBeNull();
  });

  it('preserves modal F/S across modal (standalone axis) moves', () => {
    const data = extract('G1 X10 F500 S8000\nX20 Y30\nX40 Y50');
    expect(data.segments).toHaveLength(3);
    for (const seg of data.segments) {
      expect(seg.context?.feedRate).toBe(500);
      expect(seg.context?.spindleSpeed).toBe(8000);
    }
  });

  it('attaches correct source lines for modal moves', () => {
    const data = extract('G1 X10 Y20 F500\nX15 Y25\nX20 Y30');
    expect(data.segments).toHaveLength(3);
    expect(data.segments[0].context?.sourceLine).toBe(0);
    expect(data.segments[1].context?.sourceLine).toBe(1);
    expect(data.segments[2].context?.sourceLine).toBe(2);
  });

  it('tracks F/S set on non-motion lines', () => {
    // G90 is not a motion command but F/S on the same line should be tracked
    const data = extract('G90 F600 S10000\nG1 X10');
    expect(data.segments[0].context?.feedRate).toBe(600);
    expect(data.segments[0].context?.spindleSpeed).toBe(10000);
  });

  // ---------------------------------------------------------------------------
  // Integration: surface-wasteboard.ngc fixture
  // ---------------------------------------------------------------------------

  it('handles surface-wasteboard.ngc with variables and loops', () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'surface-wasteboard.ngc');
    const fixture = fs.readFileSync(fixturePath, 'utf-8');
    const data = extract(fixture);
    // The WHILE loop produces many zigzag passes
    expect(data.segments.length).toBeGreaterThan(50);
    const rapidCount = data.segments.filter((s) => s.type === MotionType.RAPID).length;
    expect(rapidCount).toBeGreaterThan(10);
  });

  // ---------------------------------------------------------------------------
  // Arc plane selection (G17 / G18 / G19)
  // ---------------------------------------------------------------------------

  it('uses XY plane by default (G17 baseline)', () => {
    // Default plane is XY — a semicircle in XY should leave Z unchanged.
    const data = extract('G2 X10 Y0 I5 J0');
    expect(data.segments).toHaveLength(1);
    expect(data.segments[0].type).toBe(MotionType.ARC_CW);
    const arcPoints = data.segments[0].points;
    // All Z values should be 0 (no helical component)
    for (const point of arcPoints) {
      expect(point.z).toBeCloseTo(0, 5);
    }
    // X and Y should vary
    const xValues = arcPoints.map((p) => p.x);
    const yValues = arcPoints.map((p) => p.y);
    expect(Math.max(...xValues) - Math.min(...xValues)).toBeGreaterThan(0.1);
    expect(Math.max(...yValues) - Math.min(...yValues)).toBeGreaterThan(0.1);
  });

  it('handles G17 XY arc explicitly', () => {
    const data = extract('G17\nG2 X10 Y0 I5 J0');
    expect(data.segments).toHaveLength(1);
    expect(data.segments[0].type).toBe(MotionType.ARC_CW);
    // Z should remain 0
    for (const point of data.segments[0].points) {
      expect(point.z).toBeCloseTo(0, 5);
    }
  });

  it('handles G18 XZ arc — Y unchanged, X/Z vary', () => {
    // G18: arcs in XZ plane, using I/K offsets. Y is the normal axis.
    const data = extract('G18\nG2 X10 Z0 I5 K0');
    expect(data.segments).toHaveLength(1);
    expect(data.segments[0].type).toBe(MotionType.ARC_CW);
    const arcPoints = data.segments[0].points;
    // Y should remain 0 (normal axis, unchanged)
    for (const point of arcPoints) {
      expect(point.y).toBeCloseTo(0, 5);
    }
    // X and Z should vary
    const xValues = arcPoints.map((p) => p.x);
    const zValues = arcPoints.map((p) => p.z);
    expect(Math.max(...xValues) - Math.min(...xValues)).toBeGreaterThan(0.1);
    expect(Math.max(...zValues) - Math.min(...zValues)).toBeGreaterThan(0.1);
  });

  it('handles G19 YZ arc — X unchanged, Y/Z vary', () => {
    // G19: arcs in YZ plane, using J/K offsets. X is the normal axis.
    const data = extract('G19\nG2 Y10 Z0 J5 K0');
    expect(data.segments).toHaveLength(1);
    expect(data.segments[0].type).toBe(MotionType.ARC_CW);
    const arcPoints = data.segments[0].points;
    // X should remain 0 (normal axis, unchanged)
    for (const point of arcPoints) {
      expect(point.x).toBeCloseTo(0, 5);
    }
    // Y and Z should vary
    const yValues = arcPoints.map((p) => p.y);
    const zValues = arcPoints.map((p) => p.z);
    expect(Math.max(...yValues) - Math.min(...yValues)).toBeGreaterThan(0.1);
    expect(Math.max(...zValues) - Math.min(...zValues)).toBeGreaterThan(0.1);
  });

  it('switches arc plane mid-program', () => {
    const program = `
G17
G2 X10 Y0 I5 J0
G18
G2 X20 Z0 I5 K0
    `;
    const data = extract(program);
    expect(data.segments).toHaveLength(2);

    // First arc: XY plane — Z should stay 0
    for (const point of data.segments[0].points) {
      expect(point.z).toBeCloseTo(0, 5);
    }

    // Second arc: XZ plane — Y should remain unchanged from where it ended
    const yAfterFirstArc = data.segments[0].points[data.segments[0].points.length - 1].y;
    for (const point of data.segments[1].points) {
      expect(point.y).toBeCloseTo(yAfterFirstArc, 5);
    }
  });

  it('handles full circle in G18 (XZ plane)', () => {
    const data = extract('G18\nG1 X10 Z0\nG2 X10 Z0 I-5 K0');
    const arcSegment = data.segments[1];
    expect(arcSegment.type).toBe(MotionType.ARC_CW);
    // Full circle should produce many interpolated points
    expect(arcSegment.points.length).toBeGreaterThan(10);
    // First and last points should be the same
    const first = arcSegment.points[0];
    const last = arcSegment.points[arcSegment.points.length - 1];
    expect(first.x).toBeCloseTo(last.x, 5);
    expect(first.z).toBeCloseTo(last.z, 5);
  });

  it('handles helical arc in G17 (arc in XY + Z movement)', () => {
    // Arc from (0,0,0) to (10,0,5) with I5 J0 — the Z movement makes it helical
    const data = extract('G17\nG2 X10 Y0 Z5 I5 J0');
    expect(data.segments).toHaveLength(1);
    const arcPoints = data.segments[0].points;
    // Z should interpolate from 0 to 5
    expect(arcPoints[0].z).toBeCloseTo(0, 5);
    expect(arcPoints[arcPoints.length - 1].z).toBeCloseTo(5, 5);
    // Intermediate Z values should be between 0 and 5
    for (const point of arcPoints) {
      expect(point.z).toBeGreaterThanOrEqual(-0.001);
      expect(point.z).toBeLessThanOrEqual(5.001);
    }
  });

  // ---------------------------------------------------------------------------
  // G28 home position
  // ---------------------------------------------------------------------------

  it('G28 no params rapids directly to machine home (0,0,0)', () => {
    const data = extract('G1 X10 Y20 Z5\nG28');
    expect(data.segments).toHaveLength(2);
    // First segment: feed move to (10, 20, 5)
    expect(data.segments[0].type).toBe(MotionType.FEED);
    // Second segment: rapid to home
    expect(data.segments[1].type).toBe(MotionType.RAPID);
    const lastPoint = data.segments[1].points[data.segments[1].points.length - 1];
    expect(lastPoint).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('G28 Z0 rapids to intermediate then homes only Z', () => {
    const data = extract('G1 X10 Y20 Z5\nG28 Z0');
    // Feed move + intermediate rapid + home rapid
    expect(data.segments).toHaveLength(3);
    expect(data.segments[1].type).toBe(MotionType.RAPID);
    expect(data.segments[2].type).toBe(MotionType.RAPID);
    // Intermediate position: X/Y unchanged, Z=0 (absolute)
    const intermediateEnd = data.segments[1].points[data.segments[1].points.length - 1];
    expect(intermediateEnd).toEqual({ x: 10, y: 20, z: 0 });
    // Home: only Z goes to 0 (already 0), X/Y stay
    const homeEnd = data.segments[2].points[data.segments[2].points.length - 1];
    expect(homeEnd).toEqual({ x: 10, y: 20, z: 0 });
  });

  it('G28 X0 Y0 Z0 rapids to intermediate then homes all axes', () => {
    const data = extract('G1 X10 Y20 Z5\nG28 X0 Y0 Z0');
    expect(data.segments).toHaveLength(3);
    // Intermediate position in absolute mode: (0, 0, 0)
    const intermediateEnd = data.segments[1].points[data.segments[1].points.length - 1];
    expect(intermediateEnd).toEqual({ x: 0, y: 0, z: 0 });
    // Home: all axes to 0
    const homeEnd = data.segments[2].points[data.segments[2].points.length - 1];
    expect(homeEnd).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('G28 does not affect arc plane', () => {
    const data = extract('G18\nG1 X10 Y5 Z0\nG28\nG2 X10 Z0 I5 K0');
    // After G28, arc plane should still be G18 (XZ)
    const arcSegment = data.segments.find((s) => s.type === MotionType.ARC_CW);
    expect(arcSegment).toBeDefined();
    // Y should remain 0 (unchanged) in XZ arc after G28 homed to origin
    const arcPoints = arcSegment?.points ?? [];
    for (const point of arcPoints) {
      expect(point.y).toBeCloseTo(0, 5);
    }
  });

  it('G28 does not affect modal motion command', () => {
    const data = extract('G01 X10 Y20 F1000\nG28\nX5 Y5');
    // After G28, the modal command should still be G01 (feed)
    const lastSegment = data.segments[data.segments.length - 1];
    expect(lastSegment.type).toBe(MotionType.FEED);
    expect(lastSegment.points[lastSegment.points.length - 1]).toEqual({ x: 5, y: 5, z: 0 });
  });

  it('subsequent move starts from home position after G28', () => {
    const data = extract('G1 X10 Y20 Z5\nG28\nG1 X5 Y5 Z2');
    // After G28 (no params), position is (0,0,0)
    // Next G1 X5 Y5 Z2 should start from (0,0,0)
    const lastSegment = data.segments[data.segments.length - 1];
    expect(lastSegment.points[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(lastSegment.points[lastSegment.points.length - 1]).toEqual({ x: 5, y: 5, z: 2 });
  });

  it('G28 in incremental mode computes intermediate relative to current position', () => {
    const data = extract('G1 X10 Y20 Z5\nG91\nG28 X1 Y2 Z3');
    // Incremental: intermediate = (10+1, 20+2, 5+3) = (11, 22, 8)
    expect(data.segments).toHaveLength(3);
    const intermediateEnd = data.segments[1].points[data.segments[1].points.length - 1];
    expect(intermediateEnd).toEqual({ x: 11, y: 22, z: 8 });
    // Home: all specified axes go to 0
    const homeEnd = data.segments[2].points[data.segments[2].points.length - 1];
    expect(homeEnd).toEqual({ x: 0, y: 0, z: 0 });
  });

  // ---------------------------------------------------------------------------
  // User-defined initial variables
  // ---------------------------------------------------------------------------

  describe('initial variables', () => {
    /**
     * Helper: tokenise, parse, and extract with initial variables.
     */
    function extractWithVariables(
      input: string,
      variables: ReadonlyMap<string | number, number>
    ): ToolPathData {
      const lexer = new GCodeLexer();
      const tokens = lexer.tokenize(input);
      const parser = new LinuxCNCParser(tokens, input);
      const ast = parser.parseProgram();
      const extractor = new GCodePathExtractor();
      return extractor.extract(ast, VariableEnvironment.fromEntries(variables));
    }

    it('uses initial variables for numbered variable references', () => {
      const variables = new Map<string | number, number>([[100, 25.4]]);
      const data = extractWithVariables('G1 X#100', variables);
      expect(data.segments).toHaveLength(1);
      expect(data.segments[0].points[1]).toEqual({ x: 25.4, y: 0, z: 0 });
    });

    it('uses initial variables for named variable references', () => {
      const variables = new Map<string | number, number>([['offset_x', 10]]);
      const data = extractWithVariables('G1 X#<offset_x>', variables);
      expect(data.segments).toHaveLength(1);
      expect(data.segments[0].points[1]).toEqual({ x: 10, y: 0, z: 0 });
    });

    it('program assignments override initial variables', () => {
      const variables = new Map<string | number, number>([[100, 25.4]]);
      const data = extractWithVariables('#100 = 50\nG1 X#100', variables);
      expect(data.segments).toHaveLength(1);
      expect(data.segments[0].points[1]).toEqual({ x: 50, y: 0, z: 0 });
    });

    it('initial variables are used before any program assignment', () => {
      const variables = new Map<string | number, number>([[100, 25.4]]);
      const data = extractWithVariables('G1 X#100\n#100 = 50\nG1 Y#100', variables);
      expect(data.segments).toHaveLength(2);
      // First move uses initial value
      expect(data.segments[0].points[1]).toEqual({ x: 25.4, y: 0, z: 0 });
      // Second move uses program assignment
      expect(data.segments[1].points[1]).toEqual({ x: 25.4, y: 50, z: 0 });
    });

    it('without initial variables, unresolved variables default to null', () => {
      // Without initial variables, #100 should be null (evaluator returns null)
      // and the axis parameter evaluation returns null, meaning position unchanged
      const data = extract('G1 X#100');
      expect(data.segments).toHaveLength(1);
      // X stays at 0 since #100 is unresolved (null -> no change)
      expect(data.segments[0].points[1]).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('initial variables work with expressions', () => {
      const variables = new Map<string | number, number>([
        [100, 10],
        [200, 5],
      ]);
      const data = extractWithVariables('G1 X[#100 + #200]', variables);
      expect(data.segments).toHaveLength(1);
      expect(data.segments[0].points[1]).toEqual({ x: 15, y: 0, z: 0 });
    });

    it('multiple axes use different initial variables', () => {
      const variables = new Map<string | number, number>([
        [100, 10],
        [200, 20],
        [300, 30],
      ]);
      const data = extractWithVariables('G1 X#100 Y#200 Z#300', variables);
      expect(data.segments).toHaveLength(1);
      expect(data.segments[0].points[1]).toEqual({ x: 10, y: 20, z: 30 });
    });

    describe('referencedVariables', () => {
      it('contains correct display keys for numeric and named variables', () => {
        const variables = new Map<string | number, number>([
          [100, 10],
          ['tool_diameter', 5],
        ]);
        const data = extractWithVariables('G1 X#100 Y#<tool_diameter>', variables);
        const keys = data.referencedVariables.map((v) => v.key);
        expect(keys).toContain('#100');
        expect(keys).toContain('#<tool_diameter>');
      });

      it('is sorted: named keys alphabetically first, then numeric keys by number', () => {
        const variables = new Map<string | number, number>([
          [200, 20],
          [100, 10],
          ['zebra', 1],
          ['alpha', 2],
        ]);
        const data = extractWithVariables('G1 X#200 Y#100\nG1 X#<zebra> Y#<alpha>', variables);
        const keys = data.referencedVariables.map((v) => v.key);
        expect(keys).toEqual(['#<alpha>', '#<zebra>', '#100', '#200']);
      });

      it('value reflects the final resolved value after execution', () => {
        const variables = new Map<string | number, number>([[100, 10]]);
        // Program assigns #100 = 50 after initial use
        const data = extractWithVariables('G1 X#100\n#100 = 50\nG1 Y#100', variables);
        const ref = data.referencedVariables.find((v) => v.key === '#100');
        expect(ref).toBeDefined();
        // The final value after execution is 50, not the initial 10
        expect(ref?.value).toBe(50);
      });
    });
  });
});
