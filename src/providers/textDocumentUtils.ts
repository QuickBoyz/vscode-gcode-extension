/**
 * Text Document Utilities
 *
 * Shared helper functions for working with TextDocument line positions and ranges.
 * Used by providers that need to compute line-end positions, extract line text,
 * or build full-line deletion ranges.
 */
import { Position, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

/** Get the position at the end of a given line (before the newline). */
export function getLineEndPosition(document: TextDocument, line: number): Position {
  const lineCount = document.lineCount;
  const lineIndex = Math.min(line, lineCount - 1);
  const lineStart = document.offsetAt({ line: lineIndex, character: 0 });
  const nextLineStart =
    lineIndex < lineCount - 1
      ? document.offsetAt({ line: lineIndex + 1, character: 0 })
      : document.getText().length;
  let lineEnd = nextLineStart;
  if (lineIndex < lineCount - 1) {
    const text = document.getText();
    if (lineEnd > lineStart && text[lineEnd - 1] === '\n') lineEnd--;
    if (lineEnd > lineStart && text[lineEnd - 1] === '\r') lineEnd--;
  }
  return { line: lineIndex, character: lineEnd - lineStart };
}

/** Get the text content of a given line (excluding newline). */
export function getLineText(document: TextDocument, line: number): string {
  const start: Position = { line, character: 0 };
  const end = getLineEndPosition(document, line);
  return document.getText({ start, end });
}

/**
 * Get a range that covers an entire line including its trailing newline.
 * Deleting this range removes the line completely.
 */
export function getFullLineRange(document: TextDocument, line: number): Range {
  const lineCount = document.lineCount;
  const lineIndex = Math.min(line, lineCount - 1);

  if (lineIndex < lineCount - 1) {
    // Not the last line: from start of this line to start of next line
    return {
      start: { line: lineIndex, character: 0 },
      end: { line: lineIndex + 1, character: 0 },
    };
  }
  // Last line: from end of previous line (newline) to end of this line
  const lineEnd = getLineEndPosition(document, lineIndex);
  if (lineIndex > 0) {
    const prevEnd = getLineEndPosition(document, lineIndex - 1);
    return { start: prevEnd, end: lineEnd };
  }
  return { start: { line: 0, character: 0 }, end: lineEnd };
}
