import { LinuxCNCFormatter } from '../../formatter/dialects/LinuxCNCFormatter';
import { GCodeLexer } from '../../lexer/GCodeLexer';
import { AstTraverser } from '../../parser/AstTraverser';
import { GCodeParser } from '../../parser/GCodeParser';

describe('LinuxCNCFormatter', () => {
  let formatter: LinuxCNCFormatter;

  function parse(code: string) {
    const lexer = new GCodeLexer(),
      tokens = lexer.tokenize(code),
      parser = new GCodeParser(tokens, code);
    return parser.parseProgram();
  }

  beforeEach(() => {
    formatter = new LinuxCNCFormatter();
  });

  describe('Control Flow Syntax', () => {
    it('formats IF without THEN keyword per LinuxCNC spec', () => {
      const code = `O100 IF [#<x> GT 0]
#<y>=10
O100 ENDIF`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('O100 IF [#<x> GT 0.0]');
      expect(formatted).not.toContain('THEN');
      expect(formatted).toContain('O100 ENDIF');
    });

    it('formats WHILE without DO keyword and uses ENDWHILE', () => {
      const code = `O100 WHILE [#<i> LT 2]
G01 X10
O100 ENDWHILE`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('O100 WHILE [#<i> LT 2.0]');
      expect(formatted).not.toContain('DO');
      expect(formatted).toContain('O100 ENDWHILE');
    });

    it('formats IF / ELSEIF / ELSE with proper keywords', () => {
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

      expect(formatted).toContain('O1 IF [#<x> LT 0.0]');
      expect(formatted).toContain('O1 ELSEIF [#<x> EQ 0.0]');
      expect(formatted).toContain('O1 ELSE');
      expect(formatted).toContain('O1 ENDIF');
      expect(formatted).not.toContain('THEN');
    });

    it('omits THEN keyword even when present in source', () => {
      const code = `O10 IF [#<a> EQ 1] THEN
G01 X10
O10 ENDIF`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(
        `%
O10 IF [#<a> EQ 1.0]
  G01 X10.0
O10 ENDIF
%`
      );
    });

    it('formats nested control structures', () => {
      const code = `O10 WHILE [#<i> LT 2]
#<i> = 5
O20 IF [#<i> EQ 1]
G01 X10
O20 ENDIF
O10 ENDWHILE`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(
        `%
O10 WHILE [#<i> LT 2.0]
  #<i> = 5.0
  O20 IF [#<i> EQ 1.0]
    G01 X10.0
  O20 ENDIF
O10 ENDWHILE
%`
      );
    });
  });

  describe('Variable Formatting', () => {
    it('formats named variables with angle brackets', () => {
      const code = `#<tool_diameter> = 10.5`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('#<tool_diameter> = 10.5');
    });

    it('formats numeric variables without angle brackets', () => {
      const code = `#<x> = #5410`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('#<x> = #5410');
      expect(formatted).not.toContain('#<5410>');
    });

    it('formats mixed named and numeric variables', () => {
      const code = `#<result> = #5410 + #<offset>`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('#<result> = #5410 + #<offset>');
    });
  });

  describe('Label Formatting', () => {
    it('formats O-block labels with O prefix', () => {
      const code = `o100 IF [#<x> GT 0]
G01 X10
o100 ENDIF`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('O100 IF');
      expect(formatted).toContain('O100 ENDIF');
    });

    it('preserves label numbers', () => {
      const code = `O9999 WHILE [#<i> LT 10]
G01 X#<i>
O9999 ENDWHILE`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('O9999 WHILE');
      expect(formatted).toContain('O9999 ENDWHILE');
    });
  });

  describe('Common Formatting Features', () => {
    it('formats simple program with commands and variables', () => {
      const code = `; comment
#<x> = 10
G0 X#<x> Y20 F100`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toBe(
        `%
; comment
#<x> = 10.0
G00 X#<x> Y20.0 F100.0
%`
      );
    });

    it('adds line numbers when enabled', () => {
      const code = `G1 X10 Y20`,
        program = parse(code),
        localFormatter = new LinuxCNCFormatter({ addLineNumbers: true }),
        traverser = new AstTraverser(localFormatter),
        formatted = localFormatter.formatGCode(program, traverser);

      expect(formatted).toBe(`%
N10 G01 X10.0 Y20.0
%`);
    });

    it('respects indentation settings', () => {
      const code = `O100 IF [#<x> GT 0]
G01 X10
O100 ENDIF`,
        program = parse(code),
        localFormatter = new LinuxCNCFormatter({ indent: true, indentSize: 4 }),
        traverser = new AstTraverser(localFormatter),
        formatted = localFormatter.formatGCode(program, traverser);

      expect(formatted).toContain('    G01 X10.0');
    });

    it('handles compact output mode', () => {
      const code = `G0 X0


G1 X10`,
        program = parse(code),
        localFormatter = new LinuxCNCFormatter({ compactOutput: true }),
        traverser = new AstTraverser(localFormatter),
        formatted = localFormatter.formatGCode(program, traverser);

      expect(formatted).not.toContain('\n\n');
    });

    it('pretty-prints G/M codes', () => {
      const code = `G1 M3`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('G01');
      expect(formatted).toContain('M03');
    });

    it('preserves comments', () => {
      const code = `; Line comment
G01 X10 (inline comment)`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('; Line comment');
      expect(formatted).toContain('(inline comment)');
    });
  });

  describe('Expression Formatting', () => {
    it('handles function calls', () => {
      const code = `#<y> = ABS[-5]`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('ABS[-5.0]');
    });

    it('preserves brackets for precedence', () => {
      const code = `#<result> = [#<a> + #<b>] * #<c>`,
        program = parse(code),
        localFormatter = new LinuxCNCFormatter({ prettyPrintNumbers: false }),
        traverser = new AstTraverser(localFormatter),
        formatted = localFormatter.formatGCode(program, traverser);

      expect(formatted).toContain('[#<a> + #<b>] * #<c>');
    });

    it('handles axis parameter expressions', () => {
      const code = `G01 X[#<x> + 10] Y#<y>`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('X[#<x> + 10.0]');
    });
  });
});
