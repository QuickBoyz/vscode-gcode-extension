import { Range } from 'vscode-languageserver/node';

import { ErrorLocation } from './ErrorLocation';

/** Converts 1-based ErrorLocation to a 0-based LSP Range. Single conversion site for the diagnostics path. */
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

/** Strips end coordinates for the single-point webview payload. Still 1-based. */
export function locationToPayload(location: ErrorLocation): {
  readonly line: number;
  readonly column?: number;
} {
  if (location.column !== undefined) {
    return { line: location.line, column: location.column };
  }
  return { line: location.line };
}
