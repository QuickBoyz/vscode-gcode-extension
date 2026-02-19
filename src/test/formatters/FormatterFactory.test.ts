import { DialectType } from '../../constants';
import { FormatterFactory } from '../../formatter/FormatterFactory';
import { GCodeLexer } from '../../lexer/GCodeLexer';
import { AstTraverser } from '../../parser/AstTraverser';
import { GCodeParser } from '../../parser/GCodeParser';

describe('Dialect-Specific Formatters', () => {
  function parse(code: string) {
    const lexer = new GCodeLexer(),
      tokens = lexer.tokenize(code),
      parser = new GCodeParser(tokens, code);
    return parser.parseProgram();
  }

  describe('LinuxCNC Formatter', () => {
    it('formats IF without THEN keyword per official LinuxCNC spec', () => {
      const code = `O100 IF [#<x> GT 0]
#<y>=10
O100 ENDIF`,
        program = parse(code),
        formatter = FormatterFactory.create(DialectType.LINUXCNC),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('O100 IF [#<x> GT 0.0]');
      expect(formatted).not.toContain('THEN');
      expect(formatted).toContain('O100 ENDIF');
    });

    it('formats WHILE without DO keyword and uses ENDWHILE per official LinuxCNC spec', () => {
      const code = `O100 WHILE [#<i> LT 2]
G01 X10
O100 ENDWHILE`,
        program = parse(code),
        formatter = FormatterFactory.create(DialectType.LINUXCNC),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('O100 WHILE [#<i> LT 2.0]');
      expect(formatted).not.toContain('DO');
      expect(formatted).toContain('O100 ENDWHILE');
    });
  });

  describe('Fanuc Formatter', () => {
    it('formats IF with THEN keyword (macro style)', () => {
      const code = `O100 IF [#<x> GT 0]
#<y>=10
O100 ENDIF`,
        program = parse(code),
        formatter = FormatterFactory.create(DialectType.FANUC),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('IF [#<x> GT 0.0] THEN');
      expect(formatted).toContain('ENDIF');
    });
  });

  describe('Haas Formatter', () => {
    it('formats IF with THEN keyword', () => {
      const code = `O100 IF [#<x> GT 0]
#<y>=10
O100 ENDIF`,
        program = parse(code),
        formatter = FormatterFactory.create(DialectType.HAAS),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('IF [#<x> GT 0.0] THEN');
      expect(formatted).toContain('ENDIF');
    });
  });

  describe('Siemens Formatter', () => {
    it('formats IF without THEN keyword', () => {
      const code = `O100 IF [#<x> GT 0]
#<y>=10
O100 ENDIF`,
        program = parse(code),
        formatter = FormatterFactory.create(DialectType.SIEMENS),
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
        formatter = FormatterFactory.create(DialectType.SIEMENS),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('WHILE [#<i> LT 2.0]');
      expect(formatted).not.toContain('DO');
      expect(formatted).toContain('ENDWHILE');
      expect(formatted).not.toContain('O100 END');
    });

    it('formats labels with colon', () => {
      const code = `O100 IF [#<x> GT 0]
G01 X10
O100 ENDIF`,
        program = parse(code),
        formatter = FormatterFactory.create(DialectType.SIEMENS),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      expect(formatted).toContain('O100:');
    });

    it('formats complex IF/ELSEIF/ELSE without THEN', () => {
      const code = `O1 IF [#<x> LT 0]
G01 X-1
O1 ELSEIF [#<x> EQ 0]
G01 X0
O1 ELSE
G01 X1
O1 ENDIF`,
        program = parse(code),
        formatter = FormatterFactory.create(DialectType.SIEMENS),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      // Should not have THEN anywhere
      expect(formatted).not.toContain('THEN');
      // Should have IF, ELSEIF, ELSE, ENDIF
      expect(formatted).toContain('O1: IF');
      expect(formatted).toContain('O1: ELSEIF');
      expect(formatted).toContain('O1: ELSE');
      expect(formatted).toContain('O1: ENDIF');
    });
  });

  describe('FormatterFactory', () => {
    it('creates LinuxCNC formatter by default', () => {
      const formatter = FormatterFactory.createDefault();
      expect(formatter).toBeDefined();

      const code = `IF [#<x> GT 0]
G01 X10
ENDIF`,
        program = parse(code),
        traverser = new AstTraverser(formatter),
        formatted = formatter.formatGCode(program, traverser);

      // LinuxCNC does NOT use THEN keyword per official spec
      expect(formatted).not.toContain('THEN');
      expect(formatted).toContain('O100 IF [#<x> GT 0.0]');
      expect(formatted).toContain('O100 ENDIF');
    });

    it('throws error for unrecognized dialect', () => {
      // @ts-expect-error - testing invalid input
      expect(() => FormatterFactory.create('unknown')).toThrow('Invalid dialect');
    });

    it('handles case-insensitive dialect names', () => {
      expect(() => FormatterFactory.create(DialectType.LINUXCNC)).not.toThrow();
      expect(() => FormatterFactory.create(DialectType.FANUC)).not.toThrow();
      expect(() => FormatterFactory.create(DialectType.HAAS)).not.toThrow();
      expect(() => FormatterFactory.create(DialectType.SIEMENS)).not.toThrow();
    });
  });

  describe('LinuxCNC Auto-Generated O-Blocks', () => {
    it('should auto-generate O-block labels for IF statements without labels', () => {
      const code = `IF [#<x> GT 0]
  G01 X10
ENDIF`;
      const formatter = FormatterFactory.create(DialectType.LINUXCNC, {
        indent: false,
        addLineNumbers: false,
        addProgramDelimiters: false,
        prettyPrintNumbers: true,
      });
      const result = formatter.formatGCode(parse(code), new AstTraverser(formatter));
      expect(result).toBe(`O100 IF [#<x> GT 0.0]
G01 X10.0
O100 ENDIF`);
    });

    it('should auto-generate O-block labels for WHILE statements without labels', () => {
      const code = `WHILE [#<i> LT 10]
  G01 X#<i>
  #<i> = [#<i> + 1]
ENDWHILE`;
      const formatter = FormatterFactory.create(DialectType.LINUXCNC, {
        indent: false,
        addLineNumbers: false,
        addProgramDelimiters: false,
        prettyPrintNumbers: true,
      });
      const result = formatter.formatGCode(parse(code), new AstTraverser(formatter));
      expect(result).toBe(`O100 WHILE [#<i> LT 10.0]
G01 X#<i>
#<i> = #<i> + 1.0
O100 ENDWHILE`);
    });

    it('should auto-generate different O-block labels for nested statements', () => {
      const code = `IF [#<x> GT 0]
  WHILE [#<i> LT 5]
    G01 X#<i>
  ENDWHILE
ENDIF`;
      const formatter = FormatterFactory.create(DialectType.LINUXCNC, {
        indent: false,
        addLineNumbers: false,
        addProgramDelimiters: false,
        prettyPrintNumbers: true,
      });
      const result = formatter.formatGCode(parse(code), new AstTraverser(formatter));
      expect(result).toBe(`O100 IF [#<x> GT 0.0]
O110 WHILE [#<i> LT 5.0]
G01 X#<i>
O110 ENDWHILE
O100 ENDIF`);
    });

    it('should preserve explicit O-block labels when provided', () => {
      const code = `O200 IF [#<x> GT 0]
  G01 X10
O200 ENDIF`;
      const formatter = FormatterFactory.create(DialectType.LINUXCNC, {
        indent: false,
        addLineNumbers: false,
        addProgramDelimiters: false,
        prettyPrintNumbers: true,
      });
      const result = formatter.formatGCode(parse(code), new AstTraverser(formatter));
      expect(result).toBe(`O200 IF [#<x> GT 0.0]
G01 X10.0
O200 ENDIF`);
    });

    it('should auto-generate labels for IF/ELSEIF/ELSE/ENDIF', () => {
      const code = `IF [#<x> GT 5]
  G01 X5
ELSEIF [#<x> LT 2]
  G01 X2
ELSE
  G01 X0
ENDIF`;
      const formatter = FormatterFactory.create(DialectType.LINUXCNC, {
        indent: false,
        addLineNumbers: false,
        addProgramDelimiters: false,
        prettyPrintNumbers: true,
      });
      const result = formatter.formatGCode(parse(code), new AstTraverser(formatter));
      expect(result).toBe(`O100 IF [#<x> GT 5.0]
G01 X5.0
O100 ELSEIF [#<x> LT 2.0]
G01 X2.0
O100 ELSE
G01 X0.0
O100 ENDIF`);
    });

    it('should avoid conflicts with existing O-block labels', () => {
      const code = `O100 WHILE [#<row> LT 5]
  O110 WHILE [#<col> LT 3]
    G01 X#<col> Y#<row>
  O110 ENDWHILE
O100 ENDWHILE

IF [#<done> EQ 1]
  G00 Z10
ENDIF`;
      const formatter = FormatterFactory.create(DialectType.LINUXCNC, {
        indent: false,
        addLineNumbers: false,
        addProgramDelimiters: false,
        prettyPrintNumbers: true,
      });
      const result = formatter.formatGCode(parse(code), new AstTraverser(formatter));
      // Should start auto-generation at O120 (next available after O110)
      expect(result).toBe(`O100 WHILE [#<row> LT 5.0]
O110 WHILE [#<col> LT 3.0]
G01 X#<col> Y#<row>
O110 ENDWHILE
O100 ENDWHILE

O120 IF [#<done> EQ 1.0]
G00 Z10.0
O120 ENDIF`);
    });
  });
});
