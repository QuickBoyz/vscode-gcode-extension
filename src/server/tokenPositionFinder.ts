/**
 * Token Position Finder
 *
 * Utility to find tokens at specific positions in a document.
 * Uses the lexer to tokenize and provides efficient position-based lookups.
 * This eliminates code duplication by centralizing token matching logic.
 */

import { Token, TokenType, gcodeLexer } from "../lexer";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Position } from "vscode-languageserver/node";

/**
 * Token with position information
 */
export interface TokenWithPosition extends Token {
  line: number;
  character: number;
  endCharacter: number;
}

/**
 * Find all tokens in a document with their positions
 * Uses the lexer to tokenize and maps tokens to document positions
 */
export function findTokensWithPositions(
  document: TextDocument
): TokenWithPosition[] {
  const text = document.getText();
  const lines = text.split(/\r?\n/);
  const tokens = gcodeLexer.tokenize(text);
  const tokensWithPositions: TokenWithPosition[] = [];

  // Build a map of line start positions in the original text
  const lineStarts: number[] = [0];
  for (let i = 0; i < lines.length - 1; i++) {
    lineStarts.push(lineStarts[i] + lines[i].length + 1); // +1 for newline
  }

  // Map tokens to positions
  let textOffset = 0;
  let lineIndex = 0;
  let lineChar = 0;

  for (const token of tokens) {
    const tokenText = token.value;

    // Handle newline tokens
    if (token.type === TokenType.NL) {
      lineIndex++;
      lineChar = 0;
      textOffset += tokenText.length;
      continue;
    }

    // Find token in current line
    const line = lines[lineIndex];
    if (line) {
      // Try to find token starting from current position in line
      let tokenPos = line.indexOf(tokenText, lineChar);

      // If not found, search from beginning of line (for cases where token order differs)
      if (tokenPos === -1) {
        tokenPos = line.indexOf(tokenText, 0);
      }

      if (tokenPos !== -1) {
        tokensWithPositions.push({
          ...token,
          line: lineIndex,
          character: tokenPos,
          endCharacter: tokenPos + tokenText.length,
        });
        lineChar = tokenPos + tokenText.length;
        textOffset += tokenText.length;
      } else {
        // Token not found in line - might be a parsing issue, skip it
        console.warn(
          `Token "${tokenText}" (type: ${token.type}) not found in line ${lineIndex}`
        );
      }
    }
  }

  return tokensWithPositions;
}

/**
 * Find token at a specific position
 */
export function findTokenAtPosition(
  document: TextDocument,
  position: Position
): TokenWithPosition | null {
  const tokens = findTokensWithPositions(document);

  for (const token of tokens) {
    if (
      token.line === position.line &&
      token.character <= position.character &&
      token.endCharacter > position.character
    ) {
      return token;
    }
  }

  return null;
}
