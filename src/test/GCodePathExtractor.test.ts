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
});
