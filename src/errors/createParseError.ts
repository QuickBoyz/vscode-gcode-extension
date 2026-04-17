import { LexerToken } from '../lexer/LexerToken';
import { ParserDiagnosticCode } from '../parser/nodes';

import { ErrorLocation } from './ErrorLocation';
import { ParseError } from './ParseError';

/** Factory for structured parse errors — all raise sites must use this for consistent location shape. */
export function createParseError(args: {
  readonly message: string;
  readonly code?: ParserDiagnosticCode;
  readonly token?: LexerToken;
  readonly line?: number;
  readonly column?: number;
  readonly endLine?: number;
  readonly endColumn?: number;
}): ParseError {
  const location: ErrorLocation | undefined =
    args.line !== undefined
      ? {
          line: args.line,
          ...(args.column !== undefined && { column: args.column }),
          ...(args.endLine !== undefined && { endLine: args.endLine }),
          ...(args.endColumn !== undefined && { endColumn: args.endColumn }),
        }
      : args.token
        ? {
            line: args.token.line,
            column: args.token.col,
            endLine: args.token.line,
            endColumn: args.token.col + args.token.value.length,
          }
        : undefined;
  return new ParseError(args.message, args.token, args.code, location);
}
