import { LexerToken } from '../lexer/LexerToken';
import { TokenCategory } from '../lexer/TokenCategory';
import { KeywordType } from '../lexer/KeywordType';

describe('LexerToken', () => {
  it('should store category and keyword', () => {
    const token = new LexerToken(TokenCategory.IDENTIFIER, KeywordType.IF, 'IF', 0, 1, 1);
    expect(token.category).toBe(TokenCategory.IDENTIFIER);
    expect(token.keyword).toBe(KeywordType.IF);
    expect(token.value).toBe('IF');
  });

  it('should have null keyword for non-keyword tokens', () => {
    const token = new LexerToken(TokenCategory.NUMBER, null, '42', 0, 1, 1);
    expect(token.keyword).toBeNull();
  });

  it('hasCategory should match multiple categories', () => {
    const token = new LexerToken(TokenCategory.GCODE, null, 'G01', 0, 1, 1);
    expect(token.hasCategory(TokenCategory.GCODE, TokenCategory.MCODE)).toBe(true);
    expect(token.hasCategory(TokenCategory.NUMBER)).toBe(false);
  });

  it('hasKeyword should match keyword types', () => {
    const token = new LexerToken(TokenCategory.IDENTIFIER, KeywordType.WHILE, 'WHILE', 0, 1, 1);
    expect(token.hasKeyword(KeywordType.WHILE, KeywordType.IF)).toBe(true);
    expect(token.hasKeyword(KeywordType.IF)).toBe(false);
  });

  it('isKeyword should check exact keyword', () => {
    const token = new LexerToken(TokenCategory.IDENTIFIER, KeywordType.IF, 'if', 0, 1, 1);
    expect(token.isKeyword(KeywordType.IF)).toBe(true);
    expect(token.isKeyword(KeywordType.WHILE)).toBe(false);
  });

  it('hasKeyword returns false when keyword is null', () => {
    const token = new LexerToken(TokenCategory.NUMBER, null, '42', 0, 1, 1);
    expect(token.hasKeyword(KeywordType.IF)).toBe(false);
  });
});
