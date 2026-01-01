/**
 * Token Utilities
 *
 * Shared utilities for working with semantic tokens.
 */

/**
 * Interface for a semantic token
 */
export interface SemanticToken {
  line: number;
  character: number;
  length: number;
  tokenType: any; // TokenTypes enum
  modifiers: string[];
}

/**
 * Remove overlapping tokens, keeping the longer one
 */
export function deduplicateTokens(tokens: SemanticToken[]): SemanticToken[] {
  const result: SemanticToken[] = [];

  for (const currentToken of tokens) {
    let shouldAdd = true;

    for (let j = 0; j < result.length; j++) {
      const existingToken = result[j];

      if (
        currentToken.line === existingToken.line &&
        currentToken.character <
          existingToken.character + existingToken.length &&
        currentToken.character + currentToken.length >
          existingToken.character
      ) {
        // Tokens overlap - keep the longer one
        if (currentToken.length > existingToken.length) {
          result[j] = currentToken;
        }
        shouldAdd = false;
        break;
      }
    }

    if (shouldAdd) {
      result.push(currentToken);
    }
  }

  return result;
}
