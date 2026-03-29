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
import { TokenType } from '../parser/nodes/tokens';

/**
 * A lightweight token span for the webview to render syntax-highlighted
 * source lines. Only carries the text and a token type string.
 */
export interface TokenSpan {
  readonly text: string;
  readonly type: string;
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
      if (token.type === TokenType.NL) continue;
      let offset = token.getOffset();

      // The lexer combines MINUS + NUMBER into a single token but keeps
      // the NUMBER's original offset. When the combined value starts
      // with '-' and the character at offset - 1 in the original line
      // is also '-', adjust the offset back by 1 so the gap-filling
      // logic does not create a duplicate minus sign.
      if (token.value.startsWith('-') && offset > 0 && line[offset - 1] === '-') {
        offset = offset - 1;
      }

      // Fill gap with whitespace
      if (offset > cursor) {
        spans.push({ text: line.slice(cursor, offset), type: 'ws' });
      }
      spans.push({ text: token.value, type: token.type });
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
