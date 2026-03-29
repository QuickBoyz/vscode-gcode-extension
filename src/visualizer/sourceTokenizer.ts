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

/**
 * Maps a LexerToken to a CSS class name that matches the existing
 * webview stylesheet. For identifier tokens with keywords, the keyword
 * value is used (e.g., 'IF', 'WHILE', 'EQ', 'ABS') to preserve
 * backward compatibility with the old TokenType-based class names.
 */
function tokenToCssClass(token: LexerToken): string {
  // For identifiers with keywords, use the keyword as the CSS class
  if (token.keyword !== null) {
    return token.keyword;
  }

  switch (token.category) {
    case TokenCategory.COMMENT:
      return 'comment';
    case TokenCategory.PAREN_COMMENT:
      return 'parenComment';
    case TokenCategory.VARIABLE:
      return 'VAR';
    case TokenCategory.LINE_NUMBER:
      return 'lineNumber';
    case TokenCategory.WS:
      return 'ws';
    case TokenCategory.NL:
      return 'nl';
    default:
      return token.category;
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
