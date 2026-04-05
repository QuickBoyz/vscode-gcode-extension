import { DialectType } from '../../constants';
import { FanucCompatibleFormatter } from '../../formatter/dialects/FanucCompatibleFormatter';
import { LexerFactory } from '../../lexer/LexerFactory';
import { AstTraverser } from '../../parser/AstTraverser';
import { ParserFactory } from '../../parser/ParserFactory';

describe('FanucCompatibleFormatter', () => {
  let formatter: FanucCompatibleFormatter;

  // Fanuc formatter tests use LinuxCNC parser because the test fixtures
  // contain O-block labels (LinuxCNC syntax). The formatter tests verify
  // output formatting, not parsing — the AST is the same regardless
  // of which parser produced it. Dialect-specific test fixtures will be
  // added when dialect-specific parsing differences are tested.
  function parse(code: string) {
    const lexer = LexerFactory.create(DialectType.LINUXCNC),
      tokens = lexer.tokenize(code),
      parser = ParserFactory.create(DialectType.LINUXCNC, tokens, code);
    return parser.parseProgram();
  }

  beforeEach(() => {
    formatter = new FanucCompatibleFormatter();
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

  describe('Subroutine Formatting', () => {
    function parseFanuc(code: string) {
      const lexer = LexerFactory.create(DialectType.FANUC),
        tokens = lexer.tokenize(code),
        parser = ParserFactory.create(DialectType.FANUC, tokens, code);
      return parser.parseProgram();
    }

    it('formats M98 P1000 as subroutine call', () => {
      const code = 'M98 P1000',
        program = parseFanuc(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('M98 P1000');
    });

    it('formats M98 P1000 L3 with repeat count', () => {
      const code = 'M98 P1000 L3',
        program = parseFanuc(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('M98 P1000 L3.0');
    });

    it('formats M99 as return', () => {
      const code = 'M99',
        program = parseFanuc(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('M99');
    });

    it('formats full program with M98 and M99', () => {
      const code = `G0 X0 Y0
M98 P1000 L3
G0 X10
M99`,
        program = parseFanuc(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('G00 X0.0 Y0.0');
      expect(formatted).toContain('M98 P1000 L3.0');
      expect(formatted).toContain('G00 X10.0');
      expect(formatted).toContain('M99');
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
        localFormatter = new FanucCompatibleFormatter({ addLineNumbers: true }),
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
        localFormatter = new FanucCompatibleFormatter({ indent: true, indentSize: 2 }),
        traverser = new AstTraverser(localFormatter),
        formatted = localFormatter.formatGCode(program, traverser);

      expect(formatted).toContain('  G01 X10.0');
    });

    it('handles compact output', () => {
      const code = `G0 X0


G1 X10`,
        program = parse(code),
        localFormatter = new FanucCompatibleFormatter({ compactOutput: true }),
        traverser = new AstTraverser(localFormatter),
        formatted = localFormatter.formatGCode(program, traverser);

      expect(formatted).not.toContain('\n\n');
    });
  });
});
