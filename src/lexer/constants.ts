import { KeywordType } from './types';

/**
 * Case-insensitive keyword lookup table.
 *
 * This is the single source of truth for which identifiers are keywords.
 * Adding a new keyword = one entry here plus one enum value in KeywordType.ts.
 * Zero parser or lexer changes required.
 */
export const KEYWORD_ENTRIES: ReadonlyArray<[string, KeywordType]> = [
  // Control flow
  ['IF', KeywordType.IF],
  ['ELSE', KeywordType.ELSE],
  ['ELSEIF', KeywordType.ELSEIF],
  ['ELSIF', KeywordType.ELSEIF], // alias: ELSIF -> ELSEIF
  ['ENDIF', KeywordType.ENDIF],
  ['THEN', KeywordType.THEN],
  ['WHILE', KeywordType.WHILE],
  ['ENDWHILE', KeywordType.ENDWHILE],
  ['DO', KeywordType.DO],
  ['END', KeywordType.END],
  ['SUB', KeywordType.SUB],
  ['ENDSUB', KeywordType.ENDSUB],
  ['CALL', KeywordType.CALL],
  ['RETURN', KeywordType.RETURN],
  ['GOTO', KeywordType.GOTO],

  // Relational operators
  ['EQ', KeywordType.EQ],
  ['NE', KeywordType.NE],
  ['LT', KeywordType.LT],
  ['GT', KeywordType.GT],
  ['LE', KeywordType.LE],
  ['GE', KeywordType.GE],
  ['AND', KeywordType.AND],
  ['OR', KeywordType.OR],
  ['XOR', KeywordType.XOR],
  ['MOD', KeywordType.MOD],

  // Functions
  ['SIN', KeywordType.SIN],
  ['COS', KeywordType.COS],
  ['TAN', KeywordType.TAN],
  ['ASIN', KeywordType.ASIN],
  ['ACOS', KeywordType.ACOS],
  ['ATAN', KeywordType.ATAN],
  ['SQRT', KeywordType.SQRT],
  ['ABS', KeywordType.ABS],
  ['ROUND', KeywordType.ROUND],
  ['FIX', KeywordType.FIX],
  ['FUP', KeywordType.FUP],
  ['LN', KeywordType.LN],
  ['EXP', KeywordType.EXP],
  ['EXISTS', KeywordType.EXISTS],
];
