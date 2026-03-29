/**
 * Semantic keyword classification.
 *
 * These classify the *meaning* of an identifier token. A token with
 * category IDENTIFIER is looked up in the keyword table; if found,
 * it receives one of these values. Otherwise keyword is null.
 *
 * Adding a new keyword requires only adding an entry here and in
 * KeywordTable.ts -- zero other file changes.
 */
export enum KeywordType {
  // Control flow
  IF = 'IF',
  ELSE = 'ELSE',
  ELSEIF = 'ELSEIF',
  ENDIF = 'ENDIF',
  THEN = 'THEN',
  WHILE = 'WHILE',
  ENDWHILE = 'ENDWHILE',
  DO = 'DO',
  END = 'END',
  SUB = 'SUB',
  ENDSUB = 'ENDSUB',
  CALL = 'CALL',
  RETURN = 'RETURN',
  GOTO = 'GOTO',

  // Relational operators
  EQ = 'EQ',
  NE = 'NE',
  LT = 'LT',
  GT = 'GT',
  LE = 'LE',
  GE = 'GE',
  AND = 'AND',
  OR = 'OR',
  XOR = 'XOR',
  MOD = 'MOD',

  // Functions
  SIN = 'SIN',
  COS = 'COS',
  TAN = 'TAN',
  ASIN = 'ASIN',
  ACOS = 'ACOS',
  ATAN = 'ATAN',
  SQRT = 'SQRT',
  ABS = 'ABS',
  ROUND = 'ROUND',
  FIX = 'FIX',
  FUP = 'FUP',
  LN = 'LN',
  EXP = 'EXP',
  EXISTS = 'EXISTS',
}
