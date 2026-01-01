/**
 * Constants used throughout the G-code extension
 */

import { CommandType } from "./entities/statements";
import { FormatterOptions } from "./formatter/types";

/**
 * G-code syntax symbols
 */
export const GCODE_SYMBOLS: Record<string, string> = {
  /** Variable prefix */
  VARIABLE_PREFIX: "#",
  /** Named variable opening delimiter */
  NAMED_VAR_OPEN: "#<",
  /** Named variable closing delimiter */
  NAMED_VAR_CLOSE: ">",
  /** Computed variable opening bracket */
  COMPUTED_VAR_OPEN: "#[",
  /** Computed variable closing bracket */
  COMPUTED_VAR_CLOSE: "]",
  /** Assignment operator */
  ASSIGNMENT_OPERATOR: "=",
  /** Line number prefix */
  LINE_NUMBER_PREFIX: "N",
  /** G-code prefix */
  GCODE_PREFIX: CommandType.G.toString(),
  /** M-code prefix */
  MCODE_PREFIX: CommandType.M.toString(),
  /** O-block prefix */
  OBLOCK_PREFIX: "O",
  /** Program delimiter */
  PROGRAM_DELIMITER: "%",
  /** Semicolon comment prefix */
  SEMICOLON_COMMENT: ";",
  /** Parenthetical comment opening */
  PARENTHETICAL_COMMENT_OPEN: "(",
  /** Parenthetical comment closing */
  PARENTHETICAL_COMMENT_CLOSE: ")",
  /** Expression bracket opening */
  EXPRESSION_BRACKET_OPEN: "[",
  /** Expression bracket closing */
  EXPRESSION_BRACKET_CLOSE: "]",
  /** Space separator */
  SPACE: " ",
  /** Newline separator */
  NEWLINE: "\n",
  /** Tab character */
  TAB: "\t",
  /** Empty string */
  EMPTY_STRING: "",
  /** Unknown value placeholder */
  UNKNOWN_VALUE: "?",
  /** Minus/unary negation operator */
  MINUS: "-",
} as const;

/**
 * G-code keywords
 */
export const GCODE_KEYWORDS = {
  GOTO: "GOTO",
  WHILE: "WHILE",
  IF: "IF",
  THEN: "THEN",
  ELSE: "ELSE",
  ELSEIF: "ELSEIF",
  ENDIF: "ENDIF",
  END: "END",
  DO: "DO",
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
  /** Default line number start */
  LINE_NUMBER_START: 10,
  /** Default line number increment */
  LINE_NUMBER_INCREMENT: 10,
  /** Default indent size */
  INDENT_SIZE: 4,
  /** Minimum indent level */
  MIN_INDENT_LEVEL: 0,
  /** Pretty print threshold for single-digit codes */
  PRETTY_PRINT_CODE_THRESHOLD: 10,
} as const;

/**
 * Regex patterns for G-code parsing
 */
export const REGEX_PATTERNS = {
  /** Matches numeric variables: #123 */
  NUMERIC_VARIABLE: /#(\d+)/g,
  /** Matches named variables: #<name> */
  NAMED_VARIABLE: /#<([a-zA-Z_][a-zA-Z0-9_]*)>/g,
  /** Matches line numbers: N123 */
  LINE_NUMBER: /[Nn][0-9]+/,
  /** Regex special characters that need escaping */
  REGEX_SPECIAL_CHARS: /[.*+?^${}()|[\]\\]/g,
  /** Word boundary for regex */
  WORD_BOUNDARY: "\\b",
  /** Newline pattern (CRLF or LF) */
  NEWLINE: /\r?\n/,
  /** Valid named variable name pattern */
  VALID_NAMED_VARIABLE: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
  /** Valid numeric variable pattern */
  VALID_NUMERIC_VARIABLE: /^\d+$/,
} as const;

/**
 * Special M-codes
 */
export const SPECIAL_MCODES = {
  /** Subprogram call */
  SUBPROGRAM_CALL: 98,
} as const;

/**
 * Default formatter options
 */
export const DEFAULT_FORMATTER_OPTIONS: FormatterOptions = {
  addLineNumbers: false,
  lineNumberStart: DEFAULTS.LINE_NUMBER_START,
  lineNumberIncrement: DEFAULTS.LINE_NUMBER_INCREMENT,
  prettyPrintCommands: true,
  prettyPrintNumbers: true,
  indentSize: DEFAULTS.INDENT_SIZE,
  useTabs: false,
  indent: true,
  compactOutput: false,
};
