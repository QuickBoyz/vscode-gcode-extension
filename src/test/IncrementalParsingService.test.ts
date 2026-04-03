import { DialectType } from '../constants';
import { LexerFactory } from '../lexer/LexerFactory';
import { ContentChange, IncrementalParsingService } from '../parser/IncrementalParsingService';
import { ParserFactory } from '../parser/ParserFactory';
import { MotionCommandNode, ProgramNode } from '../parser/nodes';

function parse(text: string, dialect: DialectType = DialectType.LINUXCNC): ProgramNode {
  const lexer = LexerFactory.create(dialect);
  const tokens = lexer.tokenize(text);
  const parser = ParserFactory.create(dialect, tokens, text);
  return parser.parseProgram();
}

function makeChange(
  startLine: number,
  endLine: number,
  lineDelta: number,
  startChar = 0,
  endChar = 0
): ContentChange {
  return {
    startLine,
    startCharacter: startChar,
    endLine,
    endCharacter: endChar,
    lineDelta,
  };
}

describe('IncrementalParsingService', () => {
  let service: IncrementalParsingService;

  beforeEach(() => {
    service = new IncrementalParsingService();
  });

  describe('simple single-line edits', () => {
    it('should incrementally re-parse a modified line', () => {
      const oldText = 'G00 X0 Y0\nG01 X10 F100\nG01 X20\nM30';
      const newText = 'G00 X0 Y0\nG01 X50 F200\nG01 X20\nM30';
      const oldAst = parse(oldText);

      // Line 1 changed (G01 X10 F100 → G01 X50 F200), same line count
      const change = makeChange(1, 1, 0);
      const result = service.tryIncrementalParse(
        oldAst,
        newText,
        oldText,
        change,
        DialectType.LINUXCNC
      );

      expect(result.success).toBe(true);
      expect(result.ast).toBeDefined();
      expect(result.ast!.statements.length).toBe(4);

      // Check the modified statement
      const stmt = result.ast!.statements[1];
      expect(stmt).toBeInstanceOf(MotionCommandNode);
      expect((stmt as MotionCommandNode).command).toMatch(/G01/i);

      // Check that subsequent statements have correct positions
      const stmt2 = result.ast!.statements[2];
      expect(stmt2.getRange().start.line).toBe(2);
      const stmt3 = result.ast!.statements[3];
      expect(stmt3.getRange().start.line).toBe(3);
    });

    it('should handle editing the first line', () => {
      const oldText = 'G00 X0 Y0\nG01 X10 F100';
      const newText = 'G00 X99 Y99\nG01 X10 F100';
      const oldAst = parse(oldText);

      const change = makeChange(0, 0, 0);
      const result = service.tryIncrementalParse(
        oldAst,
        newText,
        oldText,
        change,
        DialectType.LINUXCNC
      );

      expect(result.success).toBe(true);
      expect(result.ast!.statements.length).toBe(2);
    });

    it('should handle editing the last line', () => {
      const oldText = 'G00 X0 Y0\nM30';
      const newText = 'G00 X0 Y0\nM02';
      const oldAst = parse(oldText);

      const change = makeChange(1, 1, 0);
      const result = service.tryIncrementalParse(
        oldAst,
        newText,
        oldText,
        change,
        DialectType.LINUXCNC
      );

      expect(result.success).toBe(true);
      expect(result.ast!.statements.length).toBe(2);
    });
  });

  describe('line insertions', () => {
    it('should handle inserting a new line', () => {
      const oldText = 'G00 X0 Y0\nM30';
      const newText = 'G00 X0 Y0\nG01 X10 F100\nM30';
      const oldAst = parse(oldText);

      // Line 1 replaced with 2 lines (lineDelta = +1)
      const change = makeChange(1, 1, 1);
      const result = service.tryIncrementalParse(
        oldAst,
        newText,
        oldText,
        change,
        DialectType.LINUXCNC
      );

      expect(result.success).toBe(true);
      expect(result.ast!.statements.length).toBe(3);

      // M30 should now be on line 2
      const m30 = result.ast!.statements[2];
      expect(m30.getRange().start.line).toBe(2);
    });
  });

  describe('line deletions', () => {
    it('should handle deleting a line', () => {
      const oldText = 'G00 X0 Y0\nG01 X10 F100\nM30';
      const newText = 'G00 X0 Y0\nM30';
      const oldAst = parse(oldText);

      // Lines 1-2 replaced with 1 line (lineDelta = -1)
      const change = makeChange(1, 2, -1);
      const result = service.tryIncrementalParse(
        oldAst,
        newText,
        oldText,
        change,
        DialectType.LINUXCNC
      );

      expect(result.success).toBe(true);
      expect(result.ast!.statements.length).toBe(2);

      // M30 should now be on line 1
      const m30 = result.ast!.statements[1];
      expect(m30.getRange().start.line).toBe(1);
    });
  });

  describe('block structure fallback', () => {
    it('should fall back to full re-parse when IF keyword is added', () => {
      const oldText = 'G00 X0 Y0\nG01 X10 F100';
      const newText = 'G00 X0 Y0\nIF [#1 GT 0]';
      const oldAst = parse(oldText);

      const change = makeChange(1, 1, 0);
      const result = service.tryIncrementalParse(
        oldAst,
        newText,
        oldText,
        change,
        DialectType.LINUXCNC
      );

      expect(result.success).toBe(false);
    });

    it('should fall back when WHILE keyword is removed', () => {
      const oldText = 'WHILE [#1 LT 10]\n#1 = [#1 + 1]\nENDWHILE';
      const newText = 'G00 X0 Y0\n#1 = [#1 + 1]\nENDWHILE';
      const oldAst = parse(oldText);

      const change = makeChange(0, 0, 0);
      const result = service.tryIncrementalParse(
        oldAst,
        newText,
        oldText,
        change,
        DialectType.LINUXCNC
      );

      expect(result.success).toBe(false);
    });

    it('should fall back when one block keyword is replaced with another', () => {
      // Replacing IF with WHILE is a structural change even though
      // both regions contain block keywords
      const oldText = 'IF [#1 LT 10]\n#1 = 5\nENDIF';
      const newText = 'WHILE [#1 LT 10]\n#1 = 5\nENDIF';
      const oldAst = parse(oldText);

      const change = makeChange(0, 0, 0);
      const result = service.tryIncrementalParse(
        oldAst,
        newText,
        oldText,
        change,
        DialectType.LINUXCNC
      );

      expect(result.success).toBe(false);
    });

    it('should allow incremental parse when editing inside a block body', () => {
      // Editing the body of a WHILE — both old and new have WHILE keyword,
      // so block structure hasn't changed
      const oldText = 'WHILE [#1 LT 10]\nG01 X10 F100\nENDWHILE';
      const newText = 'WHILE [#1 LT 10]\nG01 X20 F200\nENDWHILE';
      const oldAst = parse(oldText);

      const change = makeChange(1, 1, 0);
      const result = service.tryIncrementalParse(
        oldAst,
        newText,
        oldText,
        change,
        DialectType.LINUXCNC
      );

      // Both old and new regions have block keywords — no structural change
      expect(result.success).toBe(true);
    });
  });

  describe('empty AST', () => {
    it('should fall back to full re-parse for empty AST', () => {
      const oldText = '';
      const newText = 'G00 X0 Y0';
      const oldAst = parse(oldText);

      const change = makeChange(0, 0, 0);
      const result = service.tryIncrementalParse(
        oldAst,
        newText,
        oldText,
        change,
        DialectType.LINUXCNC
      );

      expect(result.success).toBe(false);
    });
  });

  describe('position consistency', () => {
    it('should produce the same AST as a full re-parse', () => {
      const oldText = 'G00 X0 Y0\nG01 X10 F100\nG01 X20\nG01 X30\nM30';
      const newText = 'G00 X0 Y0\nG02 X15 Y15 I5 J0 F50\nG01 X20\nG01 X30\nM30';
      const oldAst = parse(oldText);

      const change = makeChange(1, 1, 0);
      const result = service.tryIncrementalParse(
        oldAst,
        newText,
        oldText,
        change,
        DialectType.LINUXCNC
      );

      expect(result.success).toBe(true);

      // Compare with full re-parse
      const fullAst = parse(newText);
      expect(result.ast!.statements.length).toBe(fullAst.statements.length);

      // Verify all statement positions match
      for (let i = 0; i < fullAst.statements.length; i++) {
        const incRange = result.ast!.statements[i].getRange();
        const fullRange = fullAst.statements[i].getRange();
        expect(incRange.start.line).toBe(fullRange.start.line);
        expect(incRange.end.line).toBe(fullRange.end.line);
      }
    });

    it('should produce correct positions after line insertion', () => {
      const oldText = 'G00 X0 Y0\nG01 X10 F100\nM30';
      const newText = 'G00 X0 Y0\nG01 X10 F100\nG01 X20\nM30';

      const oldAst = parse(oldText);
      const change = makeChange(1, 1, 1);
      const result = service.tryIncrementalParse(
        oldAst,
        newText,
        oldText,
        change,
        DialectType.LINUXCNC
      );

      expect(result.success).toBe(true);

      const fullAst = parse(newText);
      expect(result.ast!.statements.length).toBe(fullAst.statements.length);

      for (let i = 0; i < fullAst.statements.length; i++) {
        expect(result.ast!.statements[i].getRange().start.line).toBe(
          fullAst.statements[i].getRange().start.line
        );
      }
    });
  });

  describe('dialect support', () => {
    it('should work with Fanuc dialect', () => {
      const oldText = 'G00 X0 Y0\nG01 X10 F100\nM30';
      const newText = 'G00 X0 Y0\nG01 X50 F200\nM30';
      const oldAst = parse(oldText, DialectType.FANUC);

      const change = makeChange(1, 1, 0);
      const result = service.tryIncrementalParse(
        oldAst,
        newText,
        oldText,
        change,
        DialectType.FANUC
      );

      expect(result.success).toBe(true);
      expect(result.ast!.statements.length).toBe(3);
    });
  });
});

describe('GCodeScanner offset tokenization', () => {
  it('should produce tokens with correct line offsets', () => {
    const lexer = LexerFactory.create();
    const tokens = lexer.tokenize('G01 X10 F100', {
      startLine: 5,
      startCol: 1,
      startOffset: 50,
    });

    // First token should be G01 at line 5
    const gcode = tokens.find((t) => t.value.toUpperCase() === 'G01');
    expect(gcode).toBeDefined();
    expect(gcode!.line).toBe(5);
    expect(gcode!.col).toBe(1);
    expect(gcode!.offset).toBe(50);
  });

  it('should handle multi-line text with offset', () => {
    const lexer = LexerFactory.create();
    const tokens = lexer.tokenize('G01 X10\nG02 X20', {
      startLine: 10,
      startCol: 1,
      startOffset: 100,
    });

    const g01 = tokens.find((t) => t.value.toUpperCase() === 'G01');
    const g02 = tokens.find((t) => t.value.toUpperCase() === 'G02');

    expect(g01!.line).toBe(10);
    expect(g02!.line).toBe(11);
  });
});
