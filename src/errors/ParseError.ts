import { LexerToken } from '../lexer/LexerToken';
import { ParserDiagnosticCode } from '../parser/nodes';
import { Range } from '../parser/nodes/Range';

/** Thrown by the lexer/parser when the input cannot be parsed. */
export class ParseError extends Error {
  readonly range: Range | null;

  constructor(
    message: string,
    public readonly token?: LexerToken,
    public readonly code?: ParserDiagnosticCode,
    range?: Range | null
  ) {
    super(message);
    this.name = 'ParseError';
    this.range = range ?? (token ? ParseError.rangeFromToken(token) : null);
  }

  static createParseError(args: {
    readonly message: string;
    readonly code?: ParserDiagnosticCode;
    readonly token?: LexerToken;
    readonly range?: Range;
  }): ParseError {
    const range = args.range ?? (args.token ? ParseError.rangeFromToken(args.token) : null);
    return new ParseError(args.message, args.token, args.code, range);
  }

  private static rangeFromToken(token: LexerToken): Range {
    return Range.create(
      token.line - 1,
      token.col - 1,
      token.line - 1,
      token.col - 1 + token.value.length
    );
  }
}
