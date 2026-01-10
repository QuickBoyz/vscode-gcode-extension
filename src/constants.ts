/**
 * Constants used throughout the G-code extension
 */

import { FormatterSettings } from './formatter/types';

/**
 * G-code syntax symbols
 */
export enum GCodeSymbols {
  /** Variable prefix */
  VARIABLE_PREFIX = '#',
  /** Named variable opening delimiter */
  NAMED_VAR_OPEN = '#<',
  /** Named variable closing delimiter */
  NAMED_VAR_CLOSE = '>',
  /** Computed variable opening bracket */
  COMPUTED_VAR_OPEN = '#[',
  /** Computed variable closing bracket */
  /** Assignment operator */
  ASSIGNMENT_OPERATOR = '=',
  /** Line number prefix */
  LINE_NUMBER_PREFIX = 'N',
  /** G-code prefix */
  GCODE_PREFIX = 'G',
  /** M-code prefix */
  MCODE_PREFIX = 'M',
  /** O-block prefix */
  OBLOCK_PREFIX = 'O',
  /** Program delimiter */
  PROGRAM_DELIMITER = '%',
  /** Semicolon comment prefix */
  SEMICOLON_COMMENT = ';',
  /** Comma separator */
  COMMA = ',',
  /** Dot separator */
  DOT = '.',
  /** Parenthetical comment opening */
  PARENTHETICAL_COMMENT_OPEN = '(',
  /** Parenthetical comment closing */
  PARENTHETICAL_COMMENT_CLOSE = ')',
  /** Expression bracket opening */
  EXPRESSION_BRACKET_OPEN = '[',
  /** Expression bracket closing */
  EXPRESSION_BRACKET_CLOSE = ']',
  /** Space separator */
  SPACE = ' ',
  /** Newline separator */
  NEWLINE = '\n',
  /** Tab character */
  TAB = '\t',
  /** Empty string */
  EMPTY_STRING = '',
  /** Unknown value placeholder */
  UNKNOWN_VALUE = '?',
  /** Minus/unary negation operator */
  MINUS = '-',
}

/**
 * G-code keywords
 */
export enum GCodeKeywords {
  GOTO = 'GOTO',
  WHILE = 'WHILE',
  IF = 'IF',
  THEN = 'THEN',
  ELSE = 'ELSE',
  ELSEIF = 'ELSEIF',
  ENDIF = 'ENDIF',
  END = 'END',
  DO = 'DO',
}

/**
 * Default values
 */
export const DEFAULTS = {
  /** Default line number start */
  LINE_NUMBER_START: 10,
  /** Default line number increment */
  LINE_NUMBER_INCREMENT: 10,
  /** Default indent size */
  INDENT_SIZE: 2,
  /** Minimum indent level */
  MIN_INDENT_LEVEL: 0,
} as const;

/**
 * Regex patterns for G-code parsing
 */
export const REGEX_PATTERNS = {
  /** Matches numeric variables: #123 */
  NUMERIC_VARIABLE: /#(\d+)/,
  NUMERIC_VARIABLE_NO_CAPTURE: /#\d+/,
  /** Matches named variables: #<name> */
  NAMED_VARIABLE: /#<([a-zA-Z_][a-zA-Z0-9_]*)>/,
  NAMED_VARIABLE_NO_CAPTURE: /#<[a-zA-Z_][a-zA-Z0-9_]*>/,
  /** Matches line numbers: N123 */
  LINE_NUMBER: /[Nn]\d+/,
  /** Matches O-block labels: O123 */
  OBLOCK_LABEL: /[Oo]\d+/,
  /** Matches G-code commands: G123 */
  GCODE_COMMAND: /[Gg]\d+(?:\.\d+)?/,
  /** Matches M-code commands: M123 */
  MCODE_COMMAND: /[Mm]\d+/,
  /** Regex special characters that need escaping */
  REGEX_SPECIAL_CHARS: /[.*+?^${}()|[\]\\]/,
  /** Word boundary for regex */
  WORD_BOUNDARY: '\\b',
  /** Newline pattern (CRLF or LF) */
  NEWLINE: /\r?\n/,
  /** Valid named variable name pattern */
  VALID_NAMED_VARIABLE: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
  /** Valid numeric variable pattern */
  VALID_NUMERIC_VARIABLE: /^\d+$/,
  /** Matches numbers: 123.456 */
  NUMBER: /\d+\.?\d*|\.\d+/,
  /** Matches parameter letters: A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z */
  PARAMETER_LETTER: /[a-zA-Z]/,
  /** Matches comments: ; comment */
  COMMENT: /;.*/,
  /** Matches parenthetical comments: (comment) */
  PARENTHETICAL_COMMENT: /\([^)]*\)/,
} as const;

/**
 * Default formatter options
 */
export const DEFAULT_FORMATTER_SETTINGS: FormatterSettings = {
  addLineNumbers: false,
  lineNumberStart: DEFAULTS.LINE_NUMBER_START,
  lineNumberIncrement: DEFAULTS.LINE_NUMBER_INCREMENT,
  prettyPrintCommands: true,
  prettyPrintNumbers: true,
  indentSize: DEFAULTS.INDENT_SIZE,
  useTabs: false,
  indent: true,
  compactOutput: false,
  addProgramDelimiters: true,
};
