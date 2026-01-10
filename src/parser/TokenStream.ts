// Parser/TokenStream.ts
import { Token, TokenType } from './nodes/tokens';

export class TokenStream {
  private index = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  peek(offset = 0): Token | undefined {
    return this.tokens[this.index + offset];
  }

  next(): Token | undefined {
    return this.tokens[this.index++];
  }

  last(): Token | undefined {
    return this.tokens[this.index - 1];
  }

  eof(): boolean {
    return this.index >= this.tokens.length;
  }

  match(...types: TokenType[]): boolean {
    return this.peek()?.hasType(...types) ?? false;
  }

  consume(type: TokenType): Token | undefined {
    if (this.match(type)) {
      return this.next();
    }
    return undefined;
  }

  expect(...types: TokenType[]): Token {
    const token = this.next();
    if (!token || !token.hasType(...types)) {
      throw new ParseError(`Expected ${types.join(' or ')}`, token);
    }
    return token;
  }
}

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly token?: Token
  ) {
    super(message);
    this.name = 'ParseError';
  }
}
