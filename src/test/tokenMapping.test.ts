import { toLegacyTokenType, toLegacyToken } from '../lexer/tokenMapping';
import { TokenCategory } from '../lexer/TokenCategory';
import { KeywordType } from '../lexer/KeywordType';
import { LexerToken } from '../lexer/LexerToken';
import { TokenType } from '../parser/nodes/tokens';

describe('tokenMapping', () => {
  describe('toLegacyTokenType', () => {
    it('maps control flow keywords to their TokenType', () => {
      expect(toLegacyTokenType(TokenCategory.IDENTIFIER, KeywordType.IF)).toBe(TokenType.IF);
      expect(toLegacyTokenType(TokenCategory.IDENTIFIER, KeywordType.WHILE)).toBe(TokenType.WHILE);
      expect(toLegacyTokenType(TokenCategory.IDENTIFIER, KeywordType.ENDIF)).toBe(TokenType.ENDIF);
      expect(toLegacyTokenType(TokenCategory.IDENTIFIER, KeywordType.DO)).toBe(TokenType.DO);
      expect(toLegacyTokenType(TokenCategory.IDENTIFIER, KeywordType.END)).toBe(TokenType.END);
      expect(toLegacyTokenType(TokenCategory.IDENTIFIER, KeywordType.GOTO)).toBe(TokenType.GOTO);
    });

    it('maps relational keywords to RELOP', () => {
      expect(toLegacyTokenType(TokenCategory.IDENTIFIER, KeywordType.EQ)).toBe(TokenType.RELOP);
      expect(toLegacyTokenType(TokenCategory.IDENTIFIER, KeywordType.LT)).toBe(TokenType.RELOP);
      expect(toLegacyTokenType(TokenCategory.IDENTIFIER, KeywordType.AND)).toBe(TokenType.RELOP);
      expect(toLegacyTokenType(TokenCategory.IDENTIFIER, KeywordType.OR)).toBe(TokenType.RELOP);
    });

    it('maps function keywords to FUNC', () => {
      expect(toLegacyTokenType(TokenCategory.IDENTIFIER, KeywordType.ABS)).toBe(TokenType.FUNC);
      expect(toLegacyTokenType(TokenCategory.IDENTIFIER, KeywordType.SIN)).toBe(TokenType.FUNC);
      expect(toLegacyTokenType(TokenCategory.IDENTIFIER, KeywordType.SQRT)).toBe(TokenType.FUNC);
    });

    it('maps categories without keywords', () => {
      expect(toLegacyTokenType(TokenCategory.NUMBER, null)).toBe(TokenType.NUMBER);
      expect(toLegacyTokenType(TokenCategory.GCODE, null)).toBe(TokenType.GCODE);
      expect(toLegacyTokenType(TokenCategory.VARIABLE, null)).toBe(TokenType.VAR);
      expect(toLegacyTokenType(TokenCategory.PAREN_COMMENT, null)).toBe(TokenType.PARENCOMMENT);
      expect(toLegacyTokenType(TokenCategory.LINE_NUMBER, null)).toBe(TokenType.LineNumber);
    });
  });

  describe('toLegacyToken', () => {
    it('converts a LexerToken to a Token with correct fields', () => {
      const lexerToken = new LexerToken(TokenCategory.NUMBER, null, '42', 5, 2, 3);
      const legacy = toLegacyToken(lexerToken);
      expect(legacy.type).toBe(TokenType.NUMBER);
      expect(legacy.value).toBe('42');
      expect(legacy.offset).toBe(5);
      expect(legacy.line).toBe(2);
      expect(legacy.col).toBe(3);
    });

    it('converts a keyword LexerToken to a Token', () => {
      const lexerToken = new LexerToken(TokenCategory.IDENTIFIER, KeywordType.IF, 'IF', 0, 1, 1);
      const legacy = toLegacyToken(lexerToken);
      expect(legacy.type).toBe(TokenType.IF);
      expect(legacy.value).toBe('IF');
    });
  });
});
