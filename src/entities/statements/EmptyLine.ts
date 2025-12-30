import { StatementType, CommentStyle } from "../../parser";

import { Statement } from "./Statement";

/**
 * Empty line statement (preserves blank lines in source)
 */
export class EmptyLine extends Statement {
  type: StatementType.EmptyLine = StatementType.EmptyLine;

  constructor(
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.EmptyLine;
  }

  getLabel(): number | null {
    return null;
  }

  toString(): string {
    return "";
  }
}
