import { ParserDiagnosticCode } from '../parser/nodes';

import { ErrorLocation } from './ErrorLocation';
import { ParseError } from './ParseError';

/** Factory for structured parse errors — all raise sites must use this for consistent location shape. */
export function createParseError(args: {
  readonly line: number;
  readonly column?: number;
  readonly endLine?: number;
  readonly endColumn?: number;
  readonly message: string;
  readonly code?: ParserDiagnosticCode;
}): ParseError {
  const location: ErrorLocation = {
    line: args.line,
    ...(args.column !== undefined && { column: args.column }),
    ...(args.endLine !== undefined && { endLine: args.endLine }),
    ...(args.endColumn !== undefined && { endColumn: args.endColumn }),
  };
  return new ParseError(args.message, undefined, args.code, location);
}
