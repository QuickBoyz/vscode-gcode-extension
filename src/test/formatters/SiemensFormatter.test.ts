import { SiemensFormatter } from '../../formatter/dialects/SiemensFormatter';
import { GCodeLexer } from '../../lexer/GCodeLexer';
import { AstTraverser } from '../../parser/AstTraverser';
import { GCodeParser } from '../../parser/GCodeParser';

describe('SiemensFormatter', () => {
  let formatter: SiemensFormatter;

  function parse(code: string) {
    const lexer = new GCodeLexer(),
      tokens = lexer.tokenize(code),
      parser = new GCodeParser(tokens, code);
    return parser.parseProgram();
  }

  beforeEach(() => {
    formatter = new SiemensFormatter();
  });

  describe('Control Flow Syntax', () => {
    it('formats IF without THEN keyword (Siemens style)', () => {
      const code = `O100 IF [#<x> GT 0]
#<y>=10
O100 ENDIF`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('IF [#<x> GT 0.0]');
      expect(formatted).not.toContain('THEN');
      expect(formatted).toContain('ENDIF');
    });

    it('formats WHILE without DO keyword and uses ENDWHILE', () => {
      const code = `O100 WHILE [#<i> LT 2]
G01 X10
O100 END`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('WHILE [#<i> LT 2.0]');
      expect(formatted).not.toContain('DO');
      expect(formatted).toContain('ENDWHILE');
    });

    it('formats IF / ELSEIF / ELSE without THEN', () => {
      const code = `O1 IF [#<x> LT 0]
G01 X-1
O1 ELSEIF [#<x> EQ 0]
G01 X0
O1 ELSE
G01 X1
O1 ENDIF`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('IF [#<x> LT 0.0]');
      expect(formatted).not.toContain('THEN');
      expect(formatted).toContain('ELSEIF [#<x> EQ 0.0]');
      expect(formatted).toContain('ELSE');
      expect(formatted).toContain('ENDIF');
    });

    it('omits THEN even if present in source', () => {
      const code = `O10 IF [#<a> EQ 1] THEN
G01 X10
O10 ENDIF`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).not.toContain('THEN');
      expect(formatted).toContain('IF [#<a> EQ 1.0]');
    });

    it('formats nested structures', () => {
      const code = `O10 WHILE [#<i> LT 2]
O20 IF [#<i> EQ 1]
G01 X10
O20 ENDIF
O10 END`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('WHILE [#<i> LT 2.0]');
      expect(formatted).not.toContain('DO');
      expect(formatted).toContain('IF [#<i> EQ 1.0]');
      expect(formatted).not.toContain('THEN');
      expect(formatted).toContain('ENDWHILE');
    });
  });

  describe('Label Formatting', () => {
    it('formats labels with colon suffix (Siemens style)', () => {
      const code = `o100 IF [#<x> GT 0]
G01 X10
o100 ENDIF`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('O100: IF');
      expect(formatted).toContain('O100: ENDIF');
    });
  });

  describe('Common Features', () => {
    it('formats simple program', () => {
      const code = `; comment
#<x> = 10
G0 X#<x> Y20`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('#<x> = 10.0');
      expect(formatted).toContain('G00 X#<x> Y20.0');
    });

    it('adds line numbers when enabled', () => {
      const code = `G1 X10 Y20`,
        program = parse(code),
        localFormatter = new SiemensFormatter({ addLineNumbers: true }),
        traverser = new AstTraverser(localFormatter),
        formatted = localFormatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
N10 G01 X10.0 Y20.0
%`);
    });

    it('respects indent settings', () => {
      const code = `O100 IF [#<x> GT 0]
G01 X10
O100 ENDIF`,
        program = parse(code),
        localFormatter = new SiemensFormatter({ indent: true, indentSize: 4 }),
        traverser = new AstTraverser(localFormatter),
        formatted = localFormatter.formatGCode(program, traverser);

      expect(formatted).toContain('    G01 X10.0');
    });

    it('handles compact output', () => {
      const code = `G0 X0


G1 X10`,
        program = parse(code),
        localFormatter = new SiemensFormatter({ compactOutput: true }),
        traverser = new AstTraverser(localFormatter),
        formatted = localFormatter.formatGCode(program, traverser);

      expect(formatted).not.toContain('\n\n');
    });

    it('pretty-prints commands', () => {
      const code = `G1 M3`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('G01');
      expect(formatted).toContain('M03');
    });

    it('preserves comments', () => {
      const code = `; Comment
G01 X10 (inline)`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('; Comment');
      expect(formatted).toContain('(inline)');
    });
  });
});
