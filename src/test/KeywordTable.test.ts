import { lookupKeyword } from '../lexer/KeywordTable';
import { KeywordType } from '../lexer/KeywordType';

describe('KeywordTable', () => {
  it('should find control flow keywords case-insensitively', () => {
    expect(lookupKeyword('IF')).toBe(KeywordType.IF);
    expect(lookupKeyword('if')).toBe(KeywordType.IF);
    expect(lookupKeyword('If')).toBe(KeywordType.IF);
    expect(lookupKeyword('WHILE')).toBe(KeywordType.WHILE);
    expect(lookupKeyword('while')).toBe(KeywordType.WHILE);
  });

  it('should find relational operators', () => {
    expect(lookupKeyword('EQ')).toBe(KeywordType.EQ);
    expect(lookupKeyword('eq')).toBe(KeywordType.EQ);
    expect(lookupKeyword('NE')).toBe(KeywordType.NE);
    expect(lookupKeyword('LT')).toBe(KeywordType.LT);
    expect(lookupKeyword('GT')).toBe(KeywordType.GT);
    expect(lookupKeyword('LE')).toBe(KeywordType.LE);
    expect(lookupKeyword('GE')).toBe(KeywordType.GE);
  });

  it('should find function keywords', () => {
    expect(lookupKeyword('SIN')).toBe(KeywordType.SIN);
    expect(lookupKeyword('sin')).toBe(KeywordType.SIN);
    expect(lookupKeyword('ABS')).toBe(KeywordType.ABS);
    expect(lookupKeyword('SQRT')).toBe(KeywordType.SQRT);
  });

  it('should return null for unknown identifiers', () => {
    expect(lookupKeyword('XYZZY')).toBeNull();
    expect(lookupKeyword('G01')).toBeNull();
    expect(lookupKeyword('')).toBeNull();
  });

  it('should handle ELSIF alias', () => {
    expect(lookupKeyword('ELSIF')).toBe(KeywordType.ELSEIF);
    expect(lookupKeyword('ELSEIF')).toBe(KeywordType.ELSEIF);
  });
});
