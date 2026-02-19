import { FanucFormatter } from '../../formatter/dialects/FanucFormatter';
import { GCodeLexer } from '../../lexer/GCodeLexer';
import { AstTraverser } from '../../parser/AstTraverser';
import { GCodeParser } from '../../parser/GCodeParser';

describe('FanucFormatter', () => {
  let formatter: FanucFormatter;

  function parse(code: string) {
    const lexer = new GCodeLexer(),
      tokens = lexer.tokenize(code),
      parser = new GCodeParser(tokens, code);
    return parser.parseProgram();
  }

  beforeEach(() => {
    formatter = new FanucFormatter();
  });

  describe('Control Flow Syntax', () => {
    it('formats IF with THEN keyword (Fanuc macro style)', () => {
      const code = `O100 IF [#<x> GT 0]
#<y>=10
O100 ENDIF`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('IF [#<x> GT 0.0] THEN');
      expect(formatted).toContain('ENDIF');
    });

    it('formats WHILE with DO keyword', () => {
      const code = `O100 WHILE [#<i> LT 2]
G01 X10
O100 END`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('WHILE [#<i> LT 2.0] DO');
      expect(formatted).toContain('END');
    });

    it('formats IF / ELSEIF / ELSE with THEN keywords', () => {
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

      expect(formatted).toContain('IF [#<x> LT 0.0] THEN');
      expect(formatted).toContain('ELSEIF [#<x> EQ 0.0]');
      expect(formatted).not.toContain('ELSEIF [#<x> EQ 0.0] THEN');
      expect(formatted).toContain('ELSE');
      expect(formatted).toContain('ENDIF');
    });

    it('adds THEN keyword even if not in source', () => {
      const code = `O10 IF [#<a> EQ 1]
G01 X10
O10 ENDIF`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('IF [#<a> EQ 1.0] THEN');
    });

    it('formats nested control structures', () => {
      const code = `O10 WHILE [#<i> LT 2]
#<i> = 5
O20 IF [#<i> EQ 1]
G01 X10
O20 ENDIF
O10 END`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('WHILE [#<i> LT 2.0] DO');
      expect(formatted).toContain('IF [#<i> EQ 1.0] THEN');
      expect(formatted).toContain('END');
    });
  });

  describe('Label Formatting', () => {
    it('formats labels with uppercase', () => {
      const code = `o100 IF [#<x> GT 0]
G01 X10
o100 ENDIF`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('O100 IF');
      expect(formatted).toContain('O100 ENDIF');
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
        localFormatter = new FanucFormatter({ addLineNumbers: true }),
        traverser = new AstTraverser(localFormatter),
        formatted = localFormatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
N10 G01 X10.0 Y20.0
%`);
    });

    it('pretty-prints commands', () => {
      const code = `G1 M3`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('G01');
      expect(formatted).toContain('M03');
    });

    it('respects indentation', () => {
      const code = `O100 IF [#<x> GT 0]
G01 X10
O100 ENDIF`,
        program = parse(code),
        localFormatter = new FanucFormatter({ indent: true, indentSize: 2 }),
        traverser = new AstTraverser(localFormatter),
        formatted = localFormatter.formatGCode(program, traverser);

      expect(formatted).toContain('  G01 X10.0');
    });

    it('handles compact output', () => {
      const code = `G0 X0


G1 X10`,
        program = parse(code),
        localFormatter = new FanucFormatter({ compactOutput: true }),
        traverser = new AstTraverser(localFormatter),
        formatted = localFormatter.formatGCode(program, traverser);

      expect(formatted).not.toContain('\n\n');
    });
  });
});
