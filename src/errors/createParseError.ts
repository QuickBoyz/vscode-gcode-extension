import { ParserDiagnosticCode } from '../parser/nodes';

import { ErrorLocation } from './ErrorLocation';
import { ParseError } from './ParseError';

/**
 * Single factory for structured parse errors.
 *
 * All raise sites (lexer, parser, extractor) must go through here so that
 * the location shape is always populated and formatted identically.
 *
 * Coordinates are 1-based throughout — the LSP adapter in `adapters.ts`
 * is the single site that converts to 0-based.
 */
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
