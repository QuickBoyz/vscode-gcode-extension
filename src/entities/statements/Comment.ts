import { GCODE_SYMBOLS } from "../../constants";
import { StatementType, CommentStyle } from "./types";

import { Statement } from "./Statement";

/**
 * Comment-only statement
 */
export class Comment extends Statement {
  type: StatementType.Comment = StatementType.Comment;
  value: string;
  style: CommentStyle;

  constructor(
    value: string,
    style: CommentStyle,
    lineNumber?: number,
    comment?: string,
    commentStyle?: CommentStyle
  ) {
    super();
    this.value = value;
    this.style = style;
    this.lineNumber = lineNumber;
    this.comment = comment;
    this.commentStyle = commentStyle;
  }

  getType(): StatementType {
    return StatementType.Comment;
  }

  getLabel(): number | null {
    return null;
  }

  toString(): string {
    if (this.style === "parenthetical") {
      return `${GCODE_SYMBOLS.PARENTHETICAL_COMMENT_OPEN}${this.value}${GCODE_SYMBOLS.PARENTHETICAL_COMMENT_CLOSE}`;
    }
    return `${GCODE_SYMBOLS.SEMICOLON_COMMENT}${this.value}`;
  }
}
