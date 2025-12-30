import { GCODE_SYMBOLS } from "../../constants";
import { StatementType, CommentStyle } from "../../parser";

import { Statement } from "./Statement";

/**
 * Label statement (standalone N-block line number)
 */
export class Label extends Statement {
  type: StatementType.Label = StatementType.Label;
  lineNumber: number;

  constructor(
    lineNumber: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.Label;
  }

  getLabel(): number | null {
    return null;
  }

  toString(): string {
    return `${GCODE_SYMBOLS.LINE_NUMBER_PREFIX}${this.lineNumber}`;
  }
}
