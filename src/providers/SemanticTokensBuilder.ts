import { SemanticTokensBuilder } from 'vscode-languageserver/node';

import { Range } from '../parser/nodes';

interface TokenEntry {
  line: number;
  char: number;
  length: number;
  tokenTypeIndex: number;
  modifierMask: number;
}

export class GCodeSemanticTokensBuilder {
  private tokens: TokenEntry[] = [];

  push(line: number, char: number, length: number, tokenTypeIndex: number, modifierMask = 0) {
    this.tokens.push({ line, char, length, tokenTypeIndex, modifierMask });
  }

  pushRange(range: Range, tokenTypeIndex: number, modifierMask = 0) {
    this.tokens.push({
      line: range.start.line,
      char: range.start.character,
      length: range.end.character - range.start.character,
      tokenTypeIndex,
      modifierMask,
    });
  }

  /**
   * Sort tokens by line and character position
   * This is required because tokens must be added in strictly increasing order
   */
  private sortTokens() {
    this.tokens.sort((a, b) => {
      if (a.line !== b.line) {
        return a.line - b.line;
      }
      return a.char - b.char;
    });
  }

  build() {
    this.sortTokens();

    // Build the semantic tokens in sorted order
    const builder = new SemanticTokensBuilder();
    for (const token of this.tokens) {
      builder.push(token.line, token.char, token.length, token.tokenTypeIndex, token.modifierMask);
    }

    return builder.build();
  }
}
