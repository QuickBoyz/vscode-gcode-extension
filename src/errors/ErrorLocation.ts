/**
 * Structured location within a source file. All coordinates are 1-based
 * to match lexer token conventions and user-facing display.
 *
 * The end coordinates are optional — raise sites populate them when a full
 * token range is available; the webview only consumes `line` and `column`.
 */
export type ErrorLocation = {
  readonly line: number;
  readonly column?: number;
  readonly endLine?: number;
  readonly endColumn?: number;
};
