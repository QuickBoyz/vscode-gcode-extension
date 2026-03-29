import { LexerToken } from '../lexer/LexerToken';
import { AstNode, Range } from './nodes';

export function rangeFrom(start?: LexerToken | AstNode, end?: LexerToken | AstNode): Range {
  if (!start) {
    return {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    };
  }

  const startPos =
      start instanceof LexerToken
        ? {
            line: start.line - 1,
            character: start.col - 1,
          }
        : start.getRange().start,
    endSource = end ?? start,
    endPos =
      endSource instanceof LexerToken
        ? {
            line: endSource.line - 1,
            character: endSource.col - 1 + endSource.value.length,
          }
        : endSource.getRange().end;

  return { start: startPos, end: endPos };
}
