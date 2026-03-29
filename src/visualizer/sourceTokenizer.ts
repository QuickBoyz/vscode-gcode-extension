/**
 * Source tokenizer for syntax highlighting in the visualizer webview.
 *
 * Converts raw G-code source lines into lightweight {@link TokenSpan} arrays
 * that the webview can render with CSS class-based colouring. Each span
 * carries only the display text and a token-type string — no VS Code
 * dependencies.
 *
 * This module lives in the visualizer (service) layer so that the client
 * layer does not import the lexer directly (AGENTS.md: "No direct lexer
 * access outside the parser").
 */

import { GCodeLexer } from '../lexer/GCodeLexer';
import { KeywordType } from '../lexer/KeywordType';
import { LexerToken } from '../lexer/LexerToken';
import { TokenCategory } from '../lexer/TokenCategory';

/**
 * A lightweight token span for the webview to render syntax-highlighted
 * source lines. Only carries the text and a token type string.
 */
export interface TokenSpan {
  readonly text: string;
  readonly type: string;
}

/** Function keywords that map to the grouped 'FUNC' CSS class. */
const FUNCTION_KEYWORDS = new Set<KeywordType>([
  KeywordType.SIN,
  KeywordType.COS,
  KeywordType.TAN,
  KeywordType.ASIN,
  KeywordType.ACOS,
  KeywordType.ATAN,
  KeywordType.SQRT,
  KeywordType.ABS,
  KeywordType.ROUND,
  KeywordType.FIX,
  KeywordType.FUP,
  KeywordType.LN,
  KeywordType.EXP,
  KeywordType.EXISTS,
]);

/** Relational keywords that map to the grouped 'RELOP' CSS class. */
const RELOP_KEYWORDS = new Set<KeywordType>([
  KeywordType.EQ,
  KeywordType.NE,
  KeywordType.LT,
  KeywordType.GT,
  KeywordType.LE,
  KeywordType.GE,
  KeywordType.AND,
  KeywordType.OR,
  KeywordType.XOR,
]);

/**
 * Maps a LexerToken to a CSS class name that matches the webview
 * stylesheet. Preserves backward-compatible class names from the
 * old TokenType-based system.
 */
function tokenToCssClass(token: LexerToken): string {
  // Keywords: group functions and relops into their old CSS classes
  if (token.keyword !== null) {
    if (FUNCTION_KEYWORDS.has(token.keyword)) return 'FUNC';
    if (RELOP_KEYWORDS.has(token.keyword)) return 'RELOP';
    return token.keyword; // IF, WHILE, MOD, etc. match CSS directly
  }

  // Categories: map to backward-compatible lowercase/camelCase names
  switch (token.category) {
    case TokenCategory.COMMENT:
      return 'comment';
    case TokenCategory.PAREN_COMMENT:
      return 'parenComment';
    case TokenCategory.VARIABLE:
      return 'VAR';
    case TokenCategory.LINE_NUMBER:
      return 'lineNumber';
    case TokenCategory.PLUS:
      return 'plus';
    case TokenCategory.MINUS:
      return 'minus';
    case TokenCategory.STAR:
      return 'star';
    case TokenCategory.SLASH:
      return 'slash';
    case TokenCategory.EQUALS:
      return 'equals';
    case TokenCategory.COMMA:
      return 'comma';
    case TokenCategory.DOT:
      return 'dot';
    case TokenCategory.LBRACKET:
      return 'lBracket';
    case TokenCategory.RBRACKET:
      return 'rBracket';
    case TokenCategory.HASH:
      return 'hash';
    case TokenCategory.PERCENT:
      return 'percent';
    case TokenCategory.WS:
      return 'ws';
    case TokenCategory.NL:
      return 'nl';
    default:
      return token.category; // GCODE, MCODE, NUMBER, PARAM, OSUB — uppercase, matches CSS
  }
}

/**
 * Tokenizes each source line using the G-code lexer and returns
 * lightweight token spans for syntax highlighting in the webview.
 * Whitespace between tokens is preserved as 'ws' spans so the
 * rendered output matches the original line exactly.
 *
 * Performance note: G-code files are typically small (hundreds to low
 * thousands of lines), so eager tokenization of all lines is acceptable.
 * Lazy per-line tokenization would add complexity without measurable
 * benefit for realistic file sizes.
 */
export function tokenizeSourceLines(lines: readonly string[]): TokenSpan[][] {
  const lexer = new GCodeLexer();
  return lines.map((line) => tokenizeSingleLine(lexer, line));
}

/**
 * Tokenizes a single source line into token spans.
 * On lexer failure the entire line is returned as a single 'plain' span.
 */
function tokenizeSingleLine(lexer: GCodeLexer, line: string): TokenSpan[] {
  try {
    const tokens = lexer.tokenize(line);
    const spans: TokenSpan[] = [];
    let cursor = 0;

    for (const token of tokens) {
      if (token.category === TokenCategory.NL) continue;
      const offset = token.offset;

      // Fill gap with whitespace
      if (offset > cursor) {
        spans.push({ text: line.slice(cursor, offset), type: 'ws' });
      }
      spans.push({ text: token.value, type: tokenToCssClass(token) });
      cursor = offset + token.value.length;
    }

    // Trailing whitespace
    if (cursor < line.length) {
      spans.push({ text: line.slice(cursor), type: 'ws' });
    }

    return spans;
  } catch {
    return [{ text: line, type: 'plain' }];
  }
}
