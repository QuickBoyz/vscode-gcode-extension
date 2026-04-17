import { Range } from 'vscode-languageserver/node';

import { ErrorLocation } from './ErrorLocation';

/**
 * Converts a 1-based {@link ErrorLocation} to a 0-based LSP {@link Range}.
 *
 * This is the single site where 1-based → 0-based conversion happens for the
 * LSP diagnostics path. If `end` coordinates are omitted the range is a
 * single-character span starting at `start`.
 */
export function locationToRange(location: ErrorLocation): Range {
  const startLine = location.line - 1;
  const startChar = (location.column ?? 1) - 1;
  const endLine = (location.endLine ?? location.line) - 1;
  const endChar = (location.endColumn ?? location.column ?? 1) - 1;
  return {
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
  };
}

/**
 * Strips end coordinates, returning only the single-point payload the webview
 * error card consumes (`{ line, column? }`), still 1-based.
 */
export function locationToPayload(location: ErrorLocation): {
  readonly line: number;
  readonly column?: number;
} {
  if (location.column !== undefined) {
    return { line: location.line, column: location.column };
  }
  return { line: location.line };
}
