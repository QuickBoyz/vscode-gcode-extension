/**
 * Structural token categories.
 *
 * These classify a token's syntactic role in the G-code stream.
 * They describe *what* a token is (a number, an identifier, a bracket)
 * independent of its semantic meaning.
 */
export enum TokenCategory {
  NUMBER = 'NUMBER',
  IDENTIFIER = 'IDENTIFIER',
  GCODE = 'GCODE',
  MCODE = 'MCODE',
  OSUB = 'OSUB',
  VARIABLE = 'VARIABLE',
  PARAM = 'PARAM',
  COMMENT = 'COMMENT',
  PAREN_COMMENT = 'PAREN_COMMENT',
  LINE_NUMBER = 'LINE_NUMBER',
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  STAR = 'STAR',
  SLASH = 'SLASH',
  EQUALS = 'EQUALS',
  COMMA = 'COMMA',
  DOT = 'DOT',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  HASH = 'HASH',
  PERCENT = 'PERCENT',
  WS = 'WS',
  NL = 'NL',
}
