import { Token } from "../entities/tokens";
import { AstNode, Range } from "./nodes";

export function rangeFrom(
  start?: Token | AstNode,
  end?: Token | AstNode
): Range {
  if (!start) {
    return {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    };
  }

  const startPos =
    start instanceof Token
      ? {
          line: start.line - 1,
          character: start.col - 1,
        }
      : start.getRange().start;

  const endSource = end ?? start;

  const endPos =
    endSource instanceof Token
      ? {
          line: endSource.line - 1,
          character: endSource.col - 1 + endSource.text.length,
        }
      : endSource.getRange().end;

  return { start: startPos, end: endPos };
}
