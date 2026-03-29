import { GCodeScanner } from '../lexer/GCodeScanner';
import { KeywordType } from '../lexer/KeywordType';
import { TokenCategory } from '../lexer/TokenCategory';

describe('GCodeScanner', () => {
  const scanner = new GCodeScanner();

  describe('single-character operators', () => {
    it('should tokenize all single-character operators', () => {
      const tokens = scanner.tokenize('+-*/=,.[]#%');
      expect(tokens).toHaveLength(11);
      expect(tokens[0].category).toBe(TokenCategory.PLUS);
      expect(tokens[1].category).toBe(TokenCategory.MINUS);
      expect(tokens[2].category).toBe(TokenCategory.STAR);
      expect(tokens[3].category).toBe(TokenCategory.SLASH);
      expect(tokens[4].category).toBe(TokenCategory.EQUALS);
      expect(tokens[5].category).toBe(TokenCategory.COMMA);
      expect(tokens[6].category).toBe(TokenCategory.DOT);
      expect(tokens[7].category).toBe(TokenCategory.LBRACKET);
      expect(tokens[8].category).toBe(TokenCategory.RBRACKET);
      expect(tokens[9].category).toBe(TokenCategory.HASH);
      expect(tokens[10].category).toBe(TokenCategory.PERCENT);
    });
  });

  describe('whitespace', () => {
    it('should emit WS tokens for spaces and tabs', () => {
      const tokens = scanner.tokenize('  \t');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.WS);
      expect(tokens[0].value).toBe('  \t');
    });
  });

  describe('newlines', () => {
    it('should tokenize LF newline', () => {
      const tokens = scanner.tokenize('\n');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.NL);
      expect(tokens[0].lineBreaks).toBe(1);
    });

    it('should tokenize CRLF newline', () => {
      const tokens = scanner.tokenize('\r\n');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.NL);
      expect(tokens[0].lineBreaks).toBe(1);
    });
  });

  describe('numbers', () => {
    it('should tokenize integers', () => {
      const tokens = scanner.tokenize('123');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.NUMBER);
      expect(tokens[0].value).toBe('123');
    });

    it('should tokenize decimal numbers', () => {
      const tokens = scanner.tokenize('45.67');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.NUMBER);
      expect(tokens[0].value).toBe('45.67');
    });

    it('should tokenize leading decimal', () => {
      const tokens = scanner.tokenize('.5');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.NUMBER);
      expect(tokens[0].value).toBe('.5');
    });

    it('should tokenize number with trailing dot', () => {
      const tokens = scanner.tokenize('0.123');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.NUMBER);
      expect(tokens[0].value).toBe('0.123');
    });
  });

  describe('G/M codes', () => {
    it('should tokenize G-codes', () => {
      const tokens = scanner.tokenize('G01');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.GCODE);
      expect(tokens[0].value).toBe('G01');
    });

    it('should tokenize case-insensitive G-codes', () => {
      const tokens = scanner.tokenize('g01');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.GCODE);
      expect(tokens[0].value).toBe('g01');
    });

    it('should tokenize G-codes with decimal points', () => {
      const tokens = scanner.tokenize('G51.2');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.GCODE);
      expect(tokens[0].value).toBe('G51.2');
    });

    it('should tokenize M-codes', () => {
      const tokens = scanner.tokenize('M03');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.MCODE);
      expect(tokens[0].value).toBe('M03');
    });

    it('should tokenize lowercase M-codes', () => {
      const tokens = scanner.tokenize('m30');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.MCODE);
      expect(tokens[0].value).toBe('m30');
    });
  });

  describe('O-blocks', () => {
    it('should tokenize O-blocks', () => {
      const tokens = scanner.tokenize('O100');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.OSUB);
      expect(tokens[0].value).toBe('O100');
    });

    it('should tokenize lowercase O-blocks', () => {
      const tokens = scanner.tokenize('o200');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.OSUB);
      expect(tokens[0].value).toBe('o200');
    });
  });

  describe('line numbers', () => {
    it('should tokenize line numbers', () => {
      const tokens = scanner.tokenize('N100');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.LINE_NUMBER);
      expect(tokens[0].value).toBe('N100');
    });

    it('should tokenize lowercase line numbers', () => {
      const tokens = scanner.tokenize('n50');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.LINE_NUMBER);
      expect(tokens[0].value).toBe('n50');
    });
  });

  describe('parameters', () => {
    it('should tokenize single uppercase letter as PARAM', () => {
      const tokens = scanner.tokenize('X');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.PARAM);
      expect(tokens[0].value).toBe('X');
    });

    it('should not match multi-letter identifiers as PARAM', () => {
      const tokens = scanner.tokenize('IF');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.IDENTIFIER);
      expect(tokens[0].keyword).toBe(KeywordType.IF);
    });
  });

  describe('variables', () => {
    it('should tokenize numeric variables', () => {
      const tokens = scanner.tokenize('#100');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.VARIABLE);
      expect(tokens[0].value).toBe('#100');
    });

    it('should tokenize named variables', () => {
      const tokens = scanner.tokenize('#<name>');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.VARIABLE);
      expect(tokens[0].value).toBe('#<name>');
    });

    it('should tokenize bare hash as HASH', () => {
      const tokens = scanner.tokenize('#');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.HASH);
      expect(tokens[0].value).toBe('#');
    });
  });

  describe('identifiers and keywords', () => {
    it('should tokenize keywords with correct KeywordType', () => {
      const tokens = scanner.tokenize('IF');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.IDENTIFIER);
      expect(tokens[0].keyword).toBe(KeywordType.IF);
    });

    it('should handle case-insensitive keywords', () => {
      const tokens = scanner.tokenize('while');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].keyword).toBe(KeywordType.WHILE);
    });

    it('should tokenize unknown identifiers with null keyword', () => {
      const tokens = scanner.tokenize('XYZZY');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.IDENTIFIER);
      expect(tokens[0].keyword).toBeNull();
    });

    it('should handle DO with trailing digits', () => {
      const tokens = scanner.tokenize('DO0');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.IDENTIFIER);
      expect(tokens[0].keyword).toBe(KeywordType.DO);
      expect(tokens[0].value).toBe('DO0');
    });

    it('should handle END with trailing digits', () => {
      const tokens = scanner.tokenize('END5');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.IDENTIFIER);
      expect(tokens[0].keyword).toBe(KeywordType.END);
      expect(tokens[0].value).toBe('END5');
    });

    it('should handle ELSEIF and ELSIF alias', () => {
      const tokens1 = scanner.tokenize('ELSEIF');
      expect(tokens1[0].keyword).toBe(KeywordType.ELSEIF);

      const tokens2 = scanner.tokenize('ELSIF');
      expect(tokens2[0].keyword).toBe(KeywordType.ELSEIF);
    });

    it('should tokenize function names as keywords', () => {
      const tokens = scanner.tokenize('ABS');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].keyword).toBe(KeywordType.ABS);
    });
  });

  describe('comments', () => {
    it('should tokenize semicolon comments', () => {
      const tokens = scanner.tokenize('; hello world');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.COMMENT);
      expect(tokens[0].value).toBe('; hello world');
    });

    it('should tokenize parenthetical comments', () => {
      const tokens = scanner.tokenize('(a comment)');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.PAREN_COMMENT);
      expect(tokens[0].value).toBe('(a comment)');
    });
  });

  describe('whitespace is emitted', () => {
    it('should emit whitespace tokens between other tokens', () => {
      const tokens = scanner.tokenize('G01 X10');
      expect(tokens).toHaveLength(4);
      expect(tokens[0].category).toBe(TokenCategory.GCODE);
      expect(tokens[1].category).toBe(TokenCategory.WS);
      expect(tokens[2].category).toBe(TokenCategory.PARAM);
      expect(tokens[3].category).toBe(TokenCategory.NUMBER);
    });
  });

  describe('MINUS and NUMBER are separate', () => {
    it('should emit MINUS and NUMBER as separate tokens', () => {
      const tokens = scanner.tokenize('-5');
      expect(tokens).toHaveLength(2);
      expect(tokens[0].category).toBe(TokenCategory.MINUS);
      expect(tokens[1].category).toBe(TokenCategory.NUMBER);
    });
  });

  describe('line and column tracking', () => {
    it('should track positions correctly', () => {
      const tokens = scanner.tokenize('G01');
      expect(tokens[0].line).toBe(1);
      expect(tokens[0].col).toBe(1);
      expect(tokens[0].offset).toBe(0);
    });

    it('should track positions across newlines', () => {
      const tokens = scanner.tokenize('G01\nX10');
      const xToken = tokens.find((t) => t.category === TokenCategory.PARAM && t.value === 'X');
      expect(xToken).toBeDefined();
      expect(xToken!.line).toBe(2);
      expect(xToken!.col).toBe(1);
    });
  });

  describe('complete line tokenization', () => {
    it('should tokenize a full G-code line', () => {
      const tokens = scanner.tokenize('G01 X10.5 Y-20 ; comment\n');
      const categories = tokens.map((t) => t.category);
      expect(categories).toEqual([
        TokenCategory.GCODE, // G01
        TokenCategory.WS, // ' '
        TokenCategory.PARAM, // X
        TokenCategory.NUMBER, // 10.5
        TokenCategory.WS, // ' '
        TokenCategory.PARAM, // Y
        TokenCategory.MINUS, // -
        TokenCategory.NUMBER, // 20
        TokenCategory.WS, // ' '
        TokenCategory.COMMENT, // ; comment
        TokenCategory.NL, // \n
      ]);
    });
  });

  describe('DOT not followed by digit', () => {
    it('should emit DOT token', () => {
      const tokens = scanner.tokenize('.');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].category).toBe(TokenCategory.DOT);
    });
  });
});
