import * as fs from 'fs';
import * as path from 'path';
import { GCodeLexer } from '../lexer/GCodeLexer';
import { GCodeParser } from '../parser/GCodeParser';
import { GCodePathExtractor } from '../visualizer/GCodePathExtractor';
import { MotionType, ToolPathData } from '../visualizer/types';

describe('GCodePathExtractor', () => {
  /**
   * Helper: tokenise, parse, and extract path data from a G-code string.
   */
  function extract(input: string): ToolPathData {
    const lexer = new GCodeLexer();
    const tokens = lexer.tokenize(input);
    const parser = new GCodeParser(tokens, input);
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
});
