import { LexerToken } from '../lexer/LexerToken';
import { ParserDiagnosticCode } from '../parser/nodes';

import { ErrorLocation } from './ErrorLocation';

/**
 * Thrown by the lexer/parser when the input cannot be parsed.
 *
 * `location` is always populated (1-based) — from an explicit override when
 * provided, or derived from `token.line` / `token.col` otherwise.
 */
export class ParseError extends Error {
  readonly location: ErrorLocation | undefined;

  constructor(
    message: string,
    public readonly token?: LexerToken,
    public readonly code?: ParserDiagnosticCode,
    location?: ErrorLocation
  ) {
    super(message);
    this.name = 'ParseError';
    this.location = location ?? (token ? { line: token.line, column: token.col } : undefined);
  }
}
