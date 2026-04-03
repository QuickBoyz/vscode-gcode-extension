import { DialectType } from '../constants';
import { KeywordType } from './types';

/**
 * Relational and logical operator keywords shared across all dialects.
 */
const RELATIONAL_OPERATOR_ENTRIES: ReadonlyArray<[string, KeywordType]> = [
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
];

/**
 * Built-in function keywords shared across all dialects.
 */
const FUNCTION_ENTRIES: ReadonlyArray<[string, KeywordType]> = [
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
];

/**
 * Core control flow keywords shared across all dialects.
 *
 * All dialects support IF/WHILE blocks via BaseParser, so the lexer
 * must recognise these keywords regardless of dialect. Dialect-specific
 * subroutine keywords (SUB/ENDSUB, PROC/RET, M98/M99) are added below.
 */
const CONTROL_FLOW_ENTRIES: ReadonlyArray<[string, KeywordType]> = [
  ['IF', KeywordType.IF],
  ['ELSE', KeywordType.ELSE],
  ['ELSEIF', KeywordType.ELSEIF],
  ['ELSIF', KeywordType.ELSEIF], // alias
  ['ENDIF', KeywordType.ENDIF],
  ['THEN', KeywordType.THEN],
  ['WHILE', KeywordType.WHILE],
  ['ENDWHILE', KeywordType.ENDWHILE],
  ['DO', KeywordType.DO],
  ['END', KeywordType.END],
  ['GOTO', KeywordType.GOTO],
];

/**
 * LinuxCNC keyword entries.
 *
 * LinuxCNC supports the full keyword set including O-block subroutine
 * keywords (SUB, ENDSUB), named labels, and the EXISTS function.
 */
export const LINUXCNC_KEYWORDS: ReadonlyArray<[string, KeywordType]> = [
  ...CONTROL_FLOW_ENTRIES,
  // O-block subroutine keywords
  ['SUB', KeywordType.SUB],
  ['ENDSUB', KeywordType.ENDSUB],
  ['CALL', KeywordType.CALL],
  ['RETURN', KeywordType.RETURN],
  // Relational operators
  ...RELATIONAL_OPERATOR_ENTRIES,
  // Functions (including EXISTS for LinuxCNC)
  ...FUNCTION_ENTRIES,
  ['EXISTS', KeywordType.EXISTS],
];

/**
 * Fanuc keyword entries.
 *
 * Fanuc does not use O-block subroutine keywords (SUB, ENDSUB).
 * Subroutines are separate programs called via M98/M99.
 */
export const FANUC_KEYWORDS: ReadonlyArray<[string, KeywordType]> = [
  ...CONTROL_FLOW_ENTRIES,
  // Relational operators
  ...RELATIONAL_OPERATOR_ENTRIES,
  // Functions (no EXISTS)
  ...FUNCTION_ENTRIES,
];

/**
 * Haas keyword entries.
 *
 * Haas is Fanuc-compatible and uses the same keyword set.
 */
export const HAAS_KEYWORDS: ReadonlyArray<[string, KeywordType]> = [...FANUC_KEYWORDS];

/**
 * Siemens keyword entries.
 *
 * Siemens supports PROC/RET for subroutines, CALL for invocation.
 * Does not use O-block keywords (SUB, ENDSUB).
 */
export const SIEMENS_KEYWORDS: ReadonlyArray<[string, KeywordType]> = [
  ...CONTROL_FLOW_ENTRIES,
  // Subroutine keywords
  ['PROC', KeywordType.PROC],
  ['RET', KeywordType.RET],
  ['CALL', KeywordType.CALL],
  ['RETURN', KeywordType.RETURN],
  // Relational operators
  ...RELATIONAL_OPERATOR_ENTRIES,
  // Functions (no EXISTS)
  ...FUNCTION_ENTRIES,
];

/**
 * Returns the keyword entries for the given dialect.
 *
 * Each dialect has its own set of recognized keywords. The scanner uses
 * this to build its keyword map, ensuring that unsupported keywords for
 * a given dialect are treated as plain identifiers.
 *
 * @param dialect - The G-code dialect to get keywords for
 * @returns The keyword lookup entries for the dialect
 */
export function getKeywordEntries(
  dialect: DialectType = DialectType.LINUXCNC
): ReadonlyArray<[string, KeywordType]> {
  switch (dialect) {
    case DialectType.FANUC:
      return FANUC_KEYWORDS;
    case DialectType.HAAS:
      return HAAS_KEYWORDS;
    case DialectType.SIEMENS:
      return SIEMENS_KEYWORDS;
    case DialectType.LINUXCNC:
    default:
      return LINUXCNC_KEYWORDS;
  }
}
