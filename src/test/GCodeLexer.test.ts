import { GCodeLexer } from '../lexer/GCodeLexer';
import { KeywordType, TokenCategory } from '../lexer/types';

describe('GCodeLexer', () => {
  const lexer = new GCodeLexer();

  describe('whitespace tokens', () => {
    it('should emit WS tokens', () => {
      const tokens = lexer.tokenize('G01 X10');
      const wsTokens = tokens.filter((t) => t.category === TokenCategory.WS);
      expect(wsTokens.length).toBeGreaterThan(0);
    });

    it('should emit NL tokens', () => {
      const tokens = lexer.tokenize('G01\nG02');
      const nlTokens = tokens.filter((t) => t.category === TokenCategory.NL);
      expect(nlTokens).toHaveLength(1);
    });

    it('should handle CRLF newlines', () => {
      const tokens = lexer.tokenize('G01\r\nG02');
      const nlTokens = tokens.filter((t) => t.category === TokenCategory.NL);
      expect(nlTokens).toHaveLength(1);
      expect(nlTokens[0].lineBreaks).toBe(1);
    });
  });

  describe('keyword extensibility', () => {
    it('should classify keywords via lookup table', () => {
      const tokens = lexer.tokenize('IF WHILE ABS SIN EQ');
      const keywords = tokens.filter((t) => t.keyword !== null);
      expect(keywords).toHaveLength(5);
      expect(keywords[0].keyword).toBe(KeywordType.IF);
      expect(keywords[1].keyword).toBe(KeywordType.WHILE);
      expect(keywords[2].keyword).toBe(KeywordType.ABS);
      expect(keywords[3].keyword).toBe(KeywordType.SIN);
      expect(keywords[4].keyword).toBe(KeywordType.EQ);
    });

    it('should handle case-insensitive keywords', () => {
      const tokens = lexer.tokenize('if While abs');
      const keywords = tokens.filter((t) => t.keyword !== null);
      expect(keywords[0].keyword).toBe(KeywordType.IF);
      expect(keywords[1].keyword).toBe(KeywordType.WHILE);
      expect(keywords[2].keyword).toBe(KeywordType.ABS);
    });

    it('should handle DO/END with trailing digits', () => {
      const tokens = lexer.tokenize('DO0 END5');
      const doToken = tokens.find((t) => t.keyword === KeywordType.DO);
      const endToken = tokens.find((t) => t.keyword === KeywordType.END);
      expect(doToken).toBeDefined();
      expect(doToken?.value).toBe('DO0');
      expect(endToken).toBeDefined();
      expect(endToken?.value).toBe('END5');
    });

    it('should classify all control flow keywords', () => {
      const tokens = lexer.tokenize('IF ELSE ELSEIF ENDIF THEN WHILE ENDWHILE DO END GOTO');
      const keywords = tokens.filter((t) => t.keyword !== null).map((t) => t.keyword);
      expect(keywords).toEqual([
        KeywordType.IF,
        KeywordType.ELSE,
        KeywordType.ELSEIF,
        KeywordType.ENDIF,
        KeywordType.THEN,
        KeywordType.WHILE,
        KeywordType.ENDWHILE,
        KeywordType.DO,
        KeywordType.END,
        KeywordType.GOTO,
      ]);
    });

    it('should classify all relational operator keywords', () => {
      const tokens = lexer.tokenize('EQ NE LT GT LE GE AND OR XOR MOD');
      const keywords = tokens.filter((t) => t.keyword !== null).map((t) => t.keyword);
      expect(keywords).toEqual([
        KeywordType.EQ,
        KeywordType.NE,
        KeywordType.LT,
        KeywordType.GT,
        KeywordType.LE,
        KeywordType.GE,
        KeywordType.AND,
        KeywordType.OR,
        KeywordType.XOR,
        KeywordType.MOD,
      ]);
    });

    it('should classify all function keywords', () => {
      const tokens = lexer.tokenize(
        'SIN COS TAN ASIN ACOS ATAN SQRT ABS ROUND FIX FUP LN EXP EXISTS'
      );
      const keywords = tokens.filter((t) => t.keyword !== null).map((t) => t.keyword);
      expect(keywords).toEqual([
        KeywordType.SIN,
        KeywordType.COS,
        KeywordType.TAN,
        KeywordType.ASIN,
        KeywordType.ACOS,
        KeywordType.ATAN,
        KeywordType.SQRT,
        KeywordType.ABS,
        KeywordType.ROUND,
        KeywordType.FIX,
        KeywordType.FUP,
        KeywordType.LN,
        KeywordType.EXP,
        KeywordType.EXISTS,
      ]);
    });
  });

  describe('no MINUS+NUMBER combining', () => {
    it('should emit MINUS and NUMBER as separate tokens', () => {
      const tokens = lexer.tokenize('-5');
      const nonWs = tokens.filter((t) => t.category !== TokenCategory.WS);
      expect(nonWs).toHaveLength(2);
      expect(nonWs[0].category).toBe(TokenCategory.MINUS);
      expect(nonWs[1].category).toBe(TokenCategory.NUMBER);
    });

    it('should handle negative axis values correctly', () => {
      const tokens = lexer.tokenize('X-10');
      const nonWs = tokens.filter((t) => t.category !== TokenCategory.WS);
      expect(nonWs).toHaveLength(3);
      expect(nonWs[0].category).toBe(TokenCategory.PARAM);
      expect(nonWs[1].category).toBe(TokenCategory.MINUS);
      expect(nonWs[2].category).toBe(TokenCategory.NUMBER);
    });
  });

  describe('G/M codes', () => {
    it('should tokenize G-codes with decimal points', () => {
      const tokens = lexer.tokenize('G51.2');
      const gcode = tokens.find((t) => t.category === TokenCategory.GCODE);
      expect(gcode).toBeDefined();
      expect(gcode?.value).toBe('G51.2');
    });

    it('should tokenize simple G-codes', () => {
      const tokens = lexer.tokenize('G00 G01 G02 G03');
      const gcodes = tokens.filter((t) => t.category === TokenCategory.GCODE);
      expect(gcodes).toHaveLength(4);
      expect(gcodes.map((t) => t.value)).toEqual(['G00', 'G01', 'G02', 'G03']);
    });

    it('should tokenize M-codes', () => {
      const tokens = lexer.tokenize('M03 M05 M30');
      const mcodes = tokens.filter((t) => t.category === TokenCategory.MCODE);
      expect(mcodes).toHaveLength(3);
    });
  });

  describe('variables', () => {
    it('should tokenize named variables', () => {
      const tokens = lexer.tokenize('#<tool_radius>');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.VARIABLE);
      expect(tokens[0].value).toBe('#<tool_radius>');
    });

    it('should tokenize numeric variables', () => {
      const tokens = lexer.tokenize('#5410');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.VARIABLE);
      expect(tokens[0].value).toBe('#5410');
    });

    it('should tokenize computed variable prefix', () => {
      const tokens = lexer.tokenize('#[1 + 2]');
      expect(tokens[0].category).toBe(TokenCategory.HASH);
      expect(tokens[1].category).toBe(TokenCategory.LBRACKET);
    });
  });

  describe('comments', () => {
    it('should tokenize semicolon comments', () => {
      const tokens = lexer.tokenize('; this is a comment');
      const comment = tokens.find((t) => t.category === TokenCategory.COMMENT);
      expect(comment).toBeDefined();
      expect(comment?.value).toBe('; this is a comment');
    });

    it('should tokenize parenthetical comments', () => {
      const tokens = lexer.tokenize('(tool change)');
      const comment = tokens.find((t) => t.category === TokenCategory.PAREN_COMMENT);
      expect(comment).toBeDefined();
      expect(comment?.value).toBe('(tool change)');
    });
  });

  describe('position tracking', () => {
    it('should track line and column correctly', () => {
      const tokens = lexer.tokenize('G01\nX10');
      const xToken = tokens.find((t) => t.category === TokenCategory.PARAM && t.value === 'X');
      expect(xToken).toBeDefined();
      expect(xToken?.line).toBe(2);
      expect(xToken?.col).toBe(1);
    });

    it('should track offset correctly', () => {
      const tokens = lexer.tokenize('G01 X10');
      const xToken = tokens.find((t) => t.category === TokenCategory.PARAM && t.value === 'X');
      expect(xToken).toBeDefined();
      expect(xToken?.offset).toBe(4);
    });

    it('should track positions across multiple lines', () => {
      const tokens = lexer.tokenize('G01\nG02\nX10');
      const xToken = tokens.find((t) => t.category === TokenCategory.PARAM && t.value === 'X');
      expect(xToken).toBeDefined();
      expect(xToken?.line).toBe(3);
      expect(xToken?.col).toBe(1);
    });
  });

  describe('complete program tokenization', () => {
    it('should tokenize a full G-code program', () => {
      const program = `%
; Tool setup
#<depth> = -17
G00 X0 Y0
O100 WHILE [#<i> LT 10] DO
  G01 X#<i> F1000
O100 ENDWHILE
M30
%`;
      const tokens = lexer.tokenize(program);
      expect(tokens.length).toBeGreaterThan(0);

      // Verify key token types are present
      const categories = new Set(tokens.map((t) => t.category));
      expect(categories.has(TokenCategory.PERCENT)).toBe(true);
      expect(categories.has(TokenCategory.COMMENT)).toBe(true);
      expect(categories.has(TokenCategory.VARIABLE)).toBe(true);
      expect(categories.has(TokenCategory.GCODE)).toBe(true);
      expect(categories.has(TokenCategory.MCODE)).toBe(true);
      expect(categories.has(TokenCategory.OSUB)).toBe(true);
      expect(categories.has(TokenCategory.PARAM)).toBe(true);
      expect(categories.has(TokenCategory.NUMBER)).toBe(true);

      // Verify keywords are present
      const keywords = new Set(tokens.filter((t) => t.keyword !== null).map((t) => t.keyword));
      expect(keywords.has(KeywordType.WHILE)).toBe(true);
      expect(keywords.has(KeywordType.LT)).toBe(true);
      expect(keywords.has(KeywordType.DO)).toBe(true);
      expect(keywords.has(KeywordType.ENDWHILE)).toBe(true);
    });
  });

  describe('ELSIF alias', () => {
    it('should map ELSIF to ELSEIF keyword', () => {
      const tokens = lexer.tokenize('ELSIF');
      const keyword = tokens.find((t) => t.keyword !== null);
      expect(keyword).toBeDefined();
      expect(keyword?.keyword).toBe(KeywordType.ELSEIF);
    });
  });

  describe('parameters vs identifiers', () => {
    it('should tokenize single letters as PARAM when followed by number', () => {
      const tokens = lexer.tokenize('X10 Y20 Z5');
      const params = tokens.filter((t) => t.category === TokenCategory.PARAM);
      expect(params).toHaveLength(3);
      expect(params.map((t) => t.value)).toEqual(['X', 'Y', 'Z']);
    });

    it('should tokenize multi-letter words as IDENTIFIER', () => {
      const tokens = lexer.tokenize('GOTO');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.IDENTIFIER);
      expect(tokens[0].keyword).toBe(KeywordType.GOTO);
    });
  });

  describe('O-block labels', () => {
    it('should tokenize O-blocks', () => {
      const tokens = lexer.tokenize('O100 O200');
      const osubs = tokens.filter((t) => t.category === TokenCategory.OSUB);
      expect(osubs).toHaveLength(2);
      expect(osubs.map((t) => t.value)).toEqual(['O100', 'O200']);
    });
  });

  describe('line numbers', () => {
    it('should tokenize line numbers', () => {
      const tokens = lexer.tokenize('N10 G01 X5');
      const lineNum = tokens.find((t) => t.category === TokenCategory.LINE_NUMBER);
      expect(lineNum).toBeDefined();
      expect(lineNum?.value).toBe('N10');
    });
  });
});
