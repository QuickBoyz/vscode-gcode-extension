import { VisualizerService } from '../client/VisualizerService';
import { ParseError } from '../errors/ParseError';
import * as LexerFactoryModule from '../lexer/LexerFactory';
import { Range } from '../parser/nodes/Range';
import { ExtractorProgressUpdate } from '../visualizer/GCodePathExtractor';
import { MotionType, VisualizerPhase } from '../visualizer/types';

describe('VisualizerService', () => {
  let service: VisualizerService;

  beforeEach(() => {
    service = new VisualizerService();
  });

  // ---------------------------------------------------------------------------
  // Success cases
  // ---------------------------------------------------------------------------

  it('returns a successful result for valid G-code', () => {
    const result = service.extractToolPath('G0 X10 Y20\nG1 X30 Y40');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.segments).toHaveLength(2);
      expect(result.data.segments[0].type).toBe(MotionType.RAPID);
      expect(result.data.segments[1].type).toBe(MotionType.FEED);
    }
  });

  it('returns a successful result with empty segments for empty input', () => {
    const result = service.extractToolPath('');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.segments).toHaveLength(0);
    }
  });

  it('returns a successful result for comments-only input', () => {
    const result = service.extractToolPath('; just a comment\n(another comment)');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.segments).toHaveLength(0);
    }
  });

  it('includes bounding box in successful result', () => {
    const result = service.extractToolPath('G1 X10 Y20 Z5');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bounds.min).toEqual({ x: 0, y: 0, z: 0 });
      expect(result.data.bounds.max).toEqual({ x: 10, y: 20, z: 5 });
    }
  });

  // ---------------------------------------------------------------------------
  // Error cases
  // ---------------------------------------------------------------------------

  it('returns a failure result when the lexer throws a ParseError with a range', () => {
    const range = Range.create(3, 2, 3, 3);
    jest.spyOn(LexerFactoryModule.LexerFactory, 'create').mockReturnValue({
      tokenize: () => {
        throw new ParseError('Unexpected character', undefined, undefined, range);
      },
    } as unknown as ReturnType<typeof LexerFactoryModule.LexerFactory.create>);

    const result = service.extractToolPath('!!!invalid!!!');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toBe('Unexpected character');
      expect(result.range).toEqual(range);
    }

    jest.restoreAllMocks();
  });

  it('returns range: null when a generic Error is thrown', () => {
    jest.spyOn(LexerFactoryModule.LexerFactory, 'create').mockReturnValue({
      tokenize: () => {
        throw new Error('Internal error');
      },
    } as unknown as ReturnType<typeof LexerFactoryModule.LexerFactory.create>);

    const result = service.extractToolPath('anything');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.range).toBeNull();
    }

    jest.restoreAllMocks();
  });

  it('returns a failure result with a generic message for non-Error throws', () => {
    jest.spyOn(LexerFactoryModule.LexerFactory, 'create').mockReturnValue({
      tokenize: () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'string error';
      },
    } as unknown as ReturnType<typeof LexerFactoryModule.LexerFactory.create>);

    const result = service.extractToolPath('anything');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorMessage).toBe('An unknown error occurred during G-code parsing');
      expect(result.range).toBeNull();
    }

    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Reusability
  // ---------------------------------------------------------------------------

  it('can be reused for multiple extractions', () => {
    const result1 = service.extractToolPath('G0 X10');
    const result2 = service.extractToolPath('G1 Y20');

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    if (result1.success && result2.success) {
      expect(result1.data.segments[0].type).toBe(MotionType.RAPID);
      expect(result2.data.segments[0].type).toBe(MotionType.FEED);
    }
  });

  // ---------------------------------------------------------------------------
  // Initial variables
  // ---------------------------------------------------------------------------

  it('uses initial variables for tool-path extraction', () => {
    const result = service.extractToolPath('G1 X#100', undefined, { '#100': 25.4 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.segments).toHaveLength(1);
      expect(result.data.segments[0].points[1]).toEqual({ x: 25.4, y: 0, z: 0 });
    }
  });

  it('without initial variables, unresolved variable leaves position unchanged', () => {
    const result = service.extractToolPath('G1 X#100');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.segments).toHaveLength(1);
      // #100 unresolved -> null -> X stays at 0
      expect(result.data.segments[0].points[1]).toEqual({ x: 0, y: 0, z: 0 });
    }
  });

  // ---------------------------------------------------------------------------
  // onProgress callback (AC6: phase-only + phase+message)
  // ---------------------------------------------------------------------------

  describe('onProgress', () => {
    it('fires phase-only updates at PARSING and EXTRACTING boundaries', () => {
      const updates: ExtractorProgressUpdate[] = [];
      service.extractToolPath('G0 X10', undefined, undefined, (u) => updates.push(u));

      const phaseOnly = updates.filter((u) => u.message === undefined);
      const phases = phaseOnly.map((u) => u.phase);
      expect(phases).toContain(VisualizerPhase.PARSING);
      expect(phases).toContain(VisualizerPhase.EXTRACTING);
    });

    it('fires phase+message updates during extraction for large inputs', () => {
      // Freeze Date.now so the first pushSegment is past the 100ms threshold
      // (lastProgressAt=0 → now-0 >= 100) and subsequent ones are throttled.
      jest.spyOn(Date, 'now').mockReturnValue(1000);

      const updates: ExtractorProgressUpdate[] = [];
      const text = Array.from({ length: 200 }, (_, i) => `G1 X${(i + 1).toString()}`).join('\n');
      service.extractToolPath(text, undefined, undefined, (u) => updates.push(u));

      const withMessage = updates.filter((u) => u.message !== undefined);
      expect(withMessage.length).toBeGreaterThan(0);
      expect(withMessage[0].phase).toBe(VisualizerPhase.EXTRACTING);
      expect(withMessage[0].message).toMatch(/\d+ segments/);

      jest.restoreAllMocks();
    });

    it('does not throw when onProgress is omitted', () => {
      expect(() => service.extractToolPath('G0 X10 Y20')).not.toThrow();
    });
  });
});
