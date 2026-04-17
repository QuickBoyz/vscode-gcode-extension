import { KeywordType, TokenCategory } from '../lexer/types';
import { LexerToken } from '../lexer/LexerToken';
import { ParserDiagnosticCode } from './nodes/ErrorNode';

import { ParseError } from '../errors/ParseError';

/**
 * Token stream that provides lookahead and matching over a LexerToken array.
 *
 * This stream automatically skips WS tokens so the parser does not need
 * to handle whitespace. NL tokens are NOT skipped.
 */
export class TokenStream {
  private index = 0;

  constructor(private readonly tokens: readonly LexerToken[]) {}

  peek(offset = 0): LexerToken | undefined {
    let count = 0;
    let i = this.index;
    while (i < this.tokens.length) {
      if (this.tokens[i].category !== TokenCategory.WS) {
        if (count === offset) {
          return this.tokens[i];
        }
        count++;
      }
      i++;
    }
    return undefined;
  }

  next(): LexerToken | undefined {
    while (this.index < this.tokens.length) {
      const token = this.tokens[this.index++];
      if (token.category !== TokenCategory.WS) {
        return token;
      }
    }
    return undefined;
  }

  last(): LexerToken | undefined {
    let i = this.index - 1;
    while (i >= 0) {
      if (this.tokens[i].category !== TokenCategory.WS) {
        return this.tokens[i];
      }
      i--;
    }
    return undefined;
  }

  eof(): boolean {
    let i = this.index;
    while (i < this.tokens.length) {
      if (this.tokens[i].category !== TokenCategory.WS) {
        return false;
      }
      i++;
    }
    return true;
  }

  /**
   * Match by category. Returns true if the next non-WS token's category
   * is one of the given categories.
   */
  matchCategory(...categories: TokenCategory[]): boolean {
    return this.peek()?.hasCategory(...categories) ?? false;
  }

  /**
   * Match by keyword. Returns true if the next non-WS token's keyword
   * is one of the given keywords.
   */
  matchKeyword(...keywords: KeywordType[]): boolean {
    return this.peek()?.hasKeyword(...keywords) ?? false;
  }

  /**
   * Consume the next token if it matches the given category. Returns the token or undefined.
   */
  consumeCategory(category: TokenCategory): LexerToken | undefined {
    if (this.matchCategory(category)) {
      return this.next();
    }
    return undefined;
  }

  /**
   * Consume the next token if it matches the given keyword. Returns the token or undefined.
   */
  consumeKeyword(keyword: KeywordType): LexerToken | undefined {
    if (this.matchKeyword(keyword)) {
      return this.next();
    }
    return undefined;
  }

  /**
   * Expect one of the given categories. Throws ParseError if not matched.
   */
  expectCategory(...categories: TokenCategory[]): LexerToken {
    const token = this.next();
    if (!token || !token.hasCategory(...categories)) {
      throw new ParseError(
        `Expected ${categories.join(' or ')}`,
        token,
        ParserDiagnosticCode.EXPECTED_TOKEN
      );
    }
    return token;
  }

  /**
   * Expect one of the given keywords. Throws ParseError if not matched.
   */
  expectKeyword(...keywords: KeywordType[]): LexerToken {
    const token = this.next();
    if (!token || !token.hasKeyword(...keywords)) {
      throw new ParseError(
        `Expected ${keywords.join(' or ')}`,
        token,
        ParserDiagnosticCode.EXPECTED_TOKEN
      );
    }
    return token;
  }
}
